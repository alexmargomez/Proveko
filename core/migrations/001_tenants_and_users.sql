CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    nit TEXT NOT NULL,
    admin_username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    db_name TEXT NOT NULL UNIQUE,
    encrypted_dsn_envelope JSONB NOT NULL,
    business_preset TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_internal_roles (
    role_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    allowed_services JSONB NOT NULL DEFAULT '[]'::jsonb
);
