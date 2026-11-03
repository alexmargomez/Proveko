import {
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  DoubleKeyServiceGuard,
  type HttpMethodType,
  sanitizeInboundTenantHeaders,
} from './double-key.guard.js';
import type { VerifiedTenantContext } from './tenant-context.storage.js';

export interface MicroserviceHttpRequest<TBody = unknown, TQuery = Record<string, string>> {
  method: HttpMethodType;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: TBody;
  query?: TQuery;
}

export interface MicroserviceHttpResponse<TData = unknown> {
  status: number;
  headers: Record<string, string>;
  body: TData;
}

export type MicroserviceRouteHandler<TBody = any, TResult = any> = (
  ctx: Readonly<VerifiedTenantContext>,
  req: MicroserviceHttpRequest<TBody>,
) => Promise<TResult>;

export interface MicroserviceRouteDefinition {
  method: HttpMethodType;
  subPath: string; // ej. "/items" o "/invoices/emit"
  description: string;
  handler: MicroserviceRouteHandler;
}

export interface ProvekoMicroservicePlugin {
  readonly parentService: ServiceKey;
  readonly microserviceKey: MicroserviceKey;
  readonly tablePrefix: string;
  readonly version: string;
  readonly routes: ReadonlyArray<MicroserviceRouteDefinition>;
}

/**
 * Valida en tiempo de registro que el Microservicio corresponda a su Servicio Padre oficial
 * y respete el prefijo de tablas del catálogo maestro.
 */
export function defineProvekoMicroservice(
  plugin: ProvekoMicroservicePlugin,
): Readonly<ProvekoMicroservicePlugin> {
  const catalogDef = SEED_MICROSERVICES_CATALOG.find(
    (m) => m.key === plugin.microserviceKey,
  );
  if (!catalogDef) {
    throw new Error(`Microservice "${plugin.microserviceKey}" is not registered in SEED_MICROSERVICES_CATALOG.`);
  }
  if (catalogDef.parentService !== plugin.parentService) {
    throw new Error(
      `Microservice "${plugin.microserviceKey}" belongs to parent "${catalogDef.parentService}", not "${plugin.parentService}".`,
    );
  }
  if (catalogDef.tablePrefix !== plugin.tablePrefix) {
    throw new Error(
      `Microservice "${plugin.microserviceKey}" must use table prefix "${catalogDef.tablePrefix}", received "${plugin.tablePrefix}".`,
    );
  }
  return Object.freeze(plugin);
}

/**
 * Ejecutor Independiente de un único Microservicio (Modo Servidor Dedicado / Standalone).
 * Permite subir un solo `ms-*` en su propio VPS/contenedor independiente.
 */
export class StandaloneMicroserviceServer {
  private readonly routeMap = new Map<string, MicroserviceRouteDefinition>();

  constructor(
    public readonly plugin: Readonly<ProvekoMicroservicePlugin>,
    private readonly guard: DoubleKeyServiceGuard,
    public readonly serverNodeId: string = `standalone:${plugin.microserviceKey}`,
  ) {
    for (const route of plugin.routes) {
      const normalizedSubPath = route.subPath.startsWith('/') ? route.subPath : `/${route.subPath}`;
      this.routeMap.set(`${route.method}:${normalizedSubPath}`, route);
    }
  }

