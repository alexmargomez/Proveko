import { ClusterHmacGuard } from '@proveko/crypto-vault';
import {
  DoubleKeyServiceGuard,
  type HttpMethodType,
  type MicroserviceHttpRequest,
  type MicroserviceHttpResponse,
  sanitizeInboundTenantHeaders,
} from '@proveko/service-guard';
import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import { UpstreamRouteRegistry } from './routing/upstream-registry.js';
import { type RateLimiterPort, TenantTierRateLimiter } from './security/rate-limiter.js';

export interface GatewayInboundRequest<TBody = unknown> {
  method: HttpMethodType;
  /**
   * Soporta ambas notaciones:
   * - `/api/v1/ms:invoicing/mod:invoicing-electronic-dian/invoices/emit`
   * - `/api/v1/srv:invoicing/ms:invoicing-electronic-dian/invoices/emit`
   */
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: TBody;
  clientIp?: string;
}

/**
 * Puerto de Cliente HTTP para comunicación con servidores upstream remotos (SOLID DIP + OCP)
 */
export interface UpstreamHttpClientPort {
  forwardHttpRequest<TBody = unknown>(params: {
    targetUrl: string;
    method: HttpMethodType;
    authorizationHeader?: string;
    headers?: Record<string, string>;
    body?: TBody;
  }): Promise<{
    status: number;
    contentType: string;
    headers?: Record<string, string>;
    body: unknown;
  }>;
}

export class FetchUpstreamHttpClientAdapter implements UpstreamHttpClientPort {
  constructor(private readonly timeoutMs: number = 5_000) {}

  public async forwardHttpRequest<TBody = unknown>(params: {
    targetUrl: string;
    method: HttpMethodType;
    authorizationHeader?: string;
    headers?: Record<string, string>;
    body?: TBody;
  }): Promise<{
    status: number;
    contentType: string;
    headers?: Record<string, string>;
    body: unknown;
  }> {
    try {
      const fetchRes = await fetch(params.targetUrl, {
        method: params.method,
        headers: {
          'content-type': 'application/json',
          ...(params.headers ?? {}),
          ...(params.authorizationHeader ? { authorization: params.authorizationHeader } : {}),
        },
        body:
          params.body !== undefined && params.method !== 'GET' && params.method !== 'HEAD'
            ? JSON.stringify(params.body)
            : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const responseHeaders: Record<string, string> = {};
      fetchRes.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('x-proveko-')) {
          responseHeaders[key.toLowerCase()] = value;
        }
      });

      const responseBody = await fetchRes.json().catch(() => null);
      return {
        status: fetchRes.status,
        contentType: fetchRes.headers.get('content-type') ?? 'application/json',
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (err) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
        502,
        `Upstream server at "${params.targetUrl}" failed or timed out: ${err instanceof Error ? err.message : String(err)}`,
        { target_url: params.targetUrl },
      );
    }
  }
}

/**
 * Puerta Perimetral Zero-Trust (`@proveko/api-gateway`):
 * 1. Purga cabeceras falsificadas (`x-proveko-*`, `x-tenant-*`, `x-cell-*`).
 * 2. Bloquea intentos de Path Traversal (`..`, `%2e%2e`, `\`).
 * 3. Verifica firma Ed25519 + frescura de `sub_ver` en Redis (`ERR_SUB_VER_STALE`).
 * 4. Valida la Doble Llave (Microservicio Padre Gatekeeper + Módulo Hijo + Modo `READONLY_ARCHIVE`).
 * 5. Aplica Rate Limiting con capacidad LRU acotada por nivel de suscripción.
 * 6. Enruta dinámicamente en 2 niveles: al Servidor Dedicado del Módulo (`UPSTREAM_MOD_*` / `UPSTREAM_MS_*`)
 *    o al Servidor `host-runner` del Microservicio Padre (`UPSTREAM_MS_*` / `UPSTREAM_SRV_*`).
 * 7. Firma criptográficamente cada salto Gateway -> Microservicio con HMAC-SHA256 + Anti-Replay (`x-proveko-cluster-sig`).
 */
export class ProvekoApiGateway {
  constructor(
    private readonly perimeterGuard: DoubleKeyServiceGuard,
    public readonly upstreamRegistry: UpstreamRouteRegistry,
    private readonly rateLimiter: RateLimiterPort = new TenantTierRateLimiter(),
    private readonly httpClient: UpstreamHttpClientPort = new FetchUpstreamHttpClientAdapter(),
    private readonly clusterHmacGuard: ClusterHmacGuard = new ClusterHmacGuard(),
  ) {}

  public async handleGatewayRequest<TBody = unknown>(
    req: GatewayInboundRequest<TBody>,
  ): Promise<MicroserviceHttpResponse> {
    const cleanHeaders = sanitizeInboundTenantHeaders(req.headers);
    const authHeaderRaw = cleanHeaders['authorization'] ?? cleanHeaders['Authorization'];
    const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

    // Bloqueo estricto Anti-Path-Traversal en el borde perimetral
    if (this.hasPathTraversalSequence(req.url)) {
      const err = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        400,
        `Path traversal sequences are forbidden in gateway URL: "${req.url}".`,
      );
      return {
        status: err.statusCode,
        headers: { 'content-type': 'application/problem+json' },
        body: err.toProblemDetails(),
      };
    }

