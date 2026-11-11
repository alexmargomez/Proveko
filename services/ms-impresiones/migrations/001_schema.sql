CREATE SCHEMA IF NOT EXISTS printing;

CREATE TABLE IF NOT EXISTS printing.idempotency_keys (
    idem_key   TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS printing.branding_configs (
    id              TEXT PRIMARY KEY DEFAULT 'primary',
    company_name    TEXT NOT NULL,
    nit             TEXT NOT NULL,
    tax_regime      TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    phone           TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    dian_resolution TEXT NOT NULL DEFAULT '',
    footer_warranty TEXT NOT NULL DEFAULT '',
    primary_color   TEXT NOT NULL DEFAULT '#023047',
    default_format  TEXT NOT NULL DEFAULT 'carta_membrete',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS printing.render_logs (
    id              BIGSERIAL PRIMARY KEY,
    document_type   TEXT NOT NULL,
    document_number TEXT NOT NULL,
    layout_variant  TEXT NOT NULL,
    customer_name   TEXT NOT NULL DEFAULT '',
    grand_total     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    rendered_by     TEXT NOT NULL DEFAULT '',
    rendered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printing_render_logs_doc
    ON printing.render_logs (document_number, rendered_at DESC);
