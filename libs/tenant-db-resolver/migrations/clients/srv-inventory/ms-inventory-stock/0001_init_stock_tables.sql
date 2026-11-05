-- Migration: 0001_init_stock_tables.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-stock (stk_)
-- Expansión Enterprise: Categorías PUC, Bodegas WMS, Ubicaciones, Kardex Valorizado, Toma Ciega, Actas Recepción Técnica (v2) y Báscula
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.stk_categories (
  category_id VARCHAR(64) PRIMARY KEY,
  category_code VARCHAR(32) NOT NULL UNIQUE,
  category_name VARCHAR(140) NOT NULL,
  puc_inventory_account VARCHAR(16) NOT NULL DEFAULT '143501',
  puc_cogs_account VARCHAR(16) NOT NULL DEFAULT '613501',
  puc_revenue_account VARCHAR(16) NOT NULL DEFAULT '413501',
  default_iva_rate NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_warehouses (
  warehouse_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  warehouse_code VARCHAR(32) NOT NULL UNIQUE,
  warehouse_name VARCHAR(160) NOT NULL,
  city_location VARCHAR(160) NOT NULL DEFAULT 'Barranquilla — Vía 40',
  capacity_description VARCHAR(120) NOT NULL DEFAULT '800 Ton / 240 Estibas',
  manager_signature VARCHAR(160) NOT NULL DEFAULT 'Firmado: Jorge Pardo',
  is_quarantine_warehouse BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_warehouse_locations (
  location_id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  aisle_code VARCHAR(16) NOT NULL DEFAULT 'PAS-01',
  rack_code VARCHAR(16) NOT NULL DEFAULT 'EST-A',
  bin_level VARCHAR(16) NOT NULL DEFAULT 'NIV-01',
  max_weight_kg NUMERIC(12, 2) NOT NULL DEFAULT 2500,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_items (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  category_id VARCHAR(64) REFERENCES srv_inventory.stk_categories(category_id) ON DELETE SET NULL,
  sku VARCHAR(64) NOT NULL,
  barcode_ean VARCHAR(64),
  unspsc_dian_code VARCHAR(24) NOT NULL DEFAULT '30111601',
  name VARCHAR(160) NOT NULL,
  uom_dian_code VARCHAR(16) NOT NULL DEFAULT '94_UNIDAD',
  quantity_on_hand NUMERIC(19, 4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  sale_price_cop NUMERIC(19, 4) NOT NULL DEFAULT 0,
  tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  tracks_lots_fefo BOOLEAN NOT NULL DEFAULT FALSE,
  tracks_serials BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS category_id VARCHAR(64) REFERENCES srv_inventory.stk_categories(category_id) ON DELETE SET NULL;
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS barcode_ean VARCHAR(64);
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS unspsc_dian_code VARCHAR(24) NOT NULL DEFAULT '30111601';
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS uom_dian_code VARCHAR(16) NOT NULL DEFAULT '94_UNIDAD';
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS sale_price_cop NUMERIC(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 19.00;
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS tracks_lots_fefo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS tracks_serials BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE srv_inventory.stk_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS srv_inventory.stk_item_variants_serials (
  variant_id VARCHAR(64) PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES srv_inventory.stk_items(id) ON DELETE CASCADE,
  serial_or_imei VARCHAR(80) NOT NULL,
  attribute_size VARCHAR(32),
  attribute_color VARCHAR(32),
  status VARCHAR(24) NOT NULL DEFAULT 'IN_STOCK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_warehouse_balances (
  balance_id VARCHAR(64) PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES srv_inventory.stk_items(id) ON DELETE CASCADE,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  on_hand_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  reserved_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  weighted_average_cost NUMERIC(19, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_kardex_ledger (
  kardex_id VARCHAR(64) PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES srv_inventory.stk_items(id) ON DELETE CASCADE,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  movement_type VARCHAR(32) NOT NULL DEFAULT 'PURCHASE_RECEIPT',
  source_document VARCHAR(64) NOT NULL,
  qty_in NUMERIC(19, 4) NOT NULL DEFAULT 0,
  qty_out NUMERIC(19, 4) NOT NULL DEFAULT 0,
  balance_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  unit_cost_cop NUMERIC(19, 4) NOT NULL DEFAULT 0,
  average_cost_after_cop NUMERIC(19, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_physical_count_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  session_code VARCHAR(48) NOT NULL UNIQUE,
  is_blind_count BOOLEAN NOT NULL DEFAULT TRUE,
  items_counted INTEGER NOT NULL DEFAULT 0,
  net_variance_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  auditor_name VARCHAR(140) NOT NULL DEFAULT 'Auditoría Interna',
  status VARCHAR(24) NOT NULL DEFAULT 'ADJUSTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_physical_count_lines (
  line_id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_physical_count_sessions(session_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES srv_inventory.stk_items(id) ON DELETE CASCADE,
  system_expected_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  blind_counted_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  variance_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  variance_cost_cop NUMERIC(19, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_technical_reception_actas (
  acta_id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  acta_number VARCHAR(48) NOT NULL UNIQUE,
  supplier_name VARCHAR(160) NOT NULL,
  supplier_invoice_ref VARCHAR(64) NOT NULL,
  sanitary_registration_invima VARCHAR(64) NOT NULL DEFAULT 'INVIMA-2026M-00148',
  measured_temperature_celsius NUMERIC(5, 2) NOT NULL DEFAULT 4.20,
  packaging_integrity VARCHAR(48) NOT NULL DEFAULT 'INTEGRO_SELLADO',
  technical_concept VARCHAR(48) NOT NULL DEFAULT 'APROBADO_DISPONIBLE',
  inspector_signature VARCHAR(160) NOT NULL DEFAULT 'QF. Daniela Vargas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_inventory.stk_weighbridge_tickets (
  ticket_id VARCHAR(64) PRIMARY KEY,
  warehouse_id VARCHAR(64) NOT NULL REFERENCES srv_inventory.stk_warehouses(warehouse_id) ON DELETE CASCADE,
  ticket_number VARCHAR(48) NOT NULL UNIQUE,
  truck_plate VARCHAR(32) NOT NULL,
  driver_name VARCHAR(160) NOT NULL,
  carrier_company VARCHAR(160) NOT NULL,
  gross_weight_kg NUMERIC(14, 2) NOT NULL,
  tare_weight_kg NUMERIC(14, 2) NOT NULL,
  net_weight_kg NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_inventory.stk_categories (category_id, category_code, category_name)
VALUES ('cat-general', 'CAT-GEN-01', 'Insumos y Mercancía para la Venta')
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO srv_inventory.stk_warehouses (warehouse_id, warehouse_code, warehouse_name, city_location, capacity_description, manager_signature)
VALUES
  ('wh-central', 'BOD-CENTRAL-01', 'Bodega Central Principal', 'Barranquilla — Vía 40', '800 Ton / 240 Estibas', 'Firmado: Jorge Pardo'),
  ('wh-norte', 'BOD-NORTE-02', 'Bodega Norte Punto Venta', 'Cartagena — Mamonal', '450 Ton / 120 Estibas', 'Firmado: Andrés Mejía')
ON CONFLICT (warehouse_id) DO NOTHING;

INSERT INTO srv_inventory.stk_items (id, branch_id, category_id, sku, name, quantity_on_hand, unit_cost, sale_price_cop)
VALUES
  ('22222222-2222-4222-8222-222222222101', 'br-main', 'cat-general', 'INS-00104', 'Cemento Gris Estructural 50Kg', 420, 31500, 41900),
  ('22222222-2222-4222-8222-222222222102', 'br-main', 'cat-general', 'INS-00219', 'Acero Figurado 1/2 Pulgada', 185, 42000, 56500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO srv_inventory.stk_technical_reception_actas (acta_id, warehouse_id, acta_number, supplier_name, supplier_invoice_ref, measured_temperature_celsius, technical_concept)
VALUES ('act-rec-118', 'wh-central', 'ACT-REC-2026-118', 'Distribuidora Nacional de Insumos S.A.S.', 'FE-99412', 4.20, 'APROBADO_DISPONIBLE')
ON CONFLICT (acta_id) DO NOTHING;

INSERT INTO srv_inventory.stk_physical_count_sessions (session_id, warehouse_id, session_code, is_blind_count, items_counted, net_variance_cop)
VALUES ('tom-2026-09', 'wh-central', 'TOM-CIEGA-2026-09', TRUE, 145, -48000)
ON CONFLICT (session_id) DO NOTHING;
