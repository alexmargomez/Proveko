CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.warehouses (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    city       TEXT NOT NULL DEFAULT '',
    manager    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.products (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'General',
    warehouse_id TEXT REFERENCES inventory.warehouses(id) ON DELETE SET NULL,
    supplier_id  TEXT NOT NULL DEFAULT '',
    cost_price   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    sale_price   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    tax_pct      NUMERIC(6, 2) NOT NULL DEFAULT 0,
    stock        NUMERIC(18, 3) NOT NULL DEFAULT 0,
    min_stock    NUMERIC(18, 3) NOT NULL DEFAULT 0,
    lot_code     TEXT NOT NULL DEFAULT '',
    expiry_date  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.kardex_movements (
    id            TEXT PRIMARY KEY,
    movement_date TEXT NOT NULL,
    product_id    TEXT REFERENCES inventory.products(id) ON DELETE SET NULL,
    product_name  TEXT NOT NULL,
    warehouse_id  TEXT REFERENCES inventory.warehouses(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL,
    qty           NUMERIC(18, 3) NOT NULL,
    unit_cost     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    balance_after NUMERIC(18, 3) NOT NULL DEFAULT 0,
    reference_doc TEXT NOT NULL DEFAULT '',
    actor         TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.supply_requests (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    product_id   TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    warehouse_id TEXT NOT NULL DEFAULT '',
    qty          NUMERIC(18, 3) NOT NULL DEFAULT 1,
    requester    TEXT NOT NULL DEFAULT '',
    priority     TEXT NOT NULL DEFAULT 'Normal',
    status       TEXT NOT NULL DEFAULT 'Pendiente',
    notes        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_warehouse ON inventory.products (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_kardex_product ON inventory.kardex_movements (product_id, created_at DESC);
