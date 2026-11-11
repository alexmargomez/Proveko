CREATE SCHEMA IF NOT EXISTS invoicing;

CREATE TABLE IF NOT EXISTS invoicing.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoicing.invoices (
    id               TEXT PRIMARY KEY,
    cufe             TEXT NOT NULL DEFAULT '',
    dian_status      TEXT NOT NULL DEFAULT '',
    issue_date       TEXT NOT NULL,
    customer_id      TEXT NOT NULL DEFAULT '',
    customer_name    TEXT NOT NULL,
    customer_nit     TEXT NOT NULL DEFAULT '',
    customer_phone   TEXT NOT NULL DEFAULT '',
    customer_address TEXT NOT NULL DEFAULT '',
    contract_id      TEXT NOT NULL DEFAULT '',
    discount_pct     NUMERIC(6, 2) NOT NULL DEFAULT 0,
    vehicle_id       TEXT NOT NULL DEFAULT '',
    plate            TEXT NOT NULL DEFAULT '',
    mechanic_id      TEXT NOT NULL DEFAULT '',
    mechanic_name    TEXT NOT NULL DEFAULT '',
    workshop_meta    JSONB NOT NULL DEFAULT '{}'::jsonb,
    linked_room_id   TEXT NOT NULL DEFAULT '',
    linked_table_id  TEXT NOT NULL DEFAULT '',
    layout_variant   TEXT NOT NULL DEFAULT '',
    subtotal         NUMERIC(18, 2) NOT NULL DEFAULT 0,
    discount_total   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_total        NUMERIC(18, 2) NOT NULL DEFAULT 0,
    total            NUMERIC(18, 2) NOT NULL DEFAULT 0,
    payment_method   TEXT NOT NULL DEFAULT 'Efectivo',
    amount_paid      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    pending_balance  NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'Pagada',
    notes            TEXT NOT NULL DEFAULT '',
    actor            TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS dian_status TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS customer_address TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0;
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS linked_room_id TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS linked_table_id TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoices ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS invoicing.invoice_items (
    id           BIGSERIAL PRIMARY KEY,
    invoice_id   TEXT NOT NULL REFERENCES invoicing.invoices(id) ON DELETE CASCADE,
    product_id   TEXT NOT NULL DEFAULT '',
    code         TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    item_type    TEXT NOT NULL DEFAULT 'PRODUCTO',
    quantity     NUMERIC(18, 3) NOT NULL DEFAULT 1,
    unit_price   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_pct      NUMERIC(6, 2) NOT NULL DEFAULT 0,
    subtotal     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    worker_id    TEXT NOT NULL DEFAULT '',
    worker_name  TEXT NOT NULL DEFAULT ''
);

ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS product_id TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'PRODUCTO';
ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 3) NOT NULL DEFAULT 1;
ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;
ALTER TABLE invoicing.invoice_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18, 2) NOT NULL DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS invoicing.idempotency_keys (
    idem_key   TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoicing_invoices_customer ON invoicing.invoices (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoicing_invoices_plate ON invoicing.invoices (plate);
CREATE INDEX IF NOT EXISTS idx_invoicing_items_invoice ON invoicing.invoice_items (invoice_id);
