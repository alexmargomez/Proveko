import crypto from 'node:crypto';
import {
  type ActiveServicesTree,
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  type TenantMicroserviceSubscriptionEntity,
  buildJwtCapabilitiesProjection,
} from '../../domain/entities/core-entities.js';
import type {
  DatabaseCellRepositoryPort,
  SubscriptionCatalogRepositoryPort,
  TenantRepositoryPort,
} from '../../domain/ports/repositories.port.js';
import { CapabilityGraphEngine } from '../../domain/services/capability-graph.engine.js';
import type {
  ControlOutboxPort,
  TenantDatabaseProvisionerPort,
  TenantStateCachePort,
  UnitOfWorkPort,
} from '../ports/outbound.ports.js';

export interface CapabilityMutationResult {
  tenantId: string;
  subVer: number;
  services: ActiveServicesTree;
  readonlyMicroservices: MicroserviceKey[];
  supersededToReadonly: MicroserviceKey[];
  appliedMigrations: string[];
}

export class CatalogCapabilityUseCases {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly cellRepo: DatabaseCellRepositoryPort,
    private readonly catalogRepo: SubscriptionCatalogRepositoryPort,
    private readonly graphEngine: CapabilityGraphEngine,
    private readonly dbProvisioner: TenantDatabaseProvisionerPort,
    private readonly stateCache: TenantStateCachePort,
    private readonly outbox: ControlOutboxPort,
  ) {}

  /**
   * Habilita un Microservicio Padre Gatekeeper (`ms:*` / `srv:*`) y aprovisiona su esquema `srv_*` en la Celda
   */
  public async activateParentService(
    tenantId: string,
    serviceKeyInput: ParentMicroserviceKey | ServiceKey,
  ): Promise<CapabilityMutationResult> {
    const serviceKey = normalizeParentMicroserviceKey(serviceKeyInput);
    let targetCellId = '';
    let targetDbName = '';

    await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          404,
          `Tenant "${tenantId}" not found.`,
        );
      }
      targetCellId = tenant.cellId;
      targetDbName = tenant.dbName;
    });

    const cell = await this.cellRepo.findById(targetCellId);
    if (!cell) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Database cell "${targetCellId}" not found.`,
      );
    }

    // Crear esquema vacío `srv_*` de forma idempotente por `adminPort`
    await this.dbProvisioner.provisionServiceSchemaAndMigrations(
      cell,
      targetDbName,
      serviceKey,
    );

    const result = await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(PROVEKO_ERROR_CODES.ERR_NOT_FOUND, 404, 'Tenant not found.');
      }

      await this.catalogRepo.upsertParentService(
        {
          tenantId,
          serviceKey,
          status: 'ACTIVE',
          activatedAtIso: new Date().toISOString(),
        },
        tx,
      );

      tenant.subVer += 1;
      await this.tenantRepo.saveTenant(tenant, tx);

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

      await this.outbox.appendEvent(
        {
          eventId: `ev-${crypto.randomUUID()}`,
          eventType: 'tenant.capabilities.updated',
          tenantId,
          subVer: tenant.subVer,
          payload: {
            activated_parent_service: serviceKey,
            services: projection.services,
            readonly_microservices: projection.readonlyMicroservices,
          },
        },
        tx,
      );

      return {
        tenantId,
        subVer: tenant.subVer,
        services: projection.services,
        readonlyMicroservices: projection.readonlyMicroservices,
        supersededToReadonly: [],
        appliedMigrations: [],
      };
    });

    await this.stateCache.setMonotonicSubVer(tenantId, result.subVer);
    return result;
  }

  public async activateParentMicroservice(
    tenantId: string,
    parentKey: ParentMicroserviceKey | ServiceKey,
  ): Promise<CapabilityMutationResult> {
    return this.activateParentService(tenantId, parentKey);
  }

  /**
   * Corte Maestro en Cascada (Kill-Switch de Grupo Padre `ms:*` / `srv:*`) [P2-01]
   * Verifica que ningún módulo activo de otro Microservicio Padre dependa de este contenedor,
   * y luego deshabilita el Microservicio Padre bloqueando sus hijos en el JWT.
   */
  public async deactivateParentService(
    tenantId: string,
    serviceKeyInput: ParentMicroserviceKey | ServiceKey,
  ): Promise<CapabilityMutationResult> {
    const serviceKey = normalizeParentMicroserviceKey(serviceKeyInput);
    const result = await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(PROVEKO_ERROR_CODES.ERR_NOT_FOUND, 404, 'Tenant not found.');
      }

      const currentParents = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const currentMs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      this.graphEngine.assertCanDeactivateParentService(serviceKey, currentParents, currentMs);

      await this.catalogRepo.upsertParentService(
        {
          tenantId,
          serviceKey,
          status: 'DISABLED',
          activatedAtIso: new Date().toISOString(),
        },
        tx,
      );

      tenant.subVer += 1;
      await this.tenantRepo.saveTenant(tenant, tx);

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

      await this.outbox.appendEvent(
        {
          eventId: `ev-${crypto.randomUUID()}`,
          eventType: 'tenant.capabilities.updated',
          tenantId,
          subVer: tenant.subVer,
          payload: {
            deactivated_parent_service: serviceKey,
            services: projection.services,
            readonly_microservices: projection.readonlyMicroservices,
          },
        },
        tx,
      );

      return {
        tenantId,
        subVer: tenant.subVer,
        services: projection.services,
        readonlyMicroservices: projection.readonlyMicroservices,
        supersededToReadonly: [],
        appliedMigrations: [],
      };
    });

    await this.stateCache.setMonotonicSubVer(tenantId, result.subVer);
    return result;
  }

  public async deactivateParentMicroservice(
    tenantId: string,
    parentKey: ParentMicroserviceKey | ServiceKey,
  ): Promise<CapabilityMutationResult> {
    return this.deactivateParentService(tenantId, parentKey);
  }

  /**
   * Saga de Aprovisionamiento en 3 Fases para Activar un Módulo (`mod:*` / `ms:*`) [P1-04]:
   * - Fase 1: Reserva `PROVISIONING` bajo `SELECT ... FOR UPDATE` validando el Grafo.
   * - Fase 2: DDL idempotente + Migraciones `Umzug` por `adminPort` con `pg_advisory_lock`.
   *           Si la Fase 2 falla, ejecuta una Transacción Compensatoria revirtiendo el estado anterior
   *           para que jamás quede bloqueado en `PROVISIONING`.
   * - Fase 3: Conmutación atómica a `ACTIVE`, paso de `supersedes`/`mutex_group` a `READONLY_ARCHIVE`,
   *           incremento de `sub_ver`, registro en Outbox y actualización monotónica en Redis.
   */
  public async activateMicroservice(
    tenantId: string,
    microserviceKeyInput: ModuleKey | MicroserviceKey,
  ): Promise<CapabilityMutationResult> {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    let targetCellId = '';
    let targetDbName = '';
    let parentServiceKey: ServiceKey = 'srv:invoicing';
    let targetMutexGroup: TenantMicroserviceSubscriptionEntity['mutexGroup'] = null;
    let previousSubSnapshot: TenantMicroserviceSubscriptionEntity | null = null;

    // FASE 1: Reserva Transaccional en estado PROVISIONING bajo SELECT ... FOR UPDATE
    await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(PROVEKO_ERROR_CODES.ERR_NOT_FOUND, 404, 'Tenant not found.');
      }

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);

      const plan = this.graphEngine.planMicroserviceActivation(
        microserviceKey,
        parentSubs,
        msSubs,
      );

      targetCellId = tenant.cellId;
      targetDbName = tenant.dbName;
      parentServiceKey = plan.targetMicroservice.parentService;
      targetMutexGroup = plan.targetMicroservice.mutexGroup;
      previousSubSnapshot =
        msSubs.find((m) => m.microserviceKey === microserviceKey) ?? null;

      await this.catalogRepo.upsertMicroservice(
        {
          tenantId,
          microserviceKey,
          parentServiceKey: plan.targetMicroservice.parentService,
          mutexGroup: plan.targetMicroservice.mutexGroup,
          status: 'PROVISIONING',
          supersededByKey: previousSubSnapshot?.supersededByKey ?? null,
          activatedAtIso: new Date().toISOString(),
          archivedAtIso: previousSubSnapshot?.archivedAtIso ?? null,
        },
        tx,
      );
    });

    // FASE 2: Ejecución DDL y Migraciones Idempotentes en la Celda (`adminPort` + `pg_advisory_lock`)
    let appliedMigrations: string[] = [];
    try {
      const cell = await this.cellRepo.findById(targetCellId);
      if (!cell) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          404,
          `Database cell "${targetCellId}" not found.`,
        );
      }

      const provisionRes = await this.dbProvisioner.provisionServiceSchemaAndMigrations(
        cell,
        targetDbName,
        parentServiceKey,
        microserviceKey,
      );
      appliedMigrations = provisionRes.appliedMigrations;
    } catch (phase2Error) {
      // Transacción Compensatoria de la Saga: restaurar el estado previo para no dejar PROVISIONING huérfano
      await this.uow.runInTransaction(async (tx) => {
        if (previousSubSnapshot) {
          await this.catalogRepo.upsertMicroservice(previousSubSnapshot, tx);
        } else {
          await this.catalogRepo.upsertMicroservice(
            {
              tenantId,
              microserviceKey,
              parentServiceKey,
              mutexGroup: targetMutexGroup,
              status: 'DISABLED',
              supersededByKey: null,
              activatedAtIso: new Date().toISOString(),
              archivedAtIso: new Date().toISOString(),
            },
            tx,
          );
        }
      });
      throw phase2Error;
    }

    // FASE 3: Conmutación Atómica a ACTIVE + aplicación de supersedes/mutex_group a READONLY_ARCHIVE + sub_ver
    const result = await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(PROVEKO_ERROR_CODES.ERR_NOT_FOUND, 404, 'Tenant not found.');
      }

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);

      const plan = this.graphEngine.planMicroserviceActivation(
        microserviceKey,
        parentSubs,
        msSubs,
      );

      const nowIso = new Date().toISOString();
      const supersededKeys: MicroserviceKey[] = [];

      // 3.1. Pasar módulos reemplazados por supersedes o mutex_group a READONLY_ARCHIVE
      for (const transition of plan.toReadonlyArchive) {
        const previous = msSubs.find((m) => m.microserviceKey === transition.microserviceKey);
        if (previous) {
          await this.catalogRepo.upsertMicroservice(
            {
              ...previous,
              status: 'READONLY_ARCHIVE',
              supersededByKey: transition.supersededByKey,
              archivedAtIso: nowIso,
            },
            tx,
          );
          supersededKeys.push(transition.microserviceKey);

          await this.outbox.appendEvent(
            {
              eventId: `ev-${crypto.randomUUID()}`,
              eventType: 'tenant.microservice.superseded',
              tenantId,
              subVer: tenant.subVer + 1,
              payload: {
                superseded_microservice: transition.microserviceKey,
                new_active_microservice: microserviceKey,
                reason: transition.reason,
                archive_mode: 'READONLY_ARCHIVE',
              },
            },
            tx,
          );
        }
      }

      // 3.2. Activar el nuevo módulo
      await this.catalogRepo.upsertMicroservice(
        {
          tenantId,
          microserviceKey,
          parentServiceKey: plan.targetMicroservice.parentService,
          mutexGroup: plan.targetMicroservice.mutexGroup,
          status: 'ACTIVE',
          supersededByKey: null,
          activatedAtIso: nowIso,
          archivedAtIso: null,
        },
        tx,
      );

      // 3.3. Incrementar versión de suscripción (sub_ver)
      tenant.subVer += 1;
      await this.tenantRepo.saveTenant(tenant, tx);

      const updatedParents = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const updatedMs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(updatedParents, updatedMs);

      await this.outbox.appendEvent(
        {
          eventId: `ev-${crypto.randomUUID()}`,
          eventType: 'tenant.capabilities.updated',
          tenantId,
          subVer: tenant.subVer,
          payload: {
            activated_microservice: microserviceKey,
            superseded_to_readonly: supersededKeys,
            services: projection.services,
            readonly_microservices: projection.readonlyMicroservices,
          },
        },
        tx,
      );

      return {
        tenantId,
        subVer: tenant.subVer,
        services: projection.services,
        readonlyMicroservices: projection.readonlyMicroservices,
        supersededToReadonly: supersededKeys,
        appliedMigrations,
      };
    });

    await this.stateCache.setMonotonicSubVer(tenantId, result.subVer);
    return result;
  }

  public async activateModule(
    tenantId: string,
    moduleKey: ModuleKey | MicroserviceKey,
  ): Promise<CapabilityMutationResult> {
    return this.activateMicroservice(tenantId, moduleKey);
  }

  /**
   * Desactiva un Módulo individual validando antes las dependencias inversas (`reverse_requires`) [P2-01]
   */
  public async deactivateMicroservice(
    tenantId: string,
    microserviceKeyInput: ModuleKey | MicroserviceKey,
    targetMode: 'READONLY_ARCHIVE' | 'DISABLED' = 'READONLY_ARCHIVE',
  ): Promise<CapabilityMutationResult> {
    const microserviceKey = normalizeModuleKey(microserviceKeyInput);
    const result = await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(tenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(PROVEKO_ERROR_CODES.ERR_NOT_FOUND, 404, 'Tenant not found.');
      }

      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      this.graphEngine.assertCanDeactivateMicroservice(microserviceKey, msSubs);

      const def = this.graphEngine.getDefinition(microserviceKey);
      const existing = msSubs.find((m) => m.microserviceKey === microserviceKey);

      await this.catalogRepo.upsertMicroservice(
        {
          tenantId,
          microserviceKey,
          parentServiceKey: def.parentService,
          mutexGroup: def.mutexGroup,
          status: targetMode,
          supersededByKey: existing?.supersededByKey ?? null,
          activatedAtIso: existing?.activatedAtIso ?? new Date().toISOString(),
          archivedAtIso: new Date().toISOString(),
        },
        tx,
      );

      tenant.subVer += 1;
      await this.tenantRepo.saveTenant(tenant, tx);

      const updatedParents = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const updatedMs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(updatedParents, updatedMs);

      await this.outbox.appendEvent(
        {
          eventId: `ev-${crypto.randomUUID()}`,
          eventType: 'tenant.capabilities.updated',
          tenantId,
          subVer: tenant.subVer,
          payload: {
            deactivated_microservice: microserviceKey,
            mode: targetMode,
            services: projection.services,
            readonly_microservices: projection.readonlyMicroservices,
          },
        },
        tx,
      );

      return {
        tenantId,
        subVer: tenant.subVer,
        services: projection.services,
        readonlyMicroservices: projection.readonlyMicroservices,
        supersededToReadonly: [],
        appliedMigrations: [],
      };
    });

    await this.stateCache.setMonotonicSubVer(tenantId, result.subVer);
    return result;
  }

  public async deactivateModule(
    tenantId: string,
    moduleKey: ModuleKey | MicroserviceKey,
    targetMode: 'READONLY_ARCHIVE' | 'DISABLED' = 'READONLY_ARCHIVE',
  ): Promise<CapabilityMutationResult> {
    return this.deactivateMicroservice(tenantId, moduleKey, targetMode);
  }
}

