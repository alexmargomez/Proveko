import type { EncryptedConnectionEnvelope } from '@proveko/crypto-vault';
import type {
  ActiveServicesTree,
  MicroserviceKey,
  MutexGroupKey,
  ServiceKey,
  SubscriptionLifecycleStatus,
  TenantTier,
} from '@proveko/shared-kernel';
import type { WorkstationThemeConfig } from '../value-objects/css-theme-tokens.vo.js';

export interface DatabaseCellEntity {
  id: string;
  code: string;
  host: string;
  /** Puerto directo a PostgreSQL para CREATE DATABASE, CREATE SCHEMA y migraciones con pg_advisory_lock */
  adminPort: number;
  /** Puerto de PgBouncer en modo transaction pooling para tráfico operativo de microservicios */
  poolerPort: number;
  maxTenants: number;
  currentTenants: number;
  tierTarget: TenantTier;
  isSandboxCell: boolean;
  status: 'ONLINE' | 'DRAINING' | 'MAINTENANCE';
}

export interface TenantEntity {
  id: string;
  slug: string;
  legalName: string;
  taxIdNit: string;
  tier: TenantTier;
  isSandbox: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  cellId: string;
  dbName: string;
  encryptedConnectionEnvelope: EncryptedConnectionEnvelope;
  subVer: number;
  themeConfig: WorkstationThemeConfig;
  sandboxExpiresAtIso: string | null;
  createdAtIso: string;
}

export interface TenantBranchEntity {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  cityCodeDian: string;
  defaultWarehouseId: string;
  isMain: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface TenantServiceSubscriptionEntity {
  tenantId: string;
  serviceKey: ServiceKey;
  status: 'ACTIVE' | 'DISABLED';
  activatedAtIso: string;
}

export interface TenantMicroserviceSubscriptionEntity {
  tenantId: string;
  microserviceKey: MicroserviceKey;
  parentServiceKey: ServiceKey;
  mutexGroup: MutexGroupKey | null;
  status: SubscriptionLifecycleStatus;
  supersededByKey: MicroserviceKey | null;
  activatedAtIso: string;
  archivedAtIso: string | null;
}

export interface UserEntity {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  passwordHash: string;
  roleKey: string;
  allowedBranchIds: string[];
  defaultBranchId: string;
  isActive: boolean;
}

export interface WarmSandboxSlotEntity {
  sandboxId: string;
  cellId: string;
  dbName: string;
  presetKey: string;
  encryptedConnectionEnvelope: EncryptedConnectionEnvelope;
  status: 'READY_WARM' | 'ASSIGNED_EPHEMERAL' | 'CLAIMED_PERMANENT';
  assignedTenantId: string | null;
}

/**
 * Construye el árbol `services` y la lista `readonly_microservices` para el JWT a partir del estado del inquilino
 */
export function buildJwtCapabilitiesProjection(
  parentServices: readonly TenantServiceSubscriptionEntity[],
  microservices: readonly TenantMicroserviceSubscriptionEntity[],
): {
  services: ActiveServicesTree;
  readonlyMicroservices: MicroserviceKey[];
} {
  const activeParents = new Set<ServiceKey>(
    parentServices.filter((s) => s.status === 'ACTIVE').map((s) => s.serviceKey),
  );

  const services: ActiveServicesTree = {};
  for (const parentKey of activeParents) {
    services[parentKey] = [];
  }

  const readonlyMicroservices: MicroserviceKey[] = [];

  for (const ms of microservices) {
    // Regla del Servicio Padre como Gatekeeper: si el Servicio Padre no está activo, ningún hijo se expone
    if (!activeParents.has(ms.parentServiceKey)) {
      continue;
    }

    if (ms.status === 'ACTIVE') {
      services[ms.parentServiceKey]!.push(ms.microserviceKey);
    } else if (ms.status === 'READONLY_ARCHIVE') {
      readonlyMicroservices.push(ms.microserviceKey);
    }
  }

  return { services, readonlyMicroservices };
}
