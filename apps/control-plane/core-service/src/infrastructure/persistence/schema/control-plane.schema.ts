import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import type { EncryptedConnectionEnvelope } from '@proveko/crypto-vault';
import type { WorkstationThemeConfig } from '../../../domain/value-objects/css-theme-tokens.vo.js';

/**
 * 1. Catálogo de Celdas Físicas de Bases de Datos (`database_cells`)
 * Separa explícitamente `admin_port` (PostgreSQL directo para DDL/Umzug) de `pooler_port` (PgBouncer transaction mode) [P1-04]
 */
export const databaseCellsTable = pgTable('database_cells', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  host: varchar('host', { length: 255 }).notNull(),
  adminPort: integer('admin_port').notNull().default(5432),
  poolerPort: integer('pooler_port').notNull().default(6432),
  maxTenants: integer('max_tenants').notNull().default(25),
  currentTenants: integer('current_tenants').notNull().default(0),
  tierTarget: varchar('tier_target', { length: 32 }).notNull(),
  isSandboxCell: boolean('is_sandbox_cell').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('ONLINE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 2. Directorio Maestro de Inquilinos (`tenants`)
 * Almacena el sobre criptográfico Envelope Encryption (KEK + DEK) y la versión monotónica `sub_ver` [P1-03] & [P1-04]
 */
export const tenantsTable = pgTable('tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  taxIdNit: varchar('tax_id_nit', { length: 64 }).notNull(),
  tier: varchar('tier', { length: 32 }).notNull(),
  isSandbox: boolean('is_sandbox').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  cellId: varchar('cell_id', { length: 64 })
    .notNull()
    .references(() => databaseCellsTable.id),
  dbName: varchar('db_name', { length: 128 }).notNull().unique(),
  encryptedConnectionEnvelope: jsonb('encrypted_connection_envelope')
    .$type<EncryptedConnectionEnvelope>()
    .notNull(),
  subVer: integer('sub_ver').notNull().default(1),
  themeConfig: jsonb('theme_config').$type<WorkstationThemeConfig>().notNull(),
  sandboxExpiresAt: timestamp('sandbox_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 3. Sucursales / Sedes del Inquilino (`tenant_branches`)
 * Sincronizadas con `active_branch_id` y `allowed_branch_ids` en el JWT
 */
export const tenantBranchesTable = pgTable('tenant_branches', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  cityCodeDian: varchar('city_code_dian', { length: 16 }).notNull().default('11001'),
  defaultWarehouseId: varchar('default_warehouse_id', { length: 64 }).notNull(),
  isMain: boolean('is_main').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
});

/**
 * 4. Catálogo Maestro de Servicios Padres Gatekeepers (`service_groups`)
 */
export const serviceGroupsTable = pgTable('service_groups', {
  key: varchar('key', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  schemaName: varchar('schema_name', { length: 64 }).notNull().unique(),
  displayOrder: integer('display_order').notNull().default(1),
});

/**
 * 5. Catálogo Maestro de Definiciones de Microservicios (`microservice_definitions`)
 */
export const microserviceDefinitionsTable = pgTable('microservice_definitions', {
  key: varchar('key', { length: 80 }).primaryKey(),
  parentServiceKey: varchar('parent_service_key', { length: 64 })
    .notNull()
    .references(() => serviceGroupsTable.key),
  name: varchar('name', { length: 160 }).notNull(),
  subgroup: varchar('subgroup', { length: 120 }).notNull(),
  tablePrefix: varchar('table_prefix', { length: 16 }).notNull(),
  requiresServices: jsonb('requires_services').$type<string[]>().notNull().default([]),
  requiresMicroservices: jsonb('requires_microservices')
    .$type<string[]>()
    .notNull()
    .default([]),
  mutexGroup: varchar('mutex_group', { length: 64 }),
  supersedes: jsonb('supersedes').$type<string[]>().notNull().default([]),
  onSupersedeMode: varchar('on_supersede_mode', { length: 32 })
    .notNull()
    .default('readonly_archive'),
  baseMonthlyPriceCop: numeric('base_monthly_price_cop', {
    precision: 19,
    scale: 4,
  }).notNull(),
});

/**
 * 6. Catálogo de Presets Comerciales por Giro (`industry_presets`)
 */
export const industryPresetsTable = pgTable('industry_presets', {
  key: varchar('key', { length: 80 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  targetAudience: varchar('target_audience', { length: 255 }).notNull(),
  services: jsonb('services').$type<string[]>().notNull(),
  microservices: jsonb('microservices').$type<string[]>().notNull(),
  demoSeedProfile: varchar('demo_seed_profile', { length: 80 }).notNull(),
});

/**
 * 7. Suscripciones de Servicios Padres por Inquilino (`tenant_service_subscriptions`)
 */
export const tenantServiceSubscriptionsTable = pgTable(
  'tenant_service_subscriptions',
  {
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    serviceKey: varchar('service_key', { length: 64 })
      .notNull()
      .references(() => serviceGroupsTable.key),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.serviceKey] })],
);

/**
 * 8. Suscripciones de Microservicios por Inquilino (`tenant_microservice_subscriptions`)
 * Incluye el Índice Único Parcial Físico `uq_tenant_active_mutex_group` que impide condiciones de carrera TOCTOU [P1-04]
 */
export const tenantMicroserviceSubscriptionsTable = pgTable(
  'tenant_microservice_subscriptions',
  {
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    microserviceKey: varchar('microservice_key', { length: 80 })
      .notNull()
      .references(() => microserviceDefinitionsTable.key),
    parentServiceKey: varchar('parent_service_key', { length: 64 })
      .notNull()
      .references(() => serviceGroupsTable.key),
    mutexGroup: varchar('mutex_group', { length: 64 }),
    status: varchar('status', { length: 32 }).notNull(), // PROVISIONING | ACTIVE | READONLY_ARCHIVE | DISABLED
    supersededByKey: varchar('superseded_by_key', { length: 80 }),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.microserviceKey] }),
    uniqueIndex('uq_tenant_active_mutex_group')
      .on(table.tenantId, table.mutexGroup)
      .where(
        sql`${table.status} IN ('PROVISIONING', 'ACTIVE') AND ${table.mutexGroup} IS NOT NULL`,
      ),
  ],
);

