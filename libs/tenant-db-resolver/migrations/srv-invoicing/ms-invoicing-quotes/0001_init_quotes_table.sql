-- Migration: 0001_init_quotes_table.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-quotes (quo_)
-- Expansión Enterprise: Cotizaciones, Listas de Precios y Tarifarios Pactados (v2), Facturación Agrupada (v2), Glosas (v2) y Plan Separe
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.quo_quotes (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  quote_code VARCHAR(32) NOT NULL DEFAULT 'COT-2026-041',
  quote_number VARCHAR(32) NOT NULL DEFAULT 'COT-2026-041',
  contact_id VARCHAR(64) NOT NULL DEFAULT '11111111-1111-4111-8111-111111111101',
  customer_name VARCHAR(180) NOT NULL DEFAULT 'Ingenios Unidos S.A.',
  manager_signature VARCHAR(160) NOT NULL DEFAULT 'Ing. Carlos Ruiz',
  total_amount NUMERIC(19, 4) NOT NULL DEFAULT 3200000,
  estimated_total NUMERIC(19, 4) NOT NULL DEFAULT 3200000,
  valid_until_date VARCHAR(10) NOT NULL DEFAULT '2026-12-31',
  valid_until VARCHAR(10) NOT NULL DEFAULT '2026-12-31',
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN'
);

ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS quote_code VARCHAR(32) NOT NULL DEFAULT 'COT-2026-041';
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS quote_number VARCHAR(32) NOT NULL DEFAULT 'COT-2026-041';
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS customer_name VARCHAR(180) NOT NULL DEFAULT 'Ingenios Unidos S.A.';
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS manager_signature VARCHAR(160) NOT NULL DEFAULT 'Ing. Carlos Ruiz';
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS total_amount NUMERIC(19, 4) NOT NULL DEFAULT 3200000;
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS estimated_total NUMERIC(19, 4) NOT NULL DEFAULT 3200000;
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS valid_until_date VARCHAR(10) NOT NULL DEFAULT '2026-12-31';
ALTER TABLE srv_invoicing.quo_quotes ADD COLUMN IF NOT EXISTS valid_until VARCHAR(10) NOT NULL DEFAULT '2026-12-31';

CREATE TABLE IF NOT EXISTS srv_invoicing.inv_price_lists_tariffs (
  tariff_id VARCHAR(64) PRIMARY KEY,
  tariff_code VARCHAR(32) NOT NULL UNIQUE,
  tariff_name VARCHAR(160) NOT NULL,
  pricing_rule VARCHAR(48) NOT NULL DEFAULT 'DISCOUNT_PCT_ON_BASE',
  adjustment_pct NUMERIC(6, 2) NOT NULL DEFAULT -15.00,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'COP',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.inv_price_list_items (
  tariff_item_id VARCHAR(64) PRIMARY KEY,
  tariff_id VARCHAR(64) NOT NULL REFERENCES srv_invoicing.inv_price_lists_tariffs(tariff_id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  agreed_unit_price_cop NUMERIC(19, 2) NOT NULL,
  min_qty NUMERIC(12, 2) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS srv_invoicing.inv_grouped_billing_orders (
  batch_id VARCHAR(64) PRIMARY KEY,
  batch_code VARCHAR(48) NOT NULL UNIQUE,
  contract_number VARCHAR(48) NOT NULL,
  company_name VARCHAR(180) NOT NULL,
  orders_included_count INTEGER NOT NULL DEFAULT 28,
  period_cutoff VARCHAR(32) NOT NULL DEFAULT '2026-10',
  consolidated_total_cop NUMERIC(19, 2) NOT NULL,
  generated_invoice_number VARCHAR(32) NOT NULL DEFAULT 'FEV-10421',
  status VARCHAR(24) NOT NULL DEFAULT 'INVOICED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.inv_billing_disputes_glosas (
  dispute_id VARCHAR(64) PRIMARY KEY,
  dispute_code VARCHAR(48) NOT NULL UNIQUE,
  invoice_number VARCHAR(32) NOT NULL,
  customer_name VARCHAR(180) NOT NULL,
  dispute_reason VARCHAR(120) NOT NULL,
  disputed_amount_cop NUMERIC(19, 2) NOT NULL,
  accepted_glosa_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  reconciled_status VARCHAR(32) NOT NULL DEFAULT 'CONCILIADA_NC_PARCIAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.inv_layaway_plans (
  layaway_id VARCHAR(64) PRIMARY KEY,
  layaway_code VARCHAR(48) NOT NULL UNIQUE,
  customer_name VARCHAR(180) NOT NULL,
  reserved_items_summary TEXT NOT NULL,
  total_price_cop NUMERIC(19, 2) NOT NULL,
  initial_deposit_cop NUMERIC(19, 2) NOT NULL,
  remaining_balance_cop NUMERIC(19, 2) NOT NULL,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '45 days'),
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE_RESERVED'
);

INSERT INTO srv_invoicing.inv_price_lists_tariffs (tariff_id, tariff_code, tariff_name, pricing_rule, adjustment_pct)
VALUES ('tar-corp-2026', 'TAR-CORP-2026', 'Tarifario Mayorista Institucional (-15%)', 'DISCOUNT_PCT_ON_BASE', -15.00)
ON CONFLICT (tariff_id) DO NOTHING;

INSERT INTO srv_invoicing.inv_grouped_billing_orders (batch_id, batch_code, contract_number, company_name, orders_included_count, consolidated_total_cop)
VALUES ('fag-2026-089', 'FAC-AGR-2026-089', 'CNT-2026-0084', 'Grupo Industrial del Pacífico S.A.', 28, 18950000)
ON CONFLICT (batch_id) DO NOTHING;

INSERT INTO srv_invoicing.inv_billing_disputes_glosas (dispute_id, dispute_code, invoice_number, customer_name, dispute_reason, disputed_amount_cop, accepted_glosa_cop)
VALUES ('glo-2026-312', 'GLO-2026-00312', 'FEV-10421', 'Comercializadora del Valle S.A.S.', 'Diferencia en Tarifa Pactada', 420000, 210000)
ON CONFLICT (dispute_id) DO NOTHING;
