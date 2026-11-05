-- ============================================================================
-- PROVEKO CONTROL PLANE (CORE DB) — MIGRATION 0002
-- 4 Roles Oficiales (superadmin, desarrollador, auxiliar, cliente),
-- Llaves de Conexión a las BDs de cada Cliente, Cuotas de Roles/Usuarios
-- y Solicitudes de "Necesito otra funcionalidad".
-- (Cero empresas random pre-creadas: en Día 0 solo existe db_version_prueba para Demo)
-- ============================================================================

-- Limpieza idempotente de empresas random previas si existían
DELETE FROM "control_plane"."tenants" WHERE "id" IN ('tnt-agrovalle', 'tnt-labrasa');

-- 1. Cuentas Globales de Plataforma (Roles: superadmin, desarrollador, auxiliar)
CREATE TABLE IF NOT EXISTS "public"."platform_staff_users" (
  "staff_id" VARCHAR(64) PRIMARY KEY,
  "email" VARCHAR(180) NOT NULL UNIQUE,
  "username" VARCHAR(80) NOT NULL UNIQUE,
  "full_name" VARCHAR(180) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "platform_role" VARCHAR(32) NOT NULL CHECK ("platform_role" IN ('superadmin', 'desarrollador', 'auxiliar')),
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidad con vista previa superadmin_users
CREATE TABLE IF NOT EXISTS "public"."superadmin_users" (
  "superadmin_id" VARCHAR(64) PRIMARY KEY,
  "email" VARCHAR(180) NOT NULL UNIQUE,
  "full_name" VARCHAR(180) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role_code" VARCHAR(40) NOT NULL DEFAULT 'superadmin',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_login_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Llaves de Conexión a la Base de Datos Propia de cada Cliente (Rol: cliente)
--    Controla además cuántos roles (max_roles_allowed) y cuántos usuarios (max_users_allowed)
--    puede crear internamente cada cliente en su propia BD.
CREATE TABLE IF NOT EXISTS "public"."tenant_database_connections" (
  "connection_id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL UNIQUE,
  "company_name" VARCHAR(180) NOT NULL,
  "nit" VARCHAR(40) NOT NULL,
  "business_type" VARCHAR(64) NOT NULL DEFAULT 'comercio-retail',
  "db_host" VARCHAR(120) NOT NULL DEFAULT 'db',
  "db_port" INTEGER NOT NULL DEFAULT 5432,
  "db_name" VARCHAR(120) NOT NULL UNIQUE,
  "db_user" VARCHAR(80) NOT NULL DEFAULT 'postgres',
  "db_password_secret_ref" VARCHAR(180) NOT NULL DEFAULT 'env:POSTGRES_PASSWORD',
  "admin_username" VARCHAR(120) NOT NULL DEFAULT 'admin',
  "admin_password_hint" VARCHAR(120) NOT NULL DEFAULT 'AdminProveko2026!',
  "max_roles_allowed" INTEGER NOT NULL DEFAULT 5,
  "max_users_allowed" INTEGER NOT NULL DEFAULT 10,
  "enabled_services_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "enabled_submodules_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "enabled_features_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "pool_max_connections" INTEGER NOT NULL DEFAULT 15,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "last_migration_version" VARCHAR(32) NOT NULL DEFAULT '0002',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "business_type" VARCHAR(64) NOT NULL DEFAULT 'comercio-retail';
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "admin_username" VARCHAR(120) NOT NULL DEFAULT 'admin';
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "admin_password_hint" VARCHAR(120) NOT NULL DEFAULT 'AdminProveko2026!';
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "max_roles_allowed" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "max_users_allowed" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "enabled_services_json" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "enabled_submodules_json" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "public"."tenant_database_connections" ADD COLUMN IF NOT EXISTS "enabled_features_json" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Eliminar empresas random si habían quedado en ejecuciones previas
DELETE FROM "public"."tenant_database_connections" WHERE "db_name" IN ('db_agrovalle', 'db_labrasa');

-- 3. Definición de los 4 Roles Globales + Plantilla de Roles Básicos Internos por Cliente
CREATE TABLE IF NOT EXISTS "public"."role_definitions" (
  "role_code" VARCHAR(64) PRIMARY KEY,
  "role_scope" VARCHAR(32) NOT NULL CHECK ("role_scope" IN ('PLATFORM_GLOBAL', 'CLIENT_INTERNAL_BASIC')),
  "role_label" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Cuentas de Acceso (Credencial Admin generada al crear cada cliente + Usuarios internos)
CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
  "user_id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "username" VARCHAR(120) NOT NULL UNIQUE,
  "email" VARCHAR(180) NOT NULL,
  "full_name" VARCHAR(180) NOT NULL,
  "role_code" VARCHAR(64) NOT NULL,
  "internal_role_name" VARCHAR(80) NOT NULL DEFAULT 'Administrador',
  "generated_password_hint" VARCHAR(120) NOT NULL,
  "is_tenant_superadmin" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "internal_role_name" VARCHAR(80) NOT NULL DEFAULT 'Administrador';
DELETE FROM "public"."tenant_users" WHERE "tenant_id" IN ('tnt-agrovalle', 'tnt-labrasa');

-- 5. Ventana de Pagos (Microservicio ms-payments en Standby)
CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
  "payment_id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "plan_name" VARCHAR(120) NOT NULL,
  "monthly_amount_usd" NUMERIC(10, 2) NOT NULL,
  "payment_gateway_state" VARCHAR(40) NOT NULL DEFAULT 'STANDBY_MICROSERVICE',
  "payment_reference" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DELETE FROM "public"."subscription_payments" WHERE "tenant_id" IN ('tnt-agrovalle', 'tnt-labrasa');

-- 6. Solicitudes de "Necesito otra funcionalidad" enviadas por los clientes
CREATE TABLE IF NOT EXISTS "public"."feature_upgrade_requests" (
  "request_id" VARCHAR(64) PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "company_name" VARCHAR(180) NOT NULL,
  "requested_tier" VARCHAR(32) NOT NULL CHECK ("requested_tier" IN ('MODULO_PRINCIPAL', 'SUBMODULO', 'FUNCIONALIDAD')),
  "requested_key" VARCHAR(120) NOT NULL,
  "requested_label" VARCHAR(180) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DATOS SEMILLA OFICIALES (Cuentas de los 4 Roles + Base Demo db_version_prueba)
-- ============================================================================

INSERT INTO "public"."platform_staff_users" ("staff_id", "email", "username", "full_name", "password_hash", "platform_role", "is_active")
VALUES
  ('staff-superadmin-01', 'superadmin@proveko.com', 'superadmin', 'SuperAdmin Maestro Proveko', 'ed25519$ProvekoMaster2026!', 'superadmin', TRUE),
  ('staff-dev-01', 'dev@proveko.com', 'desarrollador', 'Ingeniero Desarrollador Proveko', 'ed25519$ProvekoDev2026!', 'desarrollador', TRUE),
  ('staff-aux-01', 'auxiliar@proveko.com', 'auxiliar', 'Auxiliar de Soporte y Onboarding', 'ed25519$ProvekoAux2026!', 'auxiliar', TRUE)
ON CONFLICT ("staff_id") DO NOTHING;

INSERT INTO "public"."superadmin_users" ("superadmin_id", "email", "full_name", "password_hash", "role_code", "is_active")
VALUES
  ('sa-root-001', 'superadmin@proveko.com', 'SuperAdmin Maestro Proveko', 'ed25519$ProvekoMaster2026!', 'superadmin', TRUE)
ON CONFLICT ("superadmin_id") DO NOTHING;

INSERT INTO "control_plane"."database_cells" ("cell_id", "host", "port", "db_name", "max_connections", "is_healthy")
VALUES
  ('cell-alpanel-primary', 'db', 5432, 'proveko_control_db', 400, TRUE)
ON CONFLICT ("cell_id") DO NOTHING;

INSERT INTO "control_plane"."tenants" ("id", "slug", "legal_name", "tier", "cell_id", "db_name", "status")
VALUES
  ('tnt-demo', 'version_prueba', 'Empresa Demo Interactiva Proveko', 'ENTERPRISE', 'cell-alpanel-primary', 'db_version_prueba', 'ACTIVE')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "public"."tenant_database_connections" (
  "connection_id", "tenant_id", "company_name", "nit", "business_type",
  "db_host", "db_port", "db_name", "db_user", "db_password_secret_ref",
  "admin_username", "admin_password_hint", "max_roles_allowed", "max_users_allowed",
  "enabled_services_json", "enabled_submodules_json", "enabled_features_json",
  "pool_max_connections", "status", "last_migration_version"
)
VALUES (
  'conn-demo-01', 'tnt-demo', 'Empresa Demo Interactiva Proveko', '900.000.000-1', 'empresarial-completo',
  'db', 5432, 'db_version_prueba', 'postgres', 'env:POSTGRES_PASSWORD',
  'demo', 'DemoProveko2026!', 8, 25,
  '["srv-invoicing","srv-inventory","srv-gastro","srv-hotel","srv-crm","srv-finance"]'::jsonb,
  '["mod-pos","mod-dian","mod-quotes","mod-stock","mod-warehouses","mod-transfers","mod-recipes","mod-lots","mod-scale","mod-tables","mod-kds","mod-split","mod-bookings","mod-tickets","mod-rooms","mod-directory","mod-pipelines","mod-cashbook","mod-arap","mod-puc"]'::jsonb,
  '["comp-cashier-name","comp-tip","comp-line-discount","comp-manager-signature","comp-carrier-select","comp-scale-tare","comp-qr-ticket"]'::jsonb,
  20, 'ACTIVE', '0002'
)
ON CONFLICT ("connection_id") DO UPDATE SET
  "company_name" = EXCLUDED."company_name",
  "db_name" = EXCLUDED."db_name";

INSERT INTO "public"."role_definitions" ("role_code", "role_scope", "role_label", "description")
VALUES
  ('superadmin', 'PLATFORM_GLOBAL', 'SuperAdmin Global', 'Control maestro de clientes, bases de datos por cliente, límites de roles/usuarios y activación de módulos/funcionalidades.'),
  ('desarrollador', 'PLATFORM_GLOBAL', 'Desarrollador de Plataforma', 'Supervisión técnica de microservicios, esquemas SQL, migraciones por base de datos y telemetría.'),
  ('auxiliar', 'PLATFORM_GLOBAL', 'Auxiliar de Plataforma', 'Soporte operativo a clientes, acompañamiento de registro y atención de solicitudes de nuevas funcionalidades.'),
  ('cliente', 'PLATFORM_GLOBAL', 'Cliente (Llave a su propia BD)', 'Cuenta empresarial con conexión aislada a su propia base de datos PostgreSQL y gestión interna de sus roles y usuarios.'),
  ('rol_interno_admin', 'CLIENT_INTERNAL_BASIC', 'Administrador de Empresa (Cuenta Admin)', 'Rol básico creado por defecto en la BD del cliente con acceso a todos sus módulos contratados y gestión de usuarios/roles.'),
  ('rol_interno_cajero', 'CLIENT_INTERNAL_BASIC', 'Cajero / Facturador', 'Rol básico para operación de caja, facturación y atención al cliente.'),
  ('rol_interno_bodega', 'CLIENT_INTERNAL_BASIC', 'Encargado de Inventario y Bodega', 'Rol básico para existencias, bodegas, traslados, lotes y báscula.'),
  ('rol_interno_operador', 'CLIENT_INTERNAL_BASIC', 'Operador de Servicio', 'Rol básico para comandas, mesas, reservas de cupos y emisión de tickets.')
ON CONFLICT ("role_code") DO NOTHING;
