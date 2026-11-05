-- =============================================================================
-- PROVEKO — Core Control Plane Migration (proveko_control_db / coreDB)
-- Migration: 0002_superadmin_and_tenant_connections.sql
-- Purpose:
--   1. Crea las tablas maestras en `public` y `control_plane` para que sean
--      visibles directamente en el Inspector SQL de ALpanel y por todos los nodos:
--      - `superadmin_users` (Credenciales del SuperAdmin Global de Proveko)
--      - `tenant_database_connections` (Datos de conexión reales a la DB de cada cliente)
--      - `role_definitions` y `tenant_users` (Roles RBAC y credenciales de cada cliente)
--      - `subscription_payments` (Registro de pagos del microservicio ms-payments en Standby)
--      - `operational_centers` y `tenant_component_toggles` (Módulos y Componentes activos)
--   2. Inserta las semillas iniciales idempotentes (ON CONFLICT DO NOTHING).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS control_plane;

-- 1. Tabla de SuperAdministradores Globales de la Plataforma Proveko
CREATE TABLE IF NOT EXISTS public.superadmin_users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_credential VARCHAR(255) NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  role_key VARCHAR(64) NOT NULL DEFAULT 'SUPERADMIN_GLOBAL',
  can_create_tenants BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_client_dbs BOOLEAN NOT NULL DEFAULT TRUE,
  can_impersonate_tenants BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  last_login_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla Maestra de Empresas Clientes y Datos de Conexión a Cada Base de Datos Cliente
CREATE TABLE IF NOT EXISTS public.tenant_database_connections (
  tenant_id VARCHAR(64) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  tax_id_nit VARCHAR(64) NOT NULL,
  city VARCHAR(120) NOT NULL DEFAULT 'Bogotá D.C.',
  plan_name VARCHAR(160) NOT NULL,
  db_cell_id VARCHAR(64) NOT NULL DEFAULT 'cell-alpanel-01',
  db_host VARCHAR(255) NOT NULL DEFAULT 'db',
  db_port INTEGER NOT NULL DEFAULT 5432,
  db_name VARCHAR(128) NOT NULL UNIQUE,
  db_user VARCHAR(128) NOT NULL DEFAULT 'postgres',
  db_schema_mode VARCHAR(64) NOT NULL DEFAULT 'ISOLATED_DATABASE',
  connection_uri VARCHAR(500) NOT NULL,
  admin_username VARCHAR(180) NOT NULL,
  admin_generated_password VARCHAR(180) NOT NULL,
  payment_status VARCHAR(64) NOT NULL DEFAULT 'STANDBY_APPROVED',
  monthly_amount_cop NUMERIC(19, 4) NOT NULL DEFAULT 0,
  sub_ver INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Catálogo de Roles y Permisos de Gestión (RBAC)
CREATE TABLE IF NOT EXISTS public.role_definitions (
  role_key VARCHAR(64) PRIMARY KEY,
  role_label VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL,
  allowed_centers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Usuarios y Credenciales por Empresa Cliente (Incluye el SuperAdmin de cada Cliente y sus Empleados)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES public.tenant_database_connections(tenant_id) ON DELETE CASCADE,
  full_name VARCHAR(180) NOT NULL,
  username VARCHAR(180) NOT NULL,
  password_credential VARCHAR(255) NOT NULL,
  role_key VARCHAR(64) NOT NULL REFERENCES public.role_definitions(role_key),
  branch_name VARCHAR(160) NOT NULL DEFAULT 'Sede Principal',
  is_tenant_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, username)
);

-- 5. Registro de Pagos y Suscripciones (Microservicio ms-payments en Standby)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  payment_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES public.tenant_database_connections(tenant_id) ON DELETE CASCADE,
  payment_reference VARCHAR(120) NOT NULL UNIQUE,
  payment_gateway VARCHAR(80) NOT NULL DEFAULT 'ms-payments-standby',
  payment_method VARCHAR(80) NOT NULL DEFAULT 'STANDBY_CHECKOUT',
  amount_cop NUMERIC(19, 4) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'STANDBY_APPROVED',
  selected_centers JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Configuración de Centros Operativos y Componentes Conmutables por Empresa Cliente
CREATE TABLE IF NOT EXISTS public.tenant_component_toggles (
  tenant_id VARCHAR(64) NOT NULL REFERENCES public.tenant_database_connections(tenant_id) ON DELETE CASCADE,
  center_key VARCHAR(80) NOT NULL,
  component_key VARCHAR(80) NOT NULL,
  component_name VARCHAR(180) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, component_key)
);

-- =============================================================================
-- SEMILLAS INICIALES OBLIGATORIAS EN LA BASE PRINCIPAL (proveko_control_db)
-- =============================================================================

