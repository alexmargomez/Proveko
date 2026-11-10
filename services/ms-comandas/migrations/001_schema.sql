CREATE SCHEMA IF NOT EXISTS comandas;

CREATE TABLE IF NOT EXISTS comandas.dining_tables (
    id          VARCHAR(32) PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    zone        VARCHAR(80) NOT NULL DEFAULT 'Salón Principal',
    waiter      VARCHAR(100) NOT NULL DEFAULT 'Mesero General',
    status      VARCHAR(32) NOT NULL DEFAULT 'Libre',
    total       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comandas.table_items (
    id          BIGSERIAL PRIMARY KEY,
    table_id    VARCHAR(32) NOT NULL REFERENCES comandas.dining_tables(id) ON DELETE CASCADE,
    product_id  VARCHAR(40) NOT NULL DEFAULT '',
    name        VARCHAR(160) NOT NULL,
    qty         NUMERIC(10, 2) NOT NULL CHECK (qty > 0),
    price       NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    note        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comandas_table_items_table ON comandas.table_items (table_id);
