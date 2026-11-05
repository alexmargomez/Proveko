-- Migration: 0001_init_transfers_table.sql
-- Microservice: ms:inventory (srv_inventory) & srv_procurement (Compras, Proveedores, RADIAN y Doc Soporte DIAN)
CREATE SCHEMA IF NOT EXISTS srv_inventory;
CREATE SCHEMA IF NOT EXISTS srv_procurement;

CREATE TABLE IF NOT EXISTS srv_inventory.trf_transfers (
  id UUID PRIMARY KEY,
  origin_branch_id VARCHAR(64) NOT NULL,
  destination_branch_id VARCHAR(64) NOT NULL,
  carrier_name VARCHAR(160) NOT NULL DEFAULT 'Transportes Rápidos del Norte S.A.S.',
  manager_signature VARCHAR(160) NOT NULL DEFAULT 'Autorizado: Jorge Pardo',
  status VARCHAR(24) NOT NULL DEFAULT 'IN_TRANSIT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE srv_inventory.trf_transfers ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(160) NOT NULL DEFAULT 'Transportes Rápidos del Norte S.A.S.';
ALTER TABLE srv_inventory.trf_transfers ADD COLUMN IF NOT EXISTS manager_signature VARCHAR(160) NOT NULL DEFAULT 'Autorizado: Jorge Pardo';

CREATE TABLE IF NOT EXISTS srv_inventory.trf_transfer_lines (
  transfer_line_id VARCHAR(64) PRIMARY KEY,
  transfer_id UUID NOT NULL REFERENCES srv_inventory.trf_transfers(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  item_description VARCHAR(160) NOT NULL,
  dispatched_qty NUMERIC(19, 4) NOT NULL,
  received_qty NUMERIC(19, 4) NOT NULL DEFAULT 0
);

-- ============================================================================
-- ESQUEMA: srv_procurement (Compras, Órdenes de Compra v2, Facturas Proveedor, DSE y RADIAN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_procurement.prc_purchase_requisitions (
  requisition_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  requisition_code VARCHAR(48) NOT NULL UNIQUE,
  requested_by VARCHAR(140) NOT NULL,
  justification TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_purchase_orders (
  po_id VARCHAR(64) PRIMARY KEY,
  requisition_id VARCHAR(64) REFERENCES srv_procurement.prc_purchase_requisitions(requisition_id) ON DELETE SET NULL,
  po_number VARCHAR(48) NOT NULL UNIQUE,
  supplier_nit VARCHAR(32) NOT NULL,
  supplier_name VARCHAR(180) NOT NULL,
  target_warehouse_code VARCHAR(32) NOT NULL DEFAULT 'BOD-CENTRAL-01',
  approval_signature VARCHAR(160) NOT NULL DEFAULT 'Aprobado: Gerencia de Compras',
  subtotal_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  iva_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  total_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  receipt_status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED_FULL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_purchase_order_lines (
  po_line_id VARCHAR(64) PRIMARY KEY,
  po_id VARCHAR(64) NOT NULL REFERENCES srv_procurement.prc_purchase_orders(po_id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  ordered_qty NUMERIC(19, 4) NOT NULL,
  received_qty NUMERIC(19, 4) NOT NULL DEFAULT 0,
  unit_cost_cop NUMERIC(19, 2) NOT NULL,
  iva_pct NUMERIC(5, 2) NOT NULL DEFAULT 19.00
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_goods_receipt_notes (
  grn_id VARCHAR(64) PRIMARY KEY,
  po_id VARCHAR(64) NOT NULL REFERENCES srv_procurement.prc_purchase_orders(po_id) ON DELETE CASCADE,
  grn_number VARCHAR(48) NOT NULL UNIQUE,
  warehouse_code VARCHAR(32) NOT NULL DEFAULT 'BOD-CENTRAL-01',
  received_by VARCHAR(140) NOT NULL DEFAULT 'Jorge Pardo',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_purchase_invoices (
  purchase_invoice_id VARCHAR(64) PRIMARY KEY,
  po_id VARCHAR(64) REFERENCES srv_procurement.prc_purchase_orders(po_id) ON DELETE SET NULL,
  supplier_invoice_number VARCHAR(48) NOT NULL,
  supplier_nit VARCHAR(32) NOT NULL,
  supplier_name VARCHAR(180) NOT NULL,
  subtotal_cop NUMERIC(19, 2) NOT NULL,
  iva_deductible_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  retefuente_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  reteica_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  net_payable_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'POSTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_support_documents_dian (
  dse_id VARCHAR(64) PRIMARY KEY,
  dse_consecutive VARCHAR(48) NOT NULL UNIQUE,
  supplier_cc_nit VARCHAR(32) NOT NULL,
  supplier_natural_name VARCHAR(180) NOT NULL,
  service_concept TEXT NOT NULL,
  gross_amount_cop NUMERIC(19, 2) NOT NULL,
  withholding_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  net_amount_cop NUMERIC(19, 2) NOT NULL,
  cuds_hash VARCHAR(128) NOT NULL,
  dian_status VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED_DIAN',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_radian_events (
  radian_event_id VARCHAR(64) PRIMARY KEY,
  purchase_invoice_id VARCHAR(64) REFERENCES srv_procurement.prc_purchase_invoices(purchase_invoice_id) ON DELETE CASCADE,
  supplier_invoice_number VARCHAR(48) NOT NULL,
  supplier_name VARCHAR(180) NOT NULL,
  cufe_hash VARCHAR(128) NOT NULL,
  event_code VARCHAR(16) NOT NULL DEFAULT '033_ACEPTACION',
  dian_response_status VARCHAR(32) NOT NULL DEFAULT 'TITULO_VALOR_OK',
  invoice_amount_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_procurement.prc_landed_cost_allocations (
  allocation_id VARCHAR(64) PRIMARY KEY,
  grn_id VARCHAR(64) REFERENCES srv_procurement.prc_goods_receipt_notes(grn_id) ON DELETE SET NULL,
  allocation_code VARCHAR(48) NOT NULL UNIQUE,
  freight_concept VARCHAR(180) NOT NULL,
  allocation_method VARCHAR(32) NOT NULL DEFAULT 'BY_WEIGHT_KG',
  distributed_amount_cop NUMERIC(19, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_procurement.prc_purchase_orders (po_id, po_number, supplier_nit, supplier_name, subtotal_cop, iva_cop, total_cop)
VALUES ('po-2026-418', 'OC-2026-00418', '900.412.889-1', 'Distribuidora Nacional de Insumos S.A.S.', 4075630, 774370, 4850000)
ON CONFLICT (po_id) DO NOTHING;

INSERT INTO srv_procurement.prc_purchase_invoices (purchase_invoice_id, po_id, supplier_invoice_number, supplier_nit, supplier_name, subtotal_cop, iva_deductible_cop, retefuente_cop, net_payable_cop)
VALUES ('pi-fe-99412', 'po-2026-418', 'FE-99412', '901.220.410-8', 'Importadora Andina S.A.S.', 4672414, 887759, 140173, 5420000)
ON CONFLICT (purchase_invoice_id) DO NOTHING;

INSERT INTO srv_procurement.prc_support_documents_dian (dse_id, dse_consecutive, supplier_cc_nit, supplier_natural_name, service_concept, gross_amount_cop, withholding_cop, net_amount_cop, cuds_hash)
VALUES ('dse-00215', 'DSE-000215', '79.884.120', 'Jairo Alberto Méndez', 'Mantenimiento Eléctrico Sede Norte', 1010638, 60638, 950000, 'CUDS-sha384-2026-000215-dian-ok')
ON CONFLICT (dse_id) DO NOTHING;

INSERT INTO srv_procurement.prc_radian_events (radian_event_id, purchase_invoice_id, supplier_invoice_number, supplier_name, cufe_hash, event_code, invoice_amount_cop)
VALUES ('rad-88410', 'pi-fe-99412', 'FEV-88410', 'Licores y Bebidas Nacionales S.A.', 'CUFE-radian-88410-ok', '033_ACEPTACION', 3680000)
ON CONFLICT (radian_event_id) DO NOTHING;