  public async handleRequest(req: MicroserviceHttpRequest): Promise<MicroserviceHttpResponse> {
    const cleanHeaders = sanitizeInboundTenantHeaders(req.headers);
    const authHeaderRaw = cleanHeaders['authorization'] ?? cleanHeaders['Authorization'];
    const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

    const normalizedPath = req.path.startsWith('/') ? req.path : `/${req.path}`;
    const route = this.routeMap.get(`${req.method}:${normalizedPath}`);

    if (!route) {
      return {
        status: 404,
        headers: {
          'content-type': 'application/problem+json',
          'x-proveko-served-by': this.serverNodeId,
        },
        body: {
          type: 'https://api.proveko.com/errors/not-found',
          title: 'Route Not Found',
          status: 404,
          detail: `No route found for ${req.method} ${normalizedPath} in microservice ${this.plugin.microserviceKey}.`,
        },
      };
    }

    try {
      const result = await this.guard.verifyAndExecute(
        {
          authorizationHeader,
          method: req.method,
          headers: cleanHeaders,
        },
        this.plugin.parentService,
        this.plugin.microserviceKey,
        async (verifiedCtx) =>
          route.handler(verifiedCtx, {
            ...req,
            headers: cleanHeaders,
          }),
      );

      return {
        status: req.method === 'POST' ? 201 : 200,
        headers: {
          'content-type': 'application/json',
          'x-proveko-served-by': this.serverNodeId,
          'x-proveko-service': this.plugin.parentService,
          'x-proveko-microservice': this.plugin.microserviceKey,
        },
        body: result,
      };
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        return {
          status: err.statusCode,
          headers: {
            'content-type': 'application/problem+json',
            'x-proveko-served-by': this.serverNodeId,
          },
          body: err.toProblemDetails(),
        };
      }
      throw err;
    }
  }
}

/**
 * Host-Runner Elástico por Servicio Padre (`srv:*`).
 * Permite montar todos los microservicios hijos en 1 solo servidor o filtrar con `ENABLED_MICROSERVICES`
 * cuáles corren en este servidor y cuáles fueron movidos a otro servidor dedicado.
 */
export class ParentServiceHostRunner {
  private readonly mountedMicroservices = new Map<MicroserviceKey, StandaloneMicroserviceServer>();

  constructor(
    public readonly parentService: ServiceKey,
    private readonly guard: DoubleKeyServiceGuard,
    plugins: ReadonlyArray<ProvekoMicroservicePlugin>,
    enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
    public readonly hostNodeId: string = `host-runner:${parentService}`,
  ) {
    const allowedSet = this.parseEnabledFilter(enabledMicroservicesEnv);

    for (const plugin of plugins) {
      if (plugin.parentService !== parentService) {
        throw new Error(
          `Cannot mount microservice "${plugin.microserviceKey}" (parent: "${plugin.parentService}") inside host-runner for "${parentService}".`,
        );
      }
      if (allowedSet && !allowedSet.has(plugin.microserviceKey)) {
        continue;
      }
      this.mountedMicroservices.set(
        plugin.microserviceKey,
        new StandaloneMicroserviceServer(
          plugin,
          this.guard,
          `${this.hostNodeId}[${plugin.microserviceKey}]`,
        ),
      );
    }
  }

  private parseEnabledFilter(
    filter?: string | ReadonlyArray<MicroserviceKey>,
  ): Set<MicroserviceKey> | null {
    if (!filter) return null;
    if (typeof filter !== 'string') {
      return new Set(filter);
    }
    const trimmed = filter.trim();
    if (!trimmed || trimmed === '*') return null;
    const keys = trimmed
      .split(',')
      .map((s: string) => s.trim() as MicroserviceKey)
      .filter(Boolean);
    return new Set(keys);
  }

  public getMountedMicroserviceKeys(): MicroserviceKey[] {
    return Array.from(this.mountedMicroservices.keys());
  }

  public hasMicroservice(msKey: MicroserviceKey): boolean {
    return this.mountedMicroservices.has(msKey);
  }

  public async dispatch(
    microserviceKey: MicroserviceKey,
    req: MicroserviceHttpRequest,
  ): Promise<MicroserviceHttpResponse> {
    const server = this.mountedMicroservices.get(microserviceKey);
    if (!server) {
      return {
        status: 503,
        headers: {
          'content-type': 'application/problem+json',
          'x-proveko-served-by': this.hostNodeId,
        },
        body: {
          type: 'https://api.proveko.com/errors/microservice-not-mounted-on-node',
          title: 'Microservice Not Mounted On This Host Runner',
          status: 503,
          error_code: PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
          detail: `Microservice "${microserviceKey}" is not mounted on host-runner "${this.hostNodeId}". Check UpstreamRouteRegistry or ENABLED_MICROSERVICES.`,
        },
      };
    }
    return server.handleRequest(req);
  }
}
