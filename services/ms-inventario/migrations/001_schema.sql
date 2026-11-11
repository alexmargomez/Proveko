CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory.idempotency_keys (
    idem_key   TEXT PRIMARY KEY,
    payload    JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.warehouses (
    id         TEXT PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    location   TEXT NOT NULL DEFAULT '',
    manager    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.products (
    id             TEXT PRIMARY KEY,
    code           TEXT NOT NULL,
    name           TEXT NOT NULL,
    category       TEXT NOT NULL DEFAULT 'General',
    warehouse_id   TEXT NOT NULL REFERENCES inventory.warehouses(id) ON DELETE RESTRICT,
    warehouse_name TEXT NOT NULL DEFAULT '',
    supplier_id    TEXT NOT NULL DEFAULT '',
    supplier_name  TEXT NOT NULL DEFAULT '',
    cost_price     NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    sale_price     NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    tax_pct        NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (tax_pct >= 0),
    stock          NUMERIC(18, 3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock      NUMERIC(18, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    lot_code       TEXT NOT NULL DEFAULT '',
    expiry_date    TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.kardex_movements (
    id             TEXT PRIMARY KEY,
    movement_date  TEXT NOT NULL,
    movement_type  TEXT NOT NULL,
    product_id     TEXT NOT NULL DEFAULT '',
    product_code   TEXT NOT NULL DEFAULT '',
    product_name   TEXT NOT NULL,
    warehouse_id   TEXT NOT NULL DEFAULT '',
    warehouse_name TEXT NOT NULL DEFAULT '',
    qty            NUMERIC(18, 3) NOT NULL,
    unit_cost      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    balance_after  NUMERIC(18, 3) NOT NULL DEFAULT 0 CHECK (balance_after >= 0),
    reference_doc  TEXT NOT NULL DEFAULT '',
    actor          TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.supply_requests (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    req_date     TEXT NOT NULL,
    area         TEXT NOT NULL DEFAULT '',
    product_id   TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    qty          NUMERIC(18, 3) NOT NULL CHECK (qty > 0),
    status       TEXT NOT NULL DEFAULT 'Pendiente',
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_warehouse ON inventory.products (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_code ON inventory.products (code);
CREATE INDEX IF NOT EXISTS idx_inventory_kardex_created ON inventory.kardex_movements (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_requests_created ON inventory.supply_requests (created_at DESC, code DESC);
