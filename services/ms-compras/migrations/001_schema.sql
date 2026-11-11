CREATE SCHEMA IF NOT EXISTS procurement;

CREATE TABLE IF NOT EXISTS procurement.seq_counters (
  prefix VARCHAR(32) PRIMARY KEY,
  current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS procurement.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS procurement.suppliers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nit TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Bogotá D.C.',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS procurement.purchase_orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES procurement.suppliers(id) ON DELETE RESTRICT,
  supplier_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_nit TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  product_code TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL,
  warehouse_id TEXT NOT NULL DEFAULT '',
  warehouse_name TEXT NOT NULL DEFAULT 'Bodega Principal',
  qty NUMERIC(14, 2) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(19, 2) NOT NULL CHECK (unit_cost > 0),
  total_cost NUMERIC(19, 2) NOT NULL CHECK (total_cost > 0),
  inventory_synced BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'Recibida en Bodega',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_procurement_orders_supplier ON procurement.purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_created ON procurement.purchase_orders (created_at DESC);