-- A) SuperAdmin Global de Proveko
INSERT INTO public.superadmin_users (
  id, email, username, password_credential, full_name, role_key,
  can_create_tenants, can_manage_client_dbs, can_impersonate_tenants, status
) VALUES (
  'sa-proveko-master-01',
  'superadmin@proveko.com',
  'superadmin@proveko.com',
  'ProvekoMaster2026!',
  'SuperAdmin Maestro Proveko Cloud',
  'SUPERADMIN_GLOBAL',
  TRUE, TRUE, TRUE, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- B) Celda Principal PostgreSQL en control_plane.database_cells
INSERT INTO control_plane.database_cells (
  id, code, host, admin_port, pooler_port, max_tenants, current_tenants, tier_target, is_sandbox_cell, status
) VALUES (
  'cell-alpanel-01', 'ALPANEL-PG16-MAIN', 'db', 5432, 5432, 100, 3, 'ENTERPRISE', FALSE, 'ONLINE'
) ON CONFLICT (id) DO NOTHING;

-- C) Roles RBAC de la Plataforma
INSERT INTO public.role_definitions (role_key, role_label, description, allowed_centers) VALUES
  ('SUPERADMIN_GLOBAL', 'SuperAdmin Global Proveko', 'Control total de todas las empresas clientes, bases de datos, planes y credenciales.', '["center:invoicing-pos","center:inventory-recipes","center:gastro-reservations","center:logistics-fleet","center:crm-finance","center:users-rbac"]'::jsonb),
  ('ADMIN_CLIENTE', 'Administrador General de Empresa (SuperAdmin Cliente)', 'Control total de la empresa cliente, usuarios, roles y activación de componentes.', '["center:invoicing-pos","center:inventory-recipes","center:gastro-reservations","center:logistics-fleet","center:crm-finance","center:users-rbac"]'::jsonb),
  ('CAJERO_FACTURADOR', 'Cajero / Facturador de Punto de Venta', 'Emisión de facturas, tirillas POS, cotizaciones, arqueo de caja y consulta de clientes.', '["center:invoicing-pos","center:crm-finance"]'::jsonb),
  ('JEFE_BODEGA', 'Jefe de Inventario, Producción y Recetas', 'Catálogo de productos, Kardex, constructor visual de recetas, lotes y traslados.', '["center:inventory-recipes","center:logistics-fleet"]'::jsonb),
  ('MESERO_COMANDAS', 'Anfitrión de Mesas y Comandera de Cocina', 'Atención de mesas, toma de comandas, marcha a cocina y división de cuentas.', '["center:gastro-reservations","center:invoicing-pos"]'::jsonb),
  ('CONTROL_TRACTOMULAS', 'Operador de Báscula, Patio y Tractomulas', 'Ingreso de tractomulas, pesaje bruto/tara/neto en báscula, muelles y despachos.', '["center:logistics-fleet","center:inventory-recipes"]'::jsonb),
  ('RECEPCION_RESERVAS', 'Recepcionista de Reservas, Cupos y Tickets', 'Agenda de reservas de cupos/alojamiento, emisión de tickets y check-in.', '["center:gastro-reservations","center:invoicing-pos"]'::jsonb),
  ('CONTADOR_FINANZAS', 'Contador y Analista de Cartera / Tesorería', 'Gestión de terceros, recaudos CxC, pagos CxP, caja y asientos contables.', '["center:crm-finance","center:invoicing-pos"]'::jsonb)
ON CONFLICT (role_key) DO NOTHING;

-- D) Empresas Clientes y sus Datos de Conexión a cada Base de Datos Independiente
INSERT INTO public.tenant_database_connections (
  tenant_id, company_name, tax_id_nit, city, plan_name, db_cell_id,
  db_host, db_port, db_name, db_user, connection_uri,
  admin_username, admin_generated_password, payment_status, monthly_amount_cop, sub_ver
) VALUES
  (
    'emp-agroindustrial-del-valle',
    'Grupo Agroindustrial & Logístico del Valle S.A.S.',
    '901.482.310-4',
    'Cali, Colombia',
    'Plan Corporativo Integral Multi-Operación',
    'cell-alpanel-01',
    'db', 5432, 'db_agrovalle', 'postgres',
    'postgresql://postgres:***@db:5432/db_agrovalle',
    'admin@agrovalle.co', 'AgroValle2026!', 'STANDBY_APPROVED', 313000.0000, 1
  ),
  (
    'emp-restaurante-la-brasa',
    'Gastrobar & Eventos La Brasa Imperial S.A.S.',
    '900.812.904-1',
    'Medellín, Colombia',
    'Plan Gastronomía, Reservas, Tickets e Inventario',
    'cell-alpanel-01',
    'db', 5432, 'db_labrasa', 'postgres',
    'postgresql://postgres:***@db:5432/db_labrasa',
    'admin@labrasaimperial.co', 'Brasa2026!', 'STANDBY_APPROVED', 186000.0000, 1
  ),
  (
    'db_version_prueba',
    'Empresa Demostración Sandbox Proveko',
    '900.111.222-3',
    'Bogotá D.C.',
    'Plan Sandbox Evaluación Completa',
    'cell-alpanel-01',
    'db', 5432, 'db_version_prueba', 'postgres',
    'postgresql://postgres:***@db:5432/db_version_prueba',
    'demo@proveko.com', 'Demo2026!', 'STANDBY_APPROVED', 0.0000, 1
  )
