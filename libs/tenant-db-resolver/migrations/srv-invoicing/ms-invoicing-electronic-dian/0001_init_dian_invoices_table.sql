-- Migration: 0001_init_dian_invoices_table.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-electronic-dian (dian_)
-- Expansión Enterprise: Resoluciones DIAN, Factura Electrónica UBL 2.1 v1.9, Líneas, Impuestos/Retenciones y Notas Crédito/Débito
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_numbering_resolutions (
  resolution_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  document_type VARCHAR(32) NOT NULL DEFAULT 'FEV_FACTURA_VENTA',
  resolution_number VARCHAR(48) NOT NULL,
  prefix VARCHAR(12) NOT NULL,
  range_from BIGINT NOT NULL DEFAULT 1,
  range_to BIGINT NOT NULL DEFAULT 50000,
  current_consecutive BIGINT NOT NULL DEFAULT 10421,
  technical_key VARCHAR(128) NOT NULL DEFAULT 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '365 days'),
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_electronic_invoices (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  resolution_id VARCHAR(64) REFERENCES srv_invoicing.dian_numbering_resolutions(resolution_id) ON DELETE SET NULL,
  prefix_and_number VARCHAR(32) NOT NULL DEFAULT 'FEV-10421',
  invoice_number VARCHAR(32) NOT NULL DEFAULT 'FEV-10421',
  cufe_sha384 VARCHAR(128) NOT NULL DEFAULT 'CUFE-sha384-fev10421-dian-validado-2026',
  cufe_hash VARCHAR(128) NOT NULL DEFAULT 'CUFE-sha384-fev10421-dian-validado-2026',
  customer_nit VARCHAR(32) NOT NULL DEFAULT '901.452.110-4',
  contact_id VARCHAR(64) NOT NULL DEFAULT '11111111-1111-4111-8111-111111111101',
  buyer_legal_name VARCHAR(180) NOT NULL DEFAULT 'Comercializadora del Valle S.A.S.',
  buyer_nit VARCHAR(32) NOT NULL DEFAULT '901.452.110-4',
  qr_url TEXT,
  subtotal NUMERIC(19, 4) NOT NULL DEFAULT 4075630,
  iva_tax NUMERIC(19, 4) NOT NULL DEFAULT 774370,
  grand_total NUMERIC(19, 4) NOT NULL DEFAULT 4850000,
  subtotal_cop NUMERIC(19, 4) NOT NULL DEFAULT 4075630,
  tax_iva_cop NUMERIC(19, 4) NOT NULL DEFAULT 774370,
  withholdings_cop NUMERIC(19, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(19, 4) NOT NULL DEFAULT 4850000,
  dian_status VARCHAR(24) NOT NULL DEFAULT 'ACCEPTED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS resolution_id VARCHAR(64) REFERENCES srv_invoicing.dian_numbering_resolutions(resolution_id) ON DELETE SET NULL;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS prefix_and_number VARCHAR(32) NOT NULL DEFAULT 'FEV-10421';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32) NOT NULL DEFAULT 'FEV-10421';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS cufe_sha384 VARCHAR(128) NOT NULL DEFAULT 'CUFE-sha384-fev10421-dian-validado-2026';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS cufe_hash VARCHAR(128) NOT NULL DEFAULT 'CUFE-sha384-fev10421-dian-validado-2026';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS customer_nit VARCHAR(32) NOT NULL DEFAULT '901.452.110-4';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS contact_id VARCHAR(64) NOT NULL DEFAULT '11111111-1111-4111-8111-111111111101';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS buyer_legal_name VARCHAR(180) NOT NULL DEFAULT 'Comercializadora del Valle S.A.S.';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS buyer_nit VARCHAR(32) NOT NULL DEFAULT '901.452.110-4';
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS qr_url TEXT;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(19, 4) NOT NULL DEFAULT 4075630;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS iva_tax NUMERIC(19, 4) NOT NULL DEFAULT 774370;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(19, 4) NOT NULL DEFAULT 4850000;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS subtotal_cop NUMERIC(19, 4) NOT NULL DEFAULT 4075630;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS tax_iva_cop NUMERIC(19, 4) NOT NULL DEFAULT 774370;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS withholdings_cop NUMERIC(19, 4) NOT NULL DEFAULT 0;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC(19, 4) NOT NULL DEFAULT 4850000;
ALTER TABLE srv_invoicing.dian_electronic_invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_invoice_lines (
  line_id VARCHAR(64) PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES srv_invoicing.dian_electronic_invoices(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  unspsc_code VARCHAR(24) NOT NULL DEFAULT '30111601',
  description VARCHAR(220) NOT NULL,
  quantity NUMERIC(19, 4) NOT NULL,
  unit_price_cop NUMERIC(19, 4) NOT NULL,
  iva_pct NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  line_total_cop NUMERIC(19, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_invoice_taxes_withholdings (
  tax_line_id VARCHAR(64) PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES srv_invoicing.dian_electronic_invoices(id) ON DELETE CASCADE,
  dian_tax_code VARCHAR(16) NOT NULL DEFAULT '01_IVA',
  tax_name VARCHAR(80) NOT NULL DEFAULT 'IVA 19%',
  taxable_base_cop NUMERIC(19, 2) NOT NULL,
  rate_pct NUMERIC(6, 3) NOT NULL DEFAULT 19.000,
  tax_amount_cop NUMERIC(19, 2) NOT NULL,
  is_withholding BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_credit_debit_notes (
  note_id VARCHAR(64) PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES srv_invoicing.dian_electronic_invoices(id) ON DELETE CASCADE,
  note_type VARCHAR(16) NOT NULL DEFAULT 'CREDIT_NOTE',
  note_number VARCHAR(32) NOT NULL UNIQUE,
  dian_concept_code VARCHAR(16) NOT NULL DEFAULT '1_DEVOLUCION_PARCIAL',
  cude_hash VARCHAR(128) NOT NULL,
  total_note_cop NUMERIC(19, 2) NOT NULL,
  dian_status VARCHAR(24) NOT NULL DEFAULT 'ACCEPTED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_invoicing.dian_numbering_resolutions (resolution_id, resolution_number, prefix, range_from, range_to, current_consecutive)
VALUES ('res-fev-2026', '18764062100981', 'FEV', 1, 50000, 10421)
ON CONFLICT (resolution_id) DO NOTHING;

INSERT INTO srv_invoicing.dian_electronic_invoices (id, branch_id, resolution_id, prefix_and_number, invoice_number, cufe_sha384, cufe_hash, customer_nit, contact_id, buyer_legal_name, buyer_nit, subtotal, iva_tax, grand_total, total_amount, dian_status)
VALUES ('33333333-3333-4333-8333-333333333201', 'br-main', 'res-fev-2026', 'FEV-10421', 'FEV-10421', 'CUFE-sha384-fev10421-dian-validado-2026', 'CUFE-sha384-fev10421-dian-validado-2026', '901.452.110-4', '11111111-1111-4111-8111-111111111101', 'Comercializadora del Valle S.A.S.', '901.452.110-4', 4075630, 774370, 4850000, 4850000, 'ACCEPTED')
ON CONFLICT (id) DO NOTHING;
