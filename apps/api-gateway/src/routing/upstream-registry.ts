import {
  type MicroserviceHttpRequest,
  type MicroserviceHttpResponse,
  type ParentServiceHostRunner,
  type StandaloneMicroserviceServer,
} from '@proveko/service-guard';
import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';

export interface UpstreamServerEndpoint {
  readonly serverId: string;
  readonly baseUrl: string;
  readonly mode: 'DEDICATED_MICROSERVICE_SERVER' | 'PARENT_SERVICE_HOST_RUNNER';
  readonly transport?: (
    microserviceKey: MicroserviceKey,
    req: MicroserviceHttpRequest,
  ) => Promise<MicroserviceHttpResponse>;
}

/**
 * Convierte 'ms:invoicing-electronic-dian' / 'mod:invoicing-electronic-dian' -> 'UPSTREAM_MS_INVOICING_ELECTRONIC_DIAN'
 */
export function toMicroserviceEnvVarName(msKeyInput: MicroserviceKey | ModuleKey): string {
  const msKey = normalizeModuleKey(msKeyInput);
  const normalized = msKey.replace(/^ms:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_MS_${normalized}`;
}

/**
 * Convierte 'mod:invoicing-electronic-dian' -> 'UPSTREAM_MOD_INVOICING_ELECTRONIC_DIAN'
 */
export function toModuleEnvVarName(modKeyInput: ModuleKey | MicroserviceKey): string {
  const msKey = normalizeModuleKey(modKeyInput);
  const normalized = msKey.replace(/^ms:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_MOD_${normalized}`;
}

/**
 * Convierte 'srv:invoicing' / 'ms:invoicing' -> 'UPSTREAM_SRV_INVOICING'
 */
export function toParentServiceEnvVarName(srvKeyInput: ServiceKey | ParentMicroserviceKey): string {
  const srvKey = normalizeParentMicroserviceKey(srvKeyInput);
  const normalized = srvKey.replace(/^srv:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_SRV_${normalized}`;
}

/**
 * Convierte 'ms:invoicing' -> 'UPSTREAM_MS_INVOICING'
 */
export function toParentMicroserviceEnvVarName(
  parentKeyInput: ParentMicroserviceKey | ServiceKey,
): string {
  const srvKey = normalizeParentMicroserviceKey(parentKeyInput);
  const normalized = srvKey.replace(/^srv:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_MS_${normalized}`;
}

/**
 * Registro Dinámico de 2 Niveles para distribuir Microservicios y Módulos en diferentes Servidores / VPS:
 * - Nivel 1 (Prioridad Alta): Servidor dedicado para un Módulo específico (`UPSTREAM_MOD_*` / `UPSTREAM_MS_*`).
 * - Nivel 2 (Fallback): Servidor del `host-runner` del Microservicio Padre (`UPSTREAM_MS_*` / `UPSTREAM_SRV_*`).
 */
export class UpstreamRouteRegistry {
  private readonly dedicatedMicroserviceServers = new Map<
    MicroserviceKey,
    UpstreamServerEndpoint
  >();
  private readonly parentServiceHostServers = new Map<ServiceKey, UpstreamServerEndpoint>();
  private readonly catalogByMicroservice = new Map<MicroserviceKey, ServiceKey>();

  constructor(env: Record<string, string | undefined> = process.env) {
    for (const item of SEED_MICROSERVICES_CATALOG) {
      this.catalogByMicroservice.set(item.key, item.parentService);

      // Cargar desde variables de entorno si están definidas (soporta UPSTREAM_MOD_* y UPSTREAM_MS_*)
      const modEnvKey = toModuleEnvVarName(item.key);
      const msEnvKey = toMicroserviceEnvVarName(item.key);
      const dedicatedUrl = env[modEnvKey] ?? env[msEnvKey];
      const usedEnvKey = env[modEnvKey] ? modEnvKey : msEnvKey;

      if (dedicatedUrl) {
        this.dedicatedMicroserviceServers.set(item.key, {
          serverId: `env:${usedEnvKey}`,
          baseUrl: dedicatedUrl.replace(/\/+$/, ''),
          mode: 'DEDICATED_MICROSERVICE_SERVER',
        });
      }

      const parentMsEnvKey = toParentMicroserviceEnvVarName(item.parentService);
      const srvEnvKey = toParentServiceEnvVarName(item.parentService);
      const srvUrl = env[srvEnvKey] ?? env[parentMsEnvKey];
      const usedParentEnvKey = env[srvEnvKey] ? srvEnvKey : parentMsEnvKey;

      if (srvUrl && !this.parentServiceHostServers.has(item.parentService)) {
        this.parentServiceHostServers.set(item.parentService, {
          serverId: `env:${usedParentEnvKey}`,
          baseUrl: srvUrl.replace(/\/+$/, ''),
          mode: 'PARENT_SERVICE_HOST_RUNNER',
        });
      }
    }
  }

  /**
   * Registra o mueve en caliente un Módulo (`mod:*` / `ms:*`) a un Servidor Dedicado propio.
   */
  public registerDedicatedMicroserviceServer(
    microserviceKeyInput: MicroserviceKey | ModuleKey,
    baseUrl: string,
    standaloneNode?: StandaloneMicroserviceServer,
  ): void {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    if (!this.catalogByMicroservice.has(microserviceKey)) {
      throw new Error(`Unknown microservice key: ${microserviceKey}`);
    }
    this.dedicatedMicroserviceServers.set(microserviceKey, {
      serverId: standaloneNode?.serverNodeId ?? `dedicated:${microserviceKey}@${baseUrl}`,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      mode: 'DEDICATED_MICROSERVICE_SERVER',
      transport: standaloneNode
        ? async (_msKey, req) => standaloneNode.handleRequest(req)
        : undefined,
    });
  }

  /**
   * Registra el Servidor del `host-runner` de un Microservicio Padre (`ms:*` / `srv:*`).
   */
  public registerParentServiceHostServer(
    parentServiceInput: ServiceKey | ParentMicroserviceKey,
    baseUrl: string,
    hostRunner?: ParentServiceHostRunner,
  ): void {
    const parentService = normalizeParentMicroserviceKey(parentServiceInput);
    this.parentServiceHostServers.set(parentService, {
      serverId: hostRunner?.hostNodeId ?? `host-runner:${parentService}@${baseUrl}`,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      mode: 'PARENT_SERVICE_HOST_RUNNER',
      transport: hostRunner
        ? async (msKey, req) => hostRunner.dispatch(msKey, req)
        : undefined,
    });
  }

  /**
   * Remueve el override dedicado de un módulo para que regrese al servidor de su Microservicio Padre.
   */
  public removeDedicatedMicroserviceServer(
    microserviceKeyInput: MicroserviceKey | ModuleKey,
  ): void {
    this.dedicatedMicroserviceServers.delete(normalizeModuleKey(microserviceKeyInput));
  }

  /**
   * Resuelve a qué servidor físico/contenedor debe enviarse la petición:
   * 1. Valida que el Módulo pertenezca realmente al Microservicio Padre indicado en la ruta.
   * 2. Si el Módulo tiene un Servidor Dedicado (`DEDICATED_MICROSERVICE_SERVER`), lo elige.
   * 3. Si no, elige el Servidor `host-runner` del Microservicio Padre (`PARENT_SERVICE_HOST_RUNNER`).
   */
  public resolveTargetServer(
    parentServiceInput: ServiceKey | ParentMicroserviceKey,
    microserviceKeyInput: MicroserviceKey | ModuleKey,
  ): UpstreamServerEndpoint {
    const parentService = normalizeParentMicroserviceKey(parentServiceInput);
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    const officialParent = this.catalogByMicroservice.get(microserviceKey);
    if (!officialParent || officialParent !== parentService) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
        400,
        `Module "${microserviceKey}" does not belong to parent microservice "${parentService}".`,
        { parent_service: parentService, microservice: microserviceKey },
      );
    }

    // Nivel 1: ¿Tiene este módulo un servidor dedicado propio?
    const dedicated = this.dedicatedMicroserviceServers.get(microserviceKey);
    if (dedicated) {
      return dedicated;
    }

    // Nivel 2: Fallback al servidor del Microservicio Padre (Host-Runner)
    const parentHost = this.parentServiceHostServers.get(parentService);
    if (parentHost) {
      return parentHost;
    }

    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_UPSTREAM_UNAVAILABLE,
      502,
      `No upstream server configured for module "${microserviceKey}" nor parent "${parentService}".`,
      { parent_service: parentService, microservice: microserviceKey },
    );
  }

  public getTopologySnapshot(): Array<{
    microserviceKey: MicroserviceKey;
    parentService: ServiceKey;
    resolvedMode: 'DEDICATED_MICROSERVICE_SERVER' | 'PARENT_SERVICE_HOST_RUNNER' | 'UNCONFIGURED';
    targetBaseUrl: string | null;
    serverId: string | null;
  }> {
    return SEED_MICROSERVICES_CATALOG.map((item) => {
      const dedicated = this.dedicatedMicroserviceServers.get(item.key);
      if (dedicated) {
        return {
          microserviceKey: item.key,
          parentService: item.parentService,
          resolvedMode: dedicated.mode,
          targetBaseUrl: dedicated.baseUrl,
          serverId: dedicated.serverId,
        };
      }
      const parent = this.parentServiceHostServers.get(item.parentService);
      if (parent) {
        return {
          microserviceKey: item.key,
          parentService: item.parentService,
          resolvedMode: parent.mode,
          targetBaseUrl: parent.baseUrl,
          serverId: parent.serverId,
        };
      }
      return {
        microserviceKey: item.key,
        parentService: item.parentService,
        resolvedMode: 'UNCONFIGURED',
        targetBaseUrl: null,
        serverId: null,
      };
    });
  }
}

