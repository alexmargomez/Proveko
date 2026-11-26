CREATE SCHEMA IF NOT EXISTS platform_admin;

CREATE TABLE IF NOT EXISTS platform_admin.audit_logs (
    log_id         TEXT PRIMARY KEY,
    actor_user_id  TEXT NOT NULL,
    actor_email    TEXT NOT NULL,
    actor_role     TEXT NOT NULL,
    action         TEXT NOT NULL,
    target_type    TEXT NOT NULL,
    target_id      TEXT NOT NULL DEFAULT '',
    tenant_id      TEXT NOT NULL DEFAULT '',
    reason         TEXT NOT NULL DEFAULT '',
    before_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address     TEXT NOT NULL DEFAULT '',
    user_agent     TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'SUCCESS',
    created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON platform_admin.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON platform_admin.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON platform_admin.audit_logs (actor_email, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_admin.tenant_metadata (
    tenant_id           TEXT PRIMARY KEY,
    billing_notes       TEXT NOT NULL DEFAULT '',
    support_tier        TEXT NOT NULL DEFAULT 'STANDARD',
    internal_tags       JSONB NOT NULL DEFAULT '[]'::jsonb,
    account_manager     TEXT NOT NULL DEFAULT '',
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_admin.feature_flags (
    flag_key            TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    enabled_global      BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_tenants     JSONB NOT NULL DEFAULT '[]'::jsonb,
    disabled_tenants    JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_by          TEXT NOT NULL DEFAULT '',
    updated_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_admin.announcements (
    announcement_id     TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    severity            TEXT NOT NULL DEFAULT 'INFO',
    target_scope        TEXT NOT NULL DEFAULT 'ALL',
    target_tenants      JSONB NOT NULL DEFAULT '[]'::jsonb,
    starts_at           TEXT NOT NULL DEFAULT '',
    ends_at             TEXT NOT NULL DEFAULT '',
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_admin.export_jobs (
    job_id              TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    company_name        TEXT NOT NULL DEFAULT '',
    requested_by        TEXT NOT NULL,
    reason              TEXT NOT NULL DEFAULT '',
    services_included   JSONB NOT NULL DEFAULT '[]'::jsonb,
    status              TEXT NOT NULL DEFAULT 'COMPLETED',
    file_size_bytes     BIGINT NOT NULL DEFAULT 0,
    zip_bytes           BYTEA,
    error_message       TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL,
    expires_at          TEXT NOT NULL
);
