ALTER TABLE core_control.tenants
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS maintenance_message TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_monthly_cop BIGINT NOT NULL DEFAULT 0;

ALTER TABLE core_control.tenant_users
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS core_control.platform_roles (
    role_key            TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    is_system           BOOLEAN NOT NULL DEFAULT FALSE,
    require_mfa         BOOLEAN NOT NULL DEFAULT FALSE,
    require_data_reason BOOLEAN NOT NULL DEFAULT TRUE,
    permissions         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS core_control.platform_users (
    user_id              TEXT PRIMARY KEY,
    email                TEXT NOT NULL UNIQUE,
    full_name            TEXT NOT NULL,
    password_hash        TEXT NOT NULL,
    role_key             TEXT NOT NULL REFERENCES core_control.platform_roles(role_key),
    status               TEXT NOT NULL DEFAULT 'ACTIVE',
    mfa_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_required         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_encrypted TEXT NOT NULL DEFAULT '',
    allowed_tenants      JSONB NOT NULL DEFAULT '["*"]'::jsonb,
    session_version      INTEGER NOT NULL DEFAULT 1,
    last_login_at        TEXT NOT NULL DEFAULT '',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_users_lower_email
    ON core_control.platform_users (LOWER(email));

CREATE TABLE IF NOT EXISTS core_control.catalog_overrides (
    override_key TEXT PRIMARY KEY,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TEXT NOT NULL
);
