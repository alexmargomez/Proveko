import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  type ProvekoJwtClaims,
  resolveMicroserviceAccess,
  type ServiceKey,
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
      microservice?: MicroserviceKey;
      reason: 'PARENT_SERVICE_DISABLED' | 'MICROSERVICE_DISABLED';
      allowCreateAndEdit: false;
      allowHistoricalReadAndExport: false;
      bannerMessage: string;
    };

/**
 * Evaluador de `<CapabilityGate>` y `<ReadonlyArchiveBanner>` en la Estación de Trabajo (`/app/*`):
 * 1. Si el Microservicio Contenedor (`ms:*` / `srv:*`) no está habilitado, retorna `LOCKED_UPSELL_PREVIEW`
 *    (`PARENT_SERVICE_DISABLED`).
 * 2. Si el Microservicio Contenedor está habilitado pero tiene 0 módulos hijos activos (`[]`) y el módulo
 *    consultado no está en archivo histórico, retorna `PARENT_GATEKEEPER_EMPTY_CONTAINER` sin importar si se
 *    pasó o no `targetMicroservice`.
 * 3. Si el Módulo fue reemplazado (`supersedes`), activa `READONLY_ARCHIVE_BANNER` ocultando botones
 *    de creación/edición y manteniendo intacta la consulta histórica.
 */
export function evaluateWorkstationCapabilityGate(
  claims: Pick<ProvekoJwtClaims, 'services' | 'readonly_microservices'>,
  parentServiceInput: ParentMicroserviceKey | ServiceKey,
  targetModuleInput?: ModuleKey | MicroserviceKey,
): WorkstationScreenViewState {
  const parentService = normalizeParentMicroserviceKey(parentServiceInput);
  const targetMicroservice = targetModuleInput
    ? normalizeModuleKey(targetModuleInput)
    : undefined;
  const activeChildren = claims.services[parentService];

  if (!Array.isArray(activeChildren)) {
    return {
      mode: 'LOCKED_UPSELL_PREVIEW',
      parentService,
      microservice: targetMicroservice,
      reason: 'PARENT_SERVICE_DISABLED',
      allowCreateAndEdit: false,
      allowHistoricalReadAndExport: false,
      bannerMessage: targetMicroservice
        ? `Para usar "${targetMicroservice}" primero debes habilitar el Microservicio Padre "${parentService}".`
        : `El Microservicio Padre "${parentService}" no está habilitado en tu suscripción actual.`,
    };
  }

  // Si no se especificó un módulo objetivo y el contenedor tiene 0 módulos activos:
  if (!targetMicroservice) {
    if (activeChildren.length === 0) {
      return {
        mode: 'PARENT_GATEKEEPER_EMPTY_CONTAINER',
        parentService,
        allowCreateAndEdit: false,
        allowHistoricalReadAndExport: false,
        bannerMessage: `El Microservicio Padre "${parentService}" está habilitado como contenedor, pero debes activar al menos un Módulo hijo del grupo para operar pantallas.`,
      };
    }
    const defaultModule = activeChildren[0]!;
    return {
      mode: 'FULL_INTERACTIVE',
      parentService,
      microservice: defaultModule,
      allowCreateAndEdit: true,
      allowHistoricalReadAndExport: true,
      bannerMessage: null,
    };
  }

  const access = resolveMicroserviceAccess(claims, parentService, targetMicroservice);

  if (access.access === 'ACTIVE') {
    return {
      mode: 'FULL_INTERACTIVE',
      parentService,
      microservice: targetMicroservice,
      allowCreateAndEdit: true,
      allowHistoricalReadAndExport: true,
      bannerMessage: null,
    };
  }

  if (access.access === 'READONLY_ARCHIVE') {
    return {
      mode: 'READONLY_ARCHIVE_BANNER',
      parentService,
      microservice: targetMicroservice,
      supersededBy: access.supersededBy ?? null,
      allowCreateAndEdit: false,
      allowHistoricalReadAndExport: true,
      bannerMessage: `Modo Archivo Histórico (Solo Lectura): Este módulo ("${targetMicroservice}") fue reemplazado por "${access.supersededBy ?? 'un módulo superior'}". Puedes consultar y exportar todo tu historial; las nuevas emisiones se realizan en el módulo activo.`,
    };
  }

  // Si el contenedor está vacío (0 módulos activos) y el módulo solicitado tampoco está en READONLY_ARCHIVE,
  // informamos que el contenedor padre no tiene módulos activos aún.
  if (activeChildren.length === 0) {
    return {
      mode: 'PARENT_GATEKEEPER_EMPTY_CONTAINER',
      parentService,
      allowCreateAndEdit: false,
      allowHistoricalReadAndExport: false,
      bannerMessage: `El Microservicio Padre "${parentService}" está habilitado como contenedor, pero debes activar al menos un Módulo hijo del grupo para operar pantallas.`,
    };
  }

  return {
    mode: 'LOCKED_UPSELL_PREVIEW',
    parentService,
    microservice: targetMicroservice,
    reason: access.reason,
    allowCreateAndEdit: false,
    allowHistoricalReadAndExport: false,
    bannerMessage:
      access.reason === 'PARENT_SERVICE_DISABLED'
        ? `Para usar "${targetMicroservice}" primero debes habilitar el Microservicio Padre "${parentService}".`
        : `El módulo "${targetMicroservice}" no está activo en tu suscripción actual.`,
  };
}

