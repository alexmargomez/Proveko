import {
  type MicroserviceKey,
  type MicroserviceSeedDefinition,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';
import type {
  TenantMicroserviceSubscriptionEntity,
  TenantServiceSubscriptionEntity,
} from '../entities/core-entities.js';

export interface ActivationTransitionPlan {
  targetMicroservice: MicroserviceSeedDefinition;
  /** Microservicios que deben pasar atómicamente a READONLY_ARCHIVE por `supersedes` o `mutex_group` */
  toReadonlyArchive: Array<{
    microserviceKey: MicroserviceKey;
    supersededByKey: MicroserviceKey;
    reason: 'SUPERSEDED' | 'MUTEX_GROUP_REPLACED';
  }>;
  /** Indica si se trata de una reactivación reversible desde READONLY_ARCHIVE */
  isReactivatingFromReadonlyArchive: boolean;
}

/**
 * Motor Puro del Grafo de Servicios y Microservicios [P1-04] & [P2-01]
 * Gobierna:
 * 1. Regla del Servicio Padre Gatekeeper (`parent_service` obligatorio).
 * 2. Validación de prerrequisitos (`requiresServices` y `requiresMicroservices`).
 * 3. Reemplazo automático (`supersedes` -> `READONLY_ARCHIVE`).
 * 4. Exclusión mutua (`mutex_group` -> efecto Radio Button pasando el anterior a `READONLY_ARCHIVE`).
 * 5. Validación de dependencias inversas (`reverse_requires`) antes de permitir desactivar un microservicio.
 * 6. Reversibilidad garantizada `READONLY_ARCHIVE <-> ACTIVE` con cero pérdida de datos.
 */
export class CapabilityGraphEngine {
  private readonly catalogMap = new Map<MicroserviceKey, MicroserviceSeedDefinition>();

  constructor(
    catalog: readonly MicroserviceSeedDefinition[] = SEED_MICROSERVICES_CATALOG,
  ) {
    for (const item of catalog) {
      this.catalogMap.set(item.key, item);
    }
  }

  public getDefinition(key: MicroserviceKey): MicroserviceSeedDefinition {
    const def = this.catalogMap.get(key);
    if (!def) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Microservice definition "${key}" does not exist in catalog.`,
      );
    }
    return def;
  }

  public planMicroserviceActivation(
    targetKey: MicroserviceKey,
    currentServices: readonly TenantServiceSubscriptionEntity[],
    currentMicroservices: readonly TenantMicroserviceSubscriptionEntity[],
  ): ActivationTransitionPlan {
    const targetDef = this.getDefinition(targetKey);

    const activeServiceSet = new Set<ServiceKey>(
      currentServices.filter((s) => s.status === 'ACTIVE').map((s) => s.serviceKey),
    );

    // 1. Verificar que su Servicio Padre Gatekeeper esté ACTIVO
    if (!activeServiceSet.has(targetDef.parentService)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_PARENT_SERVICE_DISABLED,
        422,
        `Cannot activate "${targetKey}" because its parent service gatekeeper "${targetDef.parentService}" is not enabled.`,
        {
          microservice: targetKey,
          missing_parent_service: targetDef.parentService,
        },
      );
    }

    // 2. Verificar que todos los Servicios Padres requeridos estén ACTIVOS
    const missingServices = targetDef.requiresServices.filter((s) => !activeServiceSet.has(s));
    if (missingServices.length > 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
        422,
        `Missing required parent services for "${targetKey}": ${missingServices.join(', ')}`,
        {
          microservice: targetKey,
          missing_services: missingServices,
        },
      );
    }

    // 3. Verificar que todos los Microservicios base requeridos estén ACTIVOS
    const activeMsSet = new Set<MicroserviceKey>(
      currentMicroservices
        .filter((m) => m.status === 'ACTIVE' && activeServiceSet.has(m.parentServiceKey))
        .map((m) => m.microserviceKey),
    );

    const missingMicroservices = targetDef.requiresMicroservices.filter(
      (reqKey) => !activeMsSet.has(reqKey),
    );
    if (missingMicroservices.length > 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
        422,
        `Cannot activate "${targetKey}" without active prerequisite microservices: ${missingMicroservices.join(', ')}`,
        {
          microservice: targetKey,
          missing_microservices: missingMicroservices,
        },
      );
    }

    // 4. Evaluar si existe otro microservicio en estado PROVISIONING del mismo mutex_group (protección TOCTOU en dominio)
    if (targetDef.mutexGroup) {
      const concurrentProvisioning = currentMicroservices.find(
        (m) =>
          m.microserviceKey !== targetKey &&
          m.mutexGroup === targetDef.mutexGroup &&
          m.status === 'PROVISIONING',
      );
      if (concurrentProvisioning) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_MUTEX_GROUP_CONFLICT,
          409,
          `Another microservice ("${concurrentProvisioning.microserviceKey}") in mutex_group "${targetDef.mutexGroup}" is currently provisioning.`,
          {
            mutex_group: targetDef.mutexGroup,
            conflicting_microservice: concurrentProvisioning.microserviceKey,
          },
        );
      }
    }

    // 5. Calcular transiciones automáticas a READONLY_ARCHIVE por `supersedes` y por `mutex_group`
    const toReadonlyMap = new Map<
      MicroserviceKey,
      {
        microserviceKey: MicroserviceKey;
        supersededByKey: MicroserviceKey;
        reason: 'SUPERSEDED' | 'MUTEX_GROUP_REPLACED';
      }
    >();

    for (const supersededKey of targetDef.supersedes) {
      if (activeMsSet.has(supersededKey)) {
        toReadonlyMap.set(supersededKey, {
          microserviceKey: supersededKey,
          supersededByKey: targetKey,
          reason: 'SUPERSEDED',
        });
      }
    }

    if (targetDef.mutexGroup) {
      for (const existing of currentMicroservices) {
        if (
          existing.microserviceKey !== targetKey &&
          existing.status === 'ACTIVE' &&
          existing.mutexGroup === targetDef.mutexGroup &&
          !toReadonlyMap.has(existing.microserviceKey)
        ) {
          toReadonlyMap.set(existing.microserviceKey, {
            microserviceKey: existing.microserviceKey,
            supersededByKey: targetKey,
            reason: 'MUTEX_GROUP_REPLACED',
          });
        }
      }
    }

    const existingTargetRecord = currentMicroservices.find(
      (m) => m.microserviceKey === targetKey,
    );

    return {
      targetMicroservice: targetDef,
      toReadonlyArchive: Array.from(toReadonlyMap.values()),
      isReactivatingFromReadonlyArchive:
        existingTargetRecord?.status === 'READONLY_ARCHIVE',
    };
  }

  /**
   * Verifica dependencias inversas (`reverse_requires`) antes de permitir desactivar un microservicio [P2-01]
   */
  public assertCanDeactivateMicroservice(
    targetKey: MicroserviceKey,
    currentMicroservices: readonly TenantMicroserviceSubscriptionEntity[],
  ): void {
    const activeMsKeys = currentMicroservices
      .filter((m) => m.status === 'ACTIVE' && m.microserviceKey !== targetKey)
      .map((m) => m.microserviceKey);

    const activeDependents: MicroserviceKey[] = [];
    for (const activeKey of activeMsKeys) {
      const def = this.getDefinition(activeKey);
      if (def.requiresMicroservices.includes(targetKey)) {
        activeDependents.push(activeKey);
      }
    }

    if (activeDependents.length > 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_DEPENDENT_MICROSERVICES_ACTIVE,
        409,
        `Cannot deactivate "${targetKey}" because active microservices depend on it: ${activeDependents.join(', ')}`,
        {
          microservice: targetKey,
          dependent_microservices: activeDependents,
        },
      );
    }
  }

  /**
   * Verifica dependencias cruzadas entre Microservicios Padres antes de permitir apagar un contenedor (`srv:*` / `ms:*`).
   * Si algún módulo activo de OTRO Microservicio Padre requiere este contenedor o alguno de sus módulos hijos,
   * bloquea la desactivación con `409 ERR_DEPENDENT_MICROSERVICES_ACTIVE`.
   */
  public assertCanDeactivateParentService(
    targetServiceKey: ServiceKey,
    currentServices: readonly TenantServiceSubscriptionEntity[],
    currentMicroservices: readonly TenantMicroserviceSubscriptionEntity[],
  ): void {
    const activeServiceSet = new Set<ServiceKey>(
      currentServices.filter((s) => s.status === 'ACTIVE').map((s) => s.serviceKey),
    );

    const externalActiveModules = currentMicroservices.filter(
      (m) =>
        m.status === 'ACTIVE' &&
        m.parentServiceKey !== targetServiceKey &&
        activeServiceSet.has(m.parentServiceKey),
    );

    const externalDependents: MicroserviceKey[] = [];
    for (const extMod of externalActiveModules) {
      const def = this.getDefinition(extMod.microserviceKey);
      const dependsOnParentDirectly = def.requiresServices.includes(targetServiceKey);
      const dependsOnChildOfTarget = def.requiresMicroservices.some((reqMs) => {
        const reqDef = this.getDefinition(reqMs);
        return reqDef.parentService === targetServiceKey;
      });
      if (dependsOnParentDirectly || dependsOnChildOfTarget) {
        externalDependents.push(extMod.microserviceKey);
      }
    }

    if (externalDependents.length > 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_DEPENDENT_MICROSERVICES_ACTIVE,
        409,
        `Cannot deactivate parent service "${targetServiceKey}" because active modules in other parent services depend on it: ${externalDependents.join(', ')}`,
        {
          parent_service: targetServiceKey,
          dependent_microservices: externalDependents,
        },
      );
    }
  }
}

