import {
  type MicroserviceKey,
  type ModuleKey,
  PROVEKO_ERROR_CODES,
  type ParentMicroserviceKey,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  toModuleNotation,
  toParentMicroserviceNotation,
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

export type MicroserviceRouteHandler<TBody = unknown, TResult = unknown> = (
  ctx: Readonly<VerifiedTenantContext>,
  req: MicroserviceHttpRequest<TBody>,
) => Promise<TResult>;

export interface MicroserviceRouteDefinition<TBody = unknown, TResult = unknown> {
  method: HttpMethodType;
  subPath: string; // ej. "/items" o "/invoices/emit"
  description: string;
  successStatusCode?: number;
  handler: MicroserviceRouteHandler<TBody, TResult>;
}

export interface ProvekoMicroservicePlugin {
  readonly parentService: ServiceKey;
  readonly microserviceKey: MicroserviceKey;
  readonly tablePrefix: string;
  readonly version: string;
  readonly routes: ReadonlyArray<MicroserviceRouteDefinition<any, any>>;
}

/**
 * Valida en tiempo de registro que el Módulo (`mod:*` / `ms:*`) corresponda a su Microservicio Padre oficial (`ms:*` / `srv:*`)
 * y respete el prefijo de tablas del catálogo maestro.
 */
export function defineProvekoMicroservice(plugin: {
  readonly parentService: ServiceKey | ParentMicroserviceKey;
  readonly microserviceKey: MicroserviceKey | ModuleKey;
  readonly tablePrefix: string;
  readonly version: string;
  readonly routes: ReadonlyArray<MicroserviceRouteDefinition<any, any>>;
}): Readonly<ProvekoMicroservicePlugin> {
  const normalizedParent = normalizeParentMicroserviceKey(plugin.parentService);
  const normalizedModule = normalizeModuleKey(plugin.microserviceKey);

  const catalogDef = SEED_MICROSERVICES_CATALOG.find((m) => m.key === normalizedModule);
  if (!catalogDef) {
    throw new Error(
      `Module "${normalizedModule}" is not registered in SEED_MICROSERVICES_CATALOG.`,
    );
  }
  if (catalogDef.parentService !== normalizedParent) {
    throw new Error(
      `Module "${normalizedModule}" belongs to parent "${catalogDef.parentService}", not "${normalizedParent}".`,
    );
  }
  if (catalogDef.tablePrefix !== plugin.tablePrefix) {
    throw new Error(
      `Module "${normalizedModule}" must use table prefix "${catalogDef.tablePrefix}", received "${plugin.tablePrefix}".`,
    );
  }
  return Object.freeze({
    ...plugin,
    parentService: normalizedParent,
    microserviceKey: normalizedModule,
  });
}

export const defineProvekoModule = defineProvekoMicroservice;

/**
 * Ejecutor Independiente de un Módulo / Microservicio (Modo Servidor Dedicado / Standalone).
 */
export class StandaloneMicroserviceServer {
  private readonly routeMap = new Map<string, MicroserviceRouteDefinition<any, any>>();

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

    const [pathOnly] = req.path.split('?');
    const normalizedPath = (pathOnly ?? '/').startsWith('/') ? (pathOnly ?? '/') : `/${pathOnly}`;
    const route = this.routeMap.get(`${req.method}:${normalizedPath}`);

    if (!route) {
      return {
        status: 404,
        headers: {
          'content-type': 'application/problem+json',
          'x-proveko-served-by': this.serverNodeId,
        },
        body: {
          type: 'https://errors.proveko.com/err_not_found',
          title: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          status: 404,
          error_code: PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          detail: `No route found for ${req.method} ${normalizedPath} in module ${this.plugin.microserviceKey}.`,
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
            path: normalizedPath,
            headers: cleanHeaders,
          }),
      );

      const defaultStatus = req.method === 'POST' ? 201 : 200;
      return {
        status: route.successStatusCode ?? defaultStatus,
        headers: {
          'content-type': 'application/json',
          'x-proveko-served-by': this.serverNodeId,
          'x-proveko-service': this.plugin.parentService,
          'x-proveko-microservice': this.plugin.microserviceKey,
          'x-proveko-parent-microservice': toParentMicroserviceNotation(this.plugin.parentService),
          'x-proveko-module': toModuleNotation(this.plugin.microserviceKey),
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

      const wrapped = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        err instanceof Error ? err.message : 'Invalid request payload.',
      );
      return {
        status: wrapped.statusCode,
        headers: {
          'content-type': 'application/problem+json',
          'x-proveko-served-by': this.serverNodeId,
        },
        body: wrapped.toProblemDetails(),
      };
    }
  }
}

/**
 * Host-Runner Elástico por Microservicio Padre (`ms:*` / `srv:*`).
 * Permite montar todos sus módulos hijos en 1 solo servidor o filtrar con `ENABLED_MICROSERVICES` / `ENABLED_MODULES`
 * cuáles corren en este servidor y cuáles fueron movidos a otro servidor dedicado.
 */
export class ParentServiceHostRunner {
  private readonly mountedMicroservices = new Map<MicroserviceKey, StandaloneMicroserviceServer>();
  public readonly parentService: ServiceKey;

  constructor(
    parentServiceInput: ServiceKey | ParentMicroserviceKey,
    private readonly guard: DoubleKeyServiceGuard,
    plugins: ReadonlyArray<ProvekoMicroservicePlugin>,
    enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey | ModuleKey>,
    public readonly hostNodeId: string = `host-runner:${parentServiceInput}`,
  ) {
    this.parentService = normalizeParentMicroserviceKey(parentServiceInput);
    const allowedSet = this.parseEnabledFilter(enabledMicroservicesEnv);

    for (const plugin of plugins) {
      if (plugin.parentService !== this.parentService) {
        throw new Error(
          `Cannot mount module "${plugin.microserviceKey}" (parent: "${plugin.parentService}") inside host-runner for "${this.parentService}".`,
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
    filter?: string | ReadonlyArray<MicroserviceKey | ModuleKey>,
  ): Set<MicroserviceKey> | null {
    if (!filter) return null;
    if (typeof filter !== 'string') {
      return new Set(filter.map((k) => normalizeModuleKey(k)));
    }
    const trimmed = filter.trim();
    if (!trimmed || trimmed === '*') return null;
    const keys = trimmed
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((k) => normalizeModuleKey(k));
    return new Set(keys);
  }

  public getMountedMicroserviceKeys(): MicroserviceKey[] {
    return Array.from(this.mountedMicroservices.keys());
  }

  public hasMicroservice(msKeyInput: MicroserviceKey | ModuleKey): boolean {
    return this.mountedMicroservices.has(normalizeModuleKey(msKeyInput));
  }

  public async dispatch(
    microserviceKeyInput: MicroserviceKey | ModuleKey,
    req: MicroserviceHttpRequest,
  ): Promise<MicroserviceHttpResponse> {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    const server = this.mountedMicroservices.get(microserviceKey);
    if (!server) {
      return {
        status: 503,
        headers: {
          'content-type': 'application/problem+json',
          'x-proveko-served-by': this.hostNodeId,
        },
        body: {
          type: 'https://errors.proveko.com/err_microservice_disabled',
          title: 'Module Not Mounted On This Host Runner',
          status: 503,
          error_code: PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
          detail: `Module "${microserviceKey}" is not mounted on host-runner "${this.hostNodeId}". Check UpstreamRouteRegistry or ENABLED_MICROSERVICES.`,
        },
      };
    }
    return server.handleRequest(req);
  }
}
