import {
  type MicroserviceKey,
  type ProvekoJwtClaims,
  type ServiceKey,
  resolveMicroserviceAccess,
} from '@proveko/shared-kernel';

export type WorkstationScreenViewState =
  | {
      mode: 'FULL_INTERACTIVE';
      parentService: ServiceKey;
      microservice: MicroserviceKey;
      allowCreateAndEdit: true;
      allowHistoricalReadAndExport: true;
      bannerMessage: null;
    }
  | {
      mode: 'READONLY_ARCHIVE_BANNER';
      parentService: ServiceKey;
      microservice: MicroserviceKey;
      supersededBy: MicroserviceKey | null;
      allowCreateAndEdit: false;
      allowHistoricalReadAndExport: true;
      bannerMessage: string;
    }
  | {
      mode: 'PARENT_GATEKEEPER_EMPTY_CONTAINER';
      parentService: ServiceKey;
      allowCreateAndEdit: false;
      allowHistoricalReadAndExport: false;
      bannerMessage: string;
    }
  | {
      mode: 'LOCKED_UPSELL_PREVIEW';
      parentService: ServiceKey;
      microservice: MicroserviceKey;
      reason: 'PARENT_SERVICE_DISABLED' | 'MICROSERVICE_DISABLED';
      allowCreateAndEdit: false;
      allowHistoricalReadAndExport: false;
      bannerMessage: string;
    };

/**
 * Evaluador de `<CapabilityGate>` y `<ReadonlyArchiveBanner>` en la Estación de Trabajo (`/app/*`):
 * 1. Si el Servicio Padre está habilitado pero tiene 0 microservicios hijos activos (`srv:inventory: []`),
 *    no expone pantallas operativas y muestra el selector para habilitar al menos 1 microservicio del grupo.
 * 2. Si el Microservicio fue reemplazado (`supersedes`), activa `READONLY_ARCHIVE_BANNER` ocultando botones
 *    de creación/edición y manteniendo intacta la consulta histórica.
 */
export function evaluateWorkstationCapabilityGate(
  claims: Pick<ProvekoJwtClaims, 'services' | 'readonly_microservices'>,
  parentService: ServiceKey,
  targetMicroservice?: MicroserviceKey,
): WorkstationScreenViewState {
  const activeChildren = claims.services[parentService];

  if (!targetMicroservice) {
    if (Array.isArray(activeChildren) && activeChildren.length === 0) {
      return {
        mode: 'PARENT_GATEKEEPER_EMPTY_CONTAINER',
        parentService,
        allowCreateAndEdit: false,
        allowHistoricalReadAndExport: false,
        bannerMessage: `El Servicio Padre "${parentService}" está habilitado como contenedor, pero debes activar al menos un Microservicio hijo del grupo para operar pantallas.`,
      };
    }
  }

  const msKey = targetMicroservice!;
  const access = resolveMicroserviceAccess(claims, parentService, msKey);

  if (access.access === 'ACTIVE') {
    return {
      mode: 'FULL_INTERACTIVE',
      parentService,
      microservice: msKey,
      allowCreateAndEdit: true,
      allowHistoricalReadAndExport: true,
      bannerMessage: null,
    };
  }

  if (access.access === 'READONLY_ARCHIVE') {
    return {
      mode: 'READONLY_ARCHIVE_BANNER',
      parentService,
      microservice: msKey,
      supersededBy: access.supersededBy ?? null,
      allowCreateAndEdit: false,
      allowHistoricalReadAndExport: true,
      bannerMessage: `Modo Archivo Histórico (Solo Lectura): Este microservicio ("${msKey}") fue reemplazado por "${access.supersededBy ?? 'un módulo superior'}". Puedes consultar y exportar todo tu historial; las nuevas emisiones se realizan en el módulo activo.`,
    };
  }

  return {
    mode: 'LOCKED_UPSELL_PREVIEW',
    parentService,
    microservice: msKey,
    reason: access.reason,
    allowCreateAndEdit: false,
    allowHistoricalReadAndExport: false,
    bannerMessage:
      access.reason === 'PARENT_SERVICE_DISABLED'
        ? `Para usar "${msKey}" primero debes habilitar el Servicio Padre "${parentService}".`
        : `El microservicio "${msKey}" no está activo en tu suscripción actual.`,
  };
}
