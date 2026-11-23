ALTER TABLE core_control.tenants
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'ACTIVA_VERIFICADA',
    ADD COLUMN IF NOT EXISTS monthly_cop BIGINT NOT NULL DEFAULT 169000,
    ADD COLUMN IF NOT EXISTS max_users_allowed INT NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE core_control.tenants
SET is_demo = TRUE
WHERE tenant_id = 'demo-empresa' AND is_demo = FALSE;

CREATE TABLE IF NOT EXISTS core_control.tenant_users (
    user_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL DEFAULT '',
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    internal_role TEXT NOT NULL DEFAULT 'admin_empresa',
    is_company_admin BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_users_lower_username ON core_control.tenant_users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON core_control.tenant_users(tenant_id);

INSERT INTO core_control.tenant_users (
    user_id, tenant_id, username, email, full_name, password_hash,
    internal_role, is_company_admin, allowed_services, allowed_modules, status, created_at
)
SELECT
    'usr_' || t.tenant_id,
    t.tenant_id,
    LOWER(TRIM(t.admin_username)),
    LOWER(TRIM(t.admin_username)),
    'Administrador ' || t.company_name,
    t.password_hash,
    'admin_empresa',
    TRUE,
    '["*"]'::jsonb,
    '["*"]'::jsonb,
    'ACTIVE',
    t.created_at
FROM core_control.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM core_control.tenant_users u WHERE u.user_id = 'usr_' || t.tenant_id
)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS core_control.module_activation_requests (
    request_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL,
    added_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    added_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    added_submodules JSONB NOT NULL DEFAULT '[]'::jsonb,
    added_features JSONB NOT NULL DEFAULT '[]'::jsonb,
    monthly_cop_after BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'APLICADA',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_requests_tenant_created ON core_control.module_activation_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_requests_created ON core_control.module_activation_requests(created_at DESC);
