CREATE SCHEMA IF NOT EXISTS compras;

CREATE TABLE IF NOT EXISTS compras.proveedores (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nit TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras.ordenes_compra (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  warehouse_name TEXT NOT NULL,
  qty NUMERIC(14, 2) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(19, 4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(19, 4) NOT NULL CHECK (total_cost >= 0),
  status TEXT NOT NULL DEFAULT 'Recibida en Bodega',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_ordenes_supplier ON compras.ordenes_compra (supplier_id);
CREATE INDEX IF NOT EXISTS idx_compras_ordenes_created ON compras.ordenes_compra (created_at DESC);