ON CONFLICT (tenant_id) DO NOTHING;

-- Sincronizar también en control_plane.tenants
INSERT INTO control_plane.tenants (
  id, slug, legal_name, tax_id_nit, tier, is_sandbox, status, cell_id,
  db_name, encrypted_connection_envelope, sub_ver, theme_config
) VALUES
  (
    'emp-agroindustrial-del-valle', 'agrovalle', 'Grupo Agroindustrial & Logístico del Valle S.A.S.',
    '901.482.310-4', 'ENTERPRISE', FALSE, 'ACTIVE', 'cell-alpanel-01',
    'db_agrovalle', '{"host":"db","port":5432,"database":"db_agrovalle","user":"postgres"}'::jsonb,
    1, '{"brandColor":"#1D4ED8"}'::jsonb
  ),
  (
    'emp-restaurante-la-brasa', 'labrasa', 'Gastrobar & Eventos La Brasa Imperial S.A.S.',
    '900.812.904-1', 'BUSINESS', FALSE, 'ACTIVE', 'cell-alpanel-01',
    'db_labrasa', '{"host":"db","port":5432,"database":"db_labrasa","user":"postgres"}'::jsonb,
    1, '{"brandColor":"#1D4ED8"}'::jsonb
  ),
  (
    'db_version_prueba', 'sandbox-prueba', 'Empresa Demostración Sandbox Proveko',
    '900.111.222-3', 'SANDBOX', TRUE, 'ACTIVE', 'cell-alpanel-01',
    'db_version_prueba', '{"host":"db","port":5432,"database":"db_version_prueba","user":"postgres"}'::jsonb,
    1, '{"brandColor":"#1D4ED8"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- E) Usuarios y Credenciales Generadas de cada Empresa Cliente
INSERT INTO public.tenant_users (
  id, tenant_id, full_name, username, password_credential, role_key, branch_name, is_tenant_superadmin, status
) VALUES
  ('usr-agro-admin', 'emp-agroindustrial-del-valle', 'Carlos Eduardo Mendoza', 'admin@agrovalle.co', 'AgroValle2026!', 'ADMIN_CLIENTE', 'Planta & Sedes Principales', TRUE, 'ACTIVE'),
  ('usr-agro-cajero', 'emp-agroindustrial-del-valle', 'Laura Valentina Ríos', 'cajero@agrovalle.co', 'Cajero2026!', 'CAJERO_FACTURADOR', 'Punto de Venta Central', FALSE, 'ACTIVE'),
  ('usr-agro-bascula', 'emp-agroindustrial-del-valle', 'Jorge Hernán Ospina', 'bascula@agrovalle.co', 'Bascula2026!', 'CONTROL_TRACTOMULAS', 'Patio de Tractomulas Norte', FALSE, 'ACTIVE'),
  ('usr-brasa-admin', 'emp-restaurante-la-brasa', 'Juliana Restrepo', 'admin@labrasaimperial.co', 'Brasa2026!', 'ADMIN_CLIENTE', 'Sede Poblado', TRUE, 'ACTIVE'),
  ('usr-demo-admin', 'db_version_prueba', 'Usuario Administrador Demo', 'demo@proveko.com', 'Demo2026!', 'ADMIN_CLIENTE', 'Sede Principal', TRUE, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- F) Pagos en Standby Registrados (Microservicio ms-payments)
INSERT INTO public.subscription_payments (
  payment_id, tenant_id, payment_reference, payment_gateway, payment_method, amount_cop, status
) VALUES
  ('pay-stby-001', 'emp-agroindustrial-del-valle', 'STBY-AGRO-2026-01', 'ms-payments-standby', 'Pasarela Corporativa (Standby)', 313000.0000, 'STANDBY_APPROVED'),
  ('pay-stby-002', 'emp-restaurante-la-brasa', 'STBY-BRASA-2026-02', 'ms-payments-standby', 'PSE Empresarial (Standby)', 186000.0000, 'STANDBY_APPROVED')
ON CONFLICT (payment_id) DO NOTHING;
