import {
  type MicroserviceHttpRequest,
  type MicroserviceHttpResponse,
  type ParentServiceHostRunner,
  type StandaloneMicroserviceServer,
} from '@proveko/service-guard';
import {
  type MicroserviceKey,
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
 * Convierte 'ms:invoicing-electronic-dian' -> 'UPSTREAM_MS_INVOICING_ELECTRONIC_DIAN'
 */
export function toMicroserviceEnvVarName(msKey: MicroserviceKey): string {
  const normalized = msKey.replace(/^ms:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_MS_${normalized}`;
}

/**
 * Convierte 'srv:invoicing' -> 'UPSTREAM_SRV_INVOICING'
 */
export function toParentServiceEnvVarName(srvKey: ServiceKey): string {
  const normalized = srvKey.replace(/^srv:/, '').replace(/-/g, '_').toUpperCase();
  return `UPSTREAM_SRV_${normalized}`;
}

/**
 * Registro Dinámico de 2 Niveles para distribuir Microservicios en diferentes Servidores / VPS:
 * - Nivel 1 (Prioridad Alta): Servidor dedicado para un Microservicio específico (`UPSTREAM_MS_*`).
 * - Nivel 2 (Fallback): Servidor del `host-runner` del Servicio Padre (`UPSTREAM_SRV_*`).
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

      // Cargar desde variables de entorno si están definidas
      const msEnvKey = toMicroserviceEnvVarName(item.key);
      const msUrl = env[msEnvKey];
      if (msUrl) {
        this.dedicatedMicroserviceServers.set(item.key, {
          serverId: `env:${msEnvKey}`,
          baseUrl: msUrl.replace(/\/+$/, ''),
          mode: 'DEDICATED_MICROSERVICE_SERVER',
        });
      }

      const srvEnvKey = toParentServiceEnvVarName(item.parentService);
      const srvUrl = env[srvEnvKey];
      if (srvUrl && !this.parentServiceHostServers.has(item.parentService)) {
        this.parentServiceHostServers.set(item.parentService, {
          serverId: `env:${srvEnvKey}`,
          baseUrl: srvUrl.replace(/\/+$/, ''),
          mode: 'PARENT_SERVICE_HOST_RUNNER',
        });
      }
    }
  }

  /**
   * Registra o mueve en caliente un Microservicio (`ms:*`) a un Servidor Dedicado propio.
   */
  public registerDedicatedMicroserviceServer(
    microserviceKey: MicroserviceKey,
    baseUrl: string,
    standaloneNode?: StandaloneMicroserviceServer,
  ): void {
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
   * Registra el Servidor del `host-runner` de un Servicio Padre (`srv:*`).
   */
  public registerParentServiceHostServer(
    parentService: ServiceKey,
    baseUrl: string,
    hostRunner?: ParentServiceHostRunner,
  ): void {
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
   * Remueve el override dedicado de un microservicio para que regrese al servidor de su Servicio Padre.
   */
  public removeDedicatedMicroserviceServer(microserviceKey: MicroserviceKey): void {
    this.dedicatedMicroserviceServers.delete(microserviceKey);
  }

  /**
   * Resuelve a qué servidor físico/contenedor debe enviarse la petición:
   * 1. Valida que el Microservicio pertenezca realmente al Servicio Padre indicado en la ruta.
   * 2. Si el Microservicio tiene un Servidor Dedicado (`DEDICATED_MICROSERVICE_SERVER`), lo elige.
   * 3. Si no, elige el Servidor `host-runner` del Servicio Padre (`PARENT_SERVICE_HOST_RUNNER`).
   */
  public resolveTargetServer(
    parentService: ServiceKey,
    microserviceKey: MicroserviceKey,
  ): UpstreamServerEndpoint {
    const officialParent = this.catalogByMicroservice.get(microserviceKey);
    if (!officialParent || officialParent !== parentService) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
        400,
        `Microservice "${microserviceKey}" does not belong to parent service "${parentService}".`,
        { parent_service: parentService, microservice: microserviceKey },
      );
    }

    // Nivel 1: ¿Tiene este microservicio un servidor dedicado propio?
    const dedicated = this.dedicatedMicroserviceServers.get(microserviceKey);
    if (dedicated) {
      return dedicated;
    }

    // Nivel 2: Fallback al servidor del Servicio Padre (Host-Runner)
    const parentHost = this.parentServiceHostServers.get(parentService);
    if (parentHost) {
      return parentHost;
    }

    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
      502,
      `No upstream server configured for microservice "${microserviceKey}" nor parent "${parentService}".`,
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