    const parsedRoute = this.parseServiceAndMicroserviceUrl(req.url);
    if (!parsedRoute) {
      return {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
        body: {
          type: 'https://errors.proveko.com/err_not_found',
          title: 'Invalid Gateway Route Pattern',
          status: 404,
          error_code: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          detail: `Expected URL pattern /api/v1/<ms:*|srv:*>/<mod:*|ms:*>/<subPath>, received "${req.url}".`,
        },
      };
    }

    try {
      // 1. Resolver primero que el módulo pertenezca al microservicio padre y exista upstream
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

          const fullSubPathWithQuery = parsedRoute.queryString
            ? `${parsedRoute.subPath}?${parsedRoute.queryString}`
            : parsedRoute.subPath;

          const downstreamReq: MicroserviceHttpRequest<TBody> = {
            method: req.method,
            path: fullSubPathWithQuery,
            headers: {
              ...cleanHeaders,
              authorization: authorizationHeader,
            },
            body: req.body,
            query: parsedRoute.queryParams,
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

          // Si no hay transporte en memoria adjunto, realiza petición HTTP firmada con HMAC-SHA256 hacia el servidor remoto
          const targetUrl = `${upstream.baseUrl}${fullSubPathWithQuery}`;
          const clusterHeaders = this.clusterHmacGuard.signOutboundRequest({
            method: req.method,
            pathAndQuery: fullSubPathWithQuery,
            targetParent: parsedRoute.parentService,
            targetModule: parsedRoute.microserviceKey,
            authorizationHeader,
          });

          const fetchRes = await this.httpClient.forwardHttpRequest({
            targetUrl,
            method: req.method,
            authorizationHeader,
            headers: {
              'x-proveko-target-parent': parsedRoute.parentService,
              'x-proveko-target-module': parsedRoute.microserviceKey,
              ...clusterHeaders,
            },
            body: req.body,
          });

          const remoteHeaders: Record<string, string> = {
            ...(fetchRes.headers ?? {}),
            'content-type': fetchRes.contentType,
            'x-proveko-gateway-routed-to': upstream.serverId,
            'x-proveko-gateway-base-url': upstream.baseUrl,
            'x-proveko-routing-mode': upstream.mode,
          };
          return {
            status: fetchRes.status,
            headers: remoteHeaders,
            body: fetchRes.body,
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
      const unexpected = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
        502,
        err instanceof Error ? err.message : 'Unexpected Gateway Upstream Error',
      );
      return {
        status: unexpected.statusCode,
        headers: { 'content-type': 'application/problem+json' },
        body: unexpected.toProblemDetails(),
      };
    }
  }

  private hasPathTraversalSequence(rawUrl: string): boolean {
    const lower = rawUrl.toLowerCase();
    return (
      lower.includes('..') ||
      lower.includes('%2e%2e') ||
      lower.includes('%2e.') ||
      lower.includes('.%2e') ||
      lower.includes('\\') ||
      lower.includes('%5c')
    );
  }

  private parseServiceAndMicroserviceUrl(url: string): {
    parentService: ServiceKey;
    microserviceKey: MicroserviceKey;
    subPath: string;
    queryString: string;
    queryParams: Record<string, string>;
  } | null {
    const qIndex = url.indexOf('?');
    const pathOnly = qIndex >= 0 ? url.slice(0, qIndex) : url;
    const queryString = qIndex >= 0 ? url.slice(qIndex + 1) : '';
    if (!pathOnly) return null;

    // Soporta:
    // 1. /api/v1/ms:<padre>/mod:<hijo>/<subPath...>
    // 2. /api/v1/srv:<padre>/ms:<hijo>/<subPath...>
    // 3. Combinaciones compatibles (/api/v1/srv:<padre>/mod:<hijo>/* o /api/v1/ms:<padre>/ms:<hijo>/*)
    const match =
      /^\/api\/v1\/((?:srv|ms):[a-z0-9-]+)\/((?:mod|ms):[a-z0-9-]+)(\/.*)?$/.exec(pathOnly);
    if (!match || !match[1] || !match[2]) {
      return null;
    }

    try {
      const parentService = normalizeParentMicroserviceKey(
        match[1] as ParentMicroserviceKey | ServiceKey,
      );
      const microserviceKey = normalizeModuleKey(match[2] as ModuleKey | MicroserviceKey);
      const queryParams: Record<string, string> = {};
      if (queryString) {
        const searchParams = new URLSearchParams(queryString);
        for (const [k, v] of searchParams.entries()) {
          queryParams[k] = v;
        }
      }

      return {
        parentService,
        microserviceKey,
        subPath: match[3] && match[3].length > 0 ? match[3] : '/',
        queryString,
        queryParams,
      };
    } catch {
      return null;
    }
  }
}

