CREATE SCHEMA IF NOT EXISTS gastro;

CREATE TABLE IF NOT EXISTS gastro.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gastro.idempotency_keys (
    idem_key      VARCHAR(160) PRIMARY KEY,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gastro.menu_items (
    id         VARCHAR(48) PRIMARY KEY,
    code       VARCHAR(32) NOT NULL UNIQUE,
    name       VARCHAR(160) NOT NULL,
    category   VARCHAR(80) NOT NULL DEFAULT 'Restaurante',
    sale_price NUMERIC(18, 2) NOT NULL CHECK (sale_price > 0),
    tax_pct    NUMERIC(6, 2) NOT NULL DEFAULT 8 CHECK (tax_pct >= 0 AND tax_pct <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gastro.dining_tables (
    id               VARCHAR(48) PRIMARY KEY,
    name             VARCHAR(80) NOT NULL,
    zone             VARCHAR(80) NOT NULL DEFAULT 'Salón Principal',
    waiter           VARCHAR(100) NOT NULL DEFAULT 'Mesero Turno',
    status           VARCHAR(32) NOT NULL DEFAULT 'Libre',
    total            NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    order_code       VARCHAR(32) NOT NULL DEFAULT '',
    channel          VARCHAR(24) NOT NULL DEFAULT 'MESA',
    order_stage      VARCHAR(24) NOT NULL DEFAULT 'LIBRE',
    customer_name    VARCHAR(140) NOT NULL DEFAULT '',
    customer_phone   VARCHAR(48) NOT NULL DEFAULT '',
    delivery_address VARCHAR(240) NOT NULL DEFAULT '',
    guests           INTEGER NOT NULL DEFAULT 0 CHECK (guests >= 0),
    payment_hint     VARCHAR(120) NOT NULL DEFAULT '',
    opened_at        VARCHAR(40) NOT NULL DEFAULT '',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS order_code VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS channel VARCHAR(24) NOT NULL DEFAULT 'MESA';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS order_stage VARCHAR(24) NOT NULL DEFAULT 'LIBRE';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS customer_name VARCHAR(140) NOT NULL DEFAULT '';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(48) NOT NULL DEFAULT '';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(240) NOT NULL DEFAULT '';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS guests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS payment_hint VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE gastro.dining_tables ADD COLUMN IF NOT EXISTS opened_at VARCHAR(40) NOT NULL DEFAULT '';

UPDATE gastro.dining_tables
SET order_stage = CASE
    WHEN status = 'En Cocina' THEN 'PREPARANDO'
    WHEN status = 'Ocupada' THEN 'NUEVA'
    ELSE 'LIBRE'
END
WHERE order_stage = 'LIBRE' AND status <> 'Libre';

UPDATE gastro.dining_tables
SET channel = 'MESA'
WHERE channel = '';

CREATE TABLE IF NOT EXISTS gastro.table_items (
    item_id    VARCHAR(48) PRIMARY KEY,
    table_id   VARCHAR(48) NOT NULL REFERENCES gastro.dining_tables(id) ON DELETE CASCADE,
    product_id VARCHAR(48) NOT NULL DEFAULT '',
    name       VARCHAR(160) NOT NULL,
    qty        NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
    price      NUMERIC(18, 2) NOT NULL CHECK (price > 0),
    note       TEXT NOT NULL DEFAULT '',
    sort_order BIGSERIAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastro_table_items_table ON gastro.table_items (table_id, sort_order ASC);
