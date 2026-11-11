CREATE TABLE IF NOT EXISTS core_control.tenant_microservices (
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    service_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (tenant_id, service_key)
);

CREATE TABLE IF NOT EXISTS core_control.tenant_modules (
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    service_key TEXT NOT NULL,
    module_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (tenant_id, module_key)
);

CREATE TABLE IF NOT EXISTS core_control.tenant_submodules (
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    service_key TEXT NOT NULL,
    depends_on_module TEXT NOT NULL DEFAULT '',
    submodule_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (tenant_id, submodule_key)
);

CREATE TABLE IF NOT EXISTS core_control.tenant_features (
    tenant_id TEXT NOT NULL REFERENCES core_control.tenants(tenant_id) ON DELETE CASCADE,
    service_key TEXT NOT NULL,
    depends_on_module TEXT NOT NULL DEFAULT '',
    depends_on_submodule TEXT NOT NULL DEFAULT '',
    feature_key TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (tenant_id, feature_key)
);

ALTER TABLE core_control.tenant_features
    ADD COLUMN IF NOT EXISTS depends_on_submodule TEXT NOT NULL DEFAULT '';
