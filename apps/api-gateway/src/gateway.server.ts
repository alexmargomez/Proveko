import {
  DoubleKeyServiceGuard,
  type HttpMethodType,
  type MicroserviceHttpRequest,
  type MicroserviceHttpResponse,
  sanitizeInboundTenantHeaders,
} from '@proveko/service-guard';
import {
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import { UpstreamRouteRegistry } from './routing/upstream-registry.js';
import { TenantTierRateLimiter } from './security/rate-limiter.js';

export interface GatewayInboundRequest<TBody = unknown> {
  method: HttpMethodType;
  url: string; // ej. "/api/v1/srv:invoicing/ms:invoicing-electronic-dian/invoices/emit"
  headers: Record<string, string | string[] | undefined>;
  body?: TBody;
  clientIp?: string;
}

/**
 * Puerta Perimetral Zero-Trust (`@proveko/api-gateway`):
 * 1. Purga cabeceras falsificadas (`x-proveko-*`, `x-tenant-*`, `x-cell-*`).
 * 2. Verifica firma Ed25519 + frescura de `sub_ver` en Redis (`ERR_SUB_VER_STALE`).
 * 3. Valida la Doble Llave (Servicio Padre Gatekeeper + Microservicio Hijo + Modo `READONLY_ARCHIVE`).
 * 4. Aplica Rate Limiting por nivel de suscripción (`sandbox`, `starter`, `business`, `enterprise`).
 * 5. Enruta dinámicamente en 2 niveles: al Servidor Dedicado del Microservicio (`UPSTREAM_MS_*`)
 *    o al Servidor `host-runner` del Servicio Padre (`UPSTREAM_SRV_*`).
 */
export class ProvekoApiGateway {
  constructor(
    private readonly perimeterGuard: DoubleKeyServiceGuard,
    public readonly upstreamRegistry: UpstreamRouteRegistry,
    private readonly rateLimiter: TenantTierRateLimiter = new TenantTierRateLimiter(),
  ) {}

  public async handleGatewayRequest<TBody = unknown>(
    req: GatewayInboundRequest<TBody>,
  ): Promise<MicroserviceHttpResponse> {
    const cleanHeaders = sanitizeInboundTenantHeaders(req.headers);
    const authHeaderRaw = cleanHeaders['authorization'] ?? cleanHeaders['Authorization'];
    const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

    const parsedRoute = this.parseServiceAndMicroserviceUrl(req.url);
    if (!parsedRoute) {
      return {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
        body: {
          type: 'https://api.proveko.com/errors/invalid-gateway-route',
          title: 'Invalid Gateway Route Pattern',
          status: 404,
          detail: `Expected URL pattern /api/v1/<srv:*>/<ms:*>/<subPath>, received "${req.url}".`,
        },
      };
    }

    try {
      // 1. Resolver primero que el microservicio pertenezca al servicio padre y exista upstream
      const upstream = this.upstreamRegistry.resolveTargetServer(
        parsedRoute.parentService,
        parsedRoute.microserviceKey,
      );

      // 2. Validar Doble Llave Perimetral + Firma Ed25519 + sub_ver en Redis + Modo Readonly
      return await this.perimeterGuard.verifyAndExecute<MicroserviceHttpResponse>(
        {
          authorizationHeader,
          method: req.method,
          headers: cleanHeaders,
        },
        parsedRoute.parentService,
        parsedRoute.microserviceKey,
        async (verifiedCtx) => {
          // 3. Rate Limiting por Tenant y Tier
          this.rateLimiter.checkOrThrow(`tenant:${verifiedCtx.tenantId}`, verifiedCtx.tier);

          const downstreamReq: MicroserviceHttpRequest<TBody> = {
            method: req.method,
            path: parsedRoute.subPath,
            headers: {
              ...cleanHeaders,
              authorization: authorizationHeader,
            },
            body: req.body,
          };

          if (upstream.transport) {
            const response = await upstream.transport(parsedRoute.microserviceKey, downstreamReq);
            const mergedHeaders: Record<string, string> = {
              ...response.headers,
              'x-proveko-gateway-routed-to': upstream.serverId,
              'x-proveko-gateway-base-url': upstream.baseUrl,
              'x-proveko-routing-mode': upstream.mode,
            };
            return {
              ...response,
              headers: mergedHeaders,
            };
          }

          // Si no hay transporte en memoria adjunto, realiza fetch HTTP hacia el servidor remoto
          const targetUrl = `${upstream.baseUrl}${parsedRoute.subPath}`;
          const fetchRes = await fetch(targetUrl, {
            method: req.method,
            headers: {
              'content-type': 'application/json',
              ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
            },
            body:
              req.body !== undefined && req.method !== 'GET' && req.method !== 'HEAD'
                ? JSON.stringify(req.body)
                : undefined,
          });

          const responseBody = await fetchRes.json().catch(() => null);
          const remoteHeaders: Record<string, string> = {
            'content-type': fetchRes.headers.get('content-type') ?? 'application/json',
            'x-proveko-gateway-routed-to': upstream.serverId,
            'x-proveko-gateway-base-url': upstream.baseUrl,
            'x-proveko-routing-mode': upstream.mode,
          };
          return {
            status: fetchRes.status,
            headers: remoteHeaders,
            body: responseBody,
          };
        },
      );
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        return {
          status: err.statusCode,
          headers: { 'content-type': 'application/problem+json' },
          body: err.toProblemDetails(),
        };
      }
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        500,
        err instanceof Error ? err.message : 'Unexpected Gateway Error',
      );
    }
  }

  private parseServiceAndMicroserviceUrl(url: string): {
    parentService: ServiceKey;
    microserviceKey: MicroserviceKey;
    subPath: string;
  } | null {
    const [pathOnly] = url.split('?');
    if (!pathOnly) return null;

    // Patrón: /api/v1/srv:<padre>/ms:<hijo>/<subPath...>
    const match = /^\/api\/v1\/(srv:[a-z0-9-]+)\/(ms:[a-z0-9-]+)(\/.*)?$/.exec(pathOnly);
    if (!match || !match[1] || !match[2]) {
      return null;
    }

    return {
      parentService: match[1] as ServiceKey,
      microserviceKey: match[2] as MicroserviceKey,
      subPath: match[3] && match[3].length > 0 ? match[3] : '/',
    };
  }
}
