-- =============================================================================
-- PROVEKO — Control Plane Master Database (proveko_control_db / coreDB)
-- Migration: 0001_init_control_plane_core_db.sql
-- Purpose: Almacena el catálogo de Celdas, la Lista Maestra de Clientes y sus
--          Bases de Datos (tenants.db_name), Usuarios, Sucursales, Suscripciones
--          de Microservicios/Módulos y Registro de Sandboxes (db_version_prueba).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS control_plane;

CREATE TABLE IF NOT EXISTS control_plane.database_cells (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  host VARCHAR(255) NOT NULL,
  admin_port INTEGER NOT NULL DEFAULT 5432,
  pooler_port INTEGER NOT NULL DEFAULT 6432,
  max_tenants INTEGER NOT NULL DEFAULT 25,
  current_tenants INTEGER NOT NULL DEFAULT 0,
  tier_target VARCHAR(32) NOT NULL,
  is_sandbox_cell BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Directorio Maestro de Clientes y Lista de Bases de Datos por Cliente (`db_name`)
CREATE TABLE IF NOT EXISTS control_plane.tenants (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  legal_name VARCHAR(255) NOT NULL,
  tax_id_nit VARCHAR(64) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  cell_id VARCHAR(64) NOT NULL REFERENCES control_plane.database_cells(id),
  db_name VARCHAR(128) NOT NULL UNIQUE,
  encrypted_connection_envelope JSONB NOT NULL,
  sub_ver INTEGER NOT NULL DEFAULT 1,
  theme_config JSONB NOT NULL,
  sandbox_expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_plane.tenant_branches (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES control_plane.tenants(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(160) NOT NULL,
  city_code_dian VARCHAR(16) NOT NULL DEFAULT '11001',
  default_warehouse_id VARCHAR(64) NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS control_plane.service_groups (
  key VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  schema_name VARCHAR(64) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS control_plane.microservice_definitions (
  key VARCHAR(80) PRIMARY KEY,
  parent_service_key VARCHAR(64) NOT NULL REFERENCES control_plane.service_groups(key),
  name VARCHAR(160) NOT NULL,
  subgroup VARCHAR(120) NOT NULL,
  table_prefix VARCHAR(16) NOT NULL,
  requires_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_microservices JSONB NOT NULL DEFAULT '[]'::jsonb,
  mutex_group VARCHAR(64) NULL,
  supersedes JSONB NOT NULL DEFAULT '[]'::jsonb,
  on_supersede_mode VARCHAR(32) NOT NULL DEFAULT 'readonly_archive',
  base_monthly_price_cop NUMERIC(19, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS control_plane.tenant_service_subscriptions (
  tenant_id VARCHAR(64) NOT NULL REFERENCES control_plane.tenants(id) ON DELETE CASCADE,
  service_key VARCHAR(64) NOT NULL REFERENCES control_plane.service_groups(key),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, service_key)
);

CREATE TABLE IF NOT EXISTS control_plane.tenant_microservice_subscriptions (
  tenant_id VARCHAR(64) NOT NULL REFERENCES control_plane.tenants(id) ON DELETE CASCADE,
  microservice_key VARCHAR(80) NOT NULL REFERENCES control_plane.microservice_definitions(key),
  parent_service_key VARCHAR(64) NOT NULL REFERENCES control_plane.service_groups(key),
  mutex_group VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  superseded_by_key VARCHAR(80) NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, microservice_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_active_mutex_group
  ON control_plane.tenant_microservice_subscriptions (tenant_id, mutex_group)
  WHERE status IN ('PROVISIONING', 'ACTIVE') AND mutex_group IS NOT NULL;
