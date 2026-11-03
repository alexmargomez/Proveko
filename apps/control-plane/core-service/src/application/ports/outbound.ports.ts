import type { EncryptedConnectionEnvelope } from '@proveko/crypto-vault';
import type { MicroserviceKey, ServiceKey } from '@proveko/shared-kernel';
import type { DatabaseCellEntity } from '../../domain/entities/core-entities.js';
import type { ControlPlaneTransactionContext } from '../../domain/ports/repositories.port.js';

export interface UnitOfWorkPort {
  runInTransaction<T>(
    work: (tx: ControlPlaneTransactionContext) => Promise<T>,
  ): Promise<T>;
}

export interface TenantDatabaseProvisionerPort {
  /** Se conecta al `adminPort` de la Celda y crea físicamente la base de datos `db_tenant_<id>` */
  provisionTenantDatabase(
    cell: DatabaseCellEntity,
    dbName: string,
    dbUsername: string,
    dbPassword: string,
  ): Promise<void>;

  /**
   * Se conecta al `adminPort` de la Celda, adquiere `pg_advisory_lock`, ejecuta `CREATE SCHEMA IF NOT EXISTS srv_*`
   * y corre las migraciones pendientes para `(microservice_key, migration_name)` en `srv_*.schema_migrations` [P1-04]
   */
  provisionServiceSchemaAndMigrations(
    cell: DatabaseCellEntity,
    dbName: string,
    serviceKey: ServiceKey,
    microserviceKey?: MicroserviceKey,
  ): Promise<{ appliedMigrations: string[] }>;
}

export interface TenantStateCachePort {
  /**
   * Actualiza `tenant:{id}:sub_ver` usando un Script Lua Monotónico (solo si newSubVer > current) [P1-04]
   */
  setMonotonicSubVer(tenantId: string, newSubVer: number): Promise<number>;
  getCurrentSubVer(tenantId: string): Promise<number | null>;

  /**
   * Guarda únicamente el sobre cifrado KEK+DEK en Redis (cero credenciales en texto plano) [P1-03]
   */
  cacheEncryptedEnvelope(
    tenantId: string,
    envelope: EncryptedConnectionEnvelope,
  ): Promise<void>;
  getCachedEncryptedEnvelope(
    tenantId: string,
  ): Promise<EncryptedConnectionEnvelope | null>;
}

export interface PasswordHasherPort {
  hashPassword(plain: string): Promise<string>;
  verifyPassword(plain: string, hash: string): Promise<boolean>;
}

export interface ControlPlaneOutboxEvent {
  eventId: string;
  eventType:
    | 'tenant.provisioned'
    | 'tenant.capabilities.updated'
    | 'tenant.microservice.superseded';
  tenantId: string;
  subVer: number;
  payload: Record<string, unknown>;
}

export interface ControlOutboxPort {
  appendEvent(
    event: ControlPlaneOutboxEvent,
    tx: ControlPlaneTransactionContext,
  ): Promise<void>;
}
