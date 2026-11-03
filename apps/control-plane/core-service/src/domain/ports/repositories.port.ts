import type { MicroserviceKey, ServiceKey } from '@proveko/shared-kernel';
import type {
  DatabaseCellEntity,
  TenantBranchEntity,
  TenantEntity,
  TenantMicroserviceSubscriptionEntity,
  TenantServiceSubscriptionEntity,
  UserEntity,
  WarmSandboxSlotEntity,
} from '../entities/core-entities.js';

/**
 * Puertos de Repositorio Puros del Dominio (`domain/ports/`) [P2-01]
 * Libres de detalles tecnológicos de infraestructura.
 */
export interface ControlPlaneTransactionContext {
  readonly txId: string;
}

export interface TenantRepositoryPort {
  findById(tenantId: string): Promise<TenantEntity | null>;
  /** Adquiere `SELECT ... FOR UPDATE` sobre la fila del inquilino para serializar mutaciones del catálogo [P1-04] */
  findByIdForUpdate(
    tenantId: string,
    tx: ControlPlaneTransactionContext,
  ): Promise<TenantEntity | null>;
  saveTenant(tenant: TenantEntity, tx: ControlPlaneTransactionContext): Promise<void>;
  findBranchesByTenant(tenantId: string): Promise<TenantBranchEntity[]>;
  saveBranch(branch: TenantBranchEntity, tx: ControlPlaneTransactionContext): Promise<void>;
}

export interface DatabaseCellRepositoryPort {
  listAllCells(): Promise<DatabaseCellEntity[]>;
  findById(cellId: string): Promise<DatabaseCellEntity | null>;
  incrementCellTenantCount(
    cellId: string,
    delta: number,
    tx: ControlPlaneTransactionContext,
  ): Promise<void>;
}

export interface SubscriptionCatalogRepositoryPort {
  findParentServicesByTenant(
    tenantId: string,
    tx?: ControlPlaneTransactionContext,
  ): Promise<TenantServiceSubscriptionEntity[]>;
  upsertParentService(
    sub: TenantServiceSubscriptionEntity,
    tx: ControlPlaneTransactionContext,
  ): Promise<void>;
  findMicroservicesByTenant(
    tenantId: string,
    tx?: ControlPlaneTransactionContext,
  ): Promise<TenantMicroserviceSubscriptionEntity[]>;
  upsertMicroservice(
    sub: TenantMicroserviceSubscriptionEntity,
    tx: ControlPlaneTransactionContext,
  ): Promise<void>;
}

export interface UserRepositoryPort {
  findByEmailAndTenant(email: string, tenantId: string): Promise<UserEntity | null>;
  findById(userId: string): Promise<UserEntity | null>;
  saveUser(user: UserEntity, tx: ControlPlaneTransactionContext): Promise<void>;
}

export interface WarmSandboxRepositoryPort {
  acquireNextReadySandboxSlot(
    presetKey: string,
    tx: ControlPlaneTransactionContext,
  ): Promise<WarmSandboxSlotEntity | null>;
  updateSandboxSlot(
    slot: WarmSandboxSlotEntity,
    tx: ControlPlaneTransactionContext,
  ): Promise<void>;
}
