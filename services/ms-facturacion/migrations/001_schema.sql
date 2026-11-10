CREATE SCHEMA IF NOT EXISTS invoicing;

CREATE TABLE IF NOT EXISTS invoicing.invoices (
    id              TEXT PRIMARY KEY,
    cufe            TEXT NOT NULL DEFAULT '',
    issue_date      TEXT NOT NULL,
    customer_id     TEXT NOT NULL DEFAULT '',
    customer_name   TEXT NOT NULL,
    customer_nit    TEXT NOT NULL DEFAULT '',
    contract_id     TEXT NOT NULL DEFAULT '',
    vehicle_id      TEXT NOT NULL DEFAULT '',
    plate           TEXT NOT NULL DEFAULT '',
    mechanic_id     TEXT NOT NULL DEFAULT '',
    mechanic_name   TEXT NOT NULL DEFAULT '',
    workshop_meta   JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout_variant  TEXT NOT NULL DEFAULT '',
    subtotal        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total           NUMERIC(18, 2) NOT NULL DEFAULT 0,
    payment_method  TEXT NOT NULL DEFAULT 'Efectivo',
    amount_paid     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    pending_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'Pagada',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoicing.invoice_items (
    id          BIGSERIAL PRIMARY KEY,
    invoice_id  TEXT NOT NULL REFERENCES invoicing.invoices(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'PRODUCTO',
    ref_id      TEXT NOT NULL DEFAULT '',
    code        TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL,
    qty         NUMERIC(18, 3) NOT NULL DEFAULT 1,
    price       NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_pct     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    worker_id   TEXT NOT NULL DEFAULT '',
    worker_name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS invoicing.quotes (
    id            TEXT PRIMARY KEY,
    created_at    TEXT NOT NULL,
    customer_id   TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL,
    customer_nit  TEXT NOT NULL DEFAULT '',
    valid_until   TEXT NOT NULL DEFAULT '',
    items_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_total     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'Vigente',
    notes         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_invoicing_invoices_customer ON invoicing.invoices (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoicing_invoices_plate ON invoicing.invoices (plate);
CREATE INDEX IF NOT EXISTS idx_invoicing_items_invoice ON invoicing.invoice_items (invoice_id);