/**
 * 9. Usuarios del Inquilino (`users`)
 */
export const usersTable = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 })
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  roleKey: varchar('role_key', { length: 64 }).notNull(),
  allowedBranchIds: jsonb('allowed_branch_ids').$type<string[]>().notNull(),
  defaultBranchId: varchar('default_branch_id', { length: 64 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 10. Pool de Sandboxes Pre-Calentados (`warm_sandbox_slots`) y Outbox del Control Plane (`control_outbox_events`)
 */
export const warmSandboxSlotsTable = pgTable('warm_sandbox_slots', {
  sandboxId: varchar('sandbox_id', { length: 64 }).primaryKey(),
  cellId: varchar('cell_id', { length: 64 })
    .notNull()
    .references(() => databaseCellsTable.id),
  dbName: varchar('db_name', { length: 128 }).notNull().unique(),
  presetKey: varchar('preset_key', { length: 80 }).notNull(),
  encryptedConnectionEnvelope: jsonb('encrypted_connection_envelope')
    .$type<EncryptedConnectionEnvelope>()
    .notNull(),
  status: varchar('status', { length: 32 }).notNull().default('READY_WARM'),
  assignedTenantId: varchar('assigned_tenant_id', { length: 64 }),
});

export const controlOutboxEventsTable = pgTable('control_outbox_events', {
  eventId: varchar('event_id', { length: 64 }).primaryKey(),
  eventType: varchar('event_type', { length: 120 }).notNull(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),
  subVer: integer('sub_ver').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
