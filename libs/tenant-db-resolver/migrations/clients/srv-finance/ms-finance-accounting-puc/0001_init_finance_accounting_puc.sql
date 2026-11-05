-- Migration: 0001_init_finance_accounting_puc.sql
-- Microservice: ms:finance (srv_finance) & srv_reports (Centro de Reportes, Analítica BI, NIIF y Exógena DIAN)
CREATE SCHEMA IF NOT EXISTS srv_finance;
CREATE SCHEMA IF NOT EXISTS srv_reports;

CREATE TABLE IF NOT EXISTS srv_finance.puc_accounts_catalog (
  puc_code VARCHAR(16) PRIMARY KEY,
  account_name VARCHAR(180) NOT NULL,
  account_class VARCHAR(32) NOT NULL DEFAULT '1_ACTIVO',
  nature VARCHAR(16) NOT NULL DEFAULT 'DEBITO',
  requires_third_party_nit BOOLEAN NOT NULL DEFAULT TRUE,
  requires_cost_center BOOLEAN NOT NULL DEFAULT FALSE,
  exogena_format_code VARCHAR(16) DEFAULT '1001'
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_cost_centers (
  cost_center_id VARCHAR(64) PRIMARY KEY,
  cost_center_code VARCHAR(32) NOT NULL UNIQUE,
  cost_center_name VARCHAR(160) NOT NULL,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  monthly_budget_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  executed_amount_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_journal_headers (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  voucher_number VARCHAR(32) NOT NULL,
  voucher_type VARCHAR(32) NOT NULL DEFAULT 'CAUSACION_FACTURA',
  period_month VARCHAR(16) NOT NULL DEFAULT '2026-11',
  total_debit NUMERIC(19, 4) NOT NULL,
  total_credit NUMERIC(19, 4) NOT NULL,
  balanced BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_journal_lines (
  journal_line_id VARCHAR(64) PRIMARY KEY,
  journal_id UUID NOT NULL REFERENCES srv_finance.puc_journal_headers(id) ON DELETE CASCADE,
  puc_code VARCHAR(16) NOT NULL REFERENCES srv_finance.puc_accounts_catalog(puc_code) ON DELETE RESTRICT,
  cost_center_id VARCHAR(64) REFERENCES srv_finance.puc_cost_centers(cost_center_id) ON DELETE SET NULL,
  third_party_nit VARCHAR(32) NOT NULL,
  line_description VARCHAR(200) NOT NULL,
  debit_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  credit_cop NUMERIC(19, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_fixed_assets (
  asset_id VARCHAR(64) PRIMARY KEY,
  asset_tag VARCHAR(48) NOT NULL UNIQUE,
  asset_name VARCHAR(180) NOT NULL,
  acquisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  historical_cost_cop NUMERIC(19, 2) NOT NULL,
  useful_life_months INTEGER NOT NULL DEFAULT 60,
  accumulated_depreciation_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  net_book_value_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE_DEPRECIATING'
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_fixed_asset_depreciations (
  depreciation_id VARCHAR(64) PRIMARY KEY,
  asset_id VARCHAR(64) NOT NULL REFERENCES srv_finance.puc_fixed_assets(asset_id) ON DELETE CASCADE,
  period_month VARCHAR(16) NOT NULL,
  monthly_depreciation_cop NUMERIC(19, 2) NOT NULL,
  posted_voucher_number VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS srv_finance.puc_exogena_magnetic_media (
  exogena_id VARCHAR(64) PRIMARY KEY,
  format_code VARCHAR(16) NOT NULL,
  concept_code VARCHAR(16) NOT NULL,
  tax_year INTEGER NOT NULL DEFAULT 2026,
  reported_nits_count INTEGER NOT NULL DEFAULT 128,
  total_reported_cop NUMERIC(19, 2) NOT NULL,
  xml_validation_status VARCHAR(32) NOT NULL DEFAULT 'PREVALIDATED_OK',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ESQUEMA: srv_reports (Motor Centralizado de Reportes, Analítica BI y Snapshots Financieros)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_reports.rep_saved_definitions (
  report_def_id VARCHAR(64) PRIMARY KEY,
  report_code VARCHAR(48) NOT NULL UNIQUE,
  report_title VARCHAR(180) NOT NULL,
  source_domain VARCHAR(48) NOT NULL DEFAULT 'VENTAS_INVENTARIO_CARTERA',
  output_format VARCHAR(32) NOT NULL DEFAULT 'EXCEL_XLSX_PDF',
  schedule_cron VARCHAR(64) NOT NULL DEFAULT 'DAILY_06AM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_reports.rep_financial_snapshots (
  snapshot_id VARCHAR(64) PRIMARY KEY,
  statement_type VARCHAR(48) NOT NULL DEFAULT 'ESTADO_RESULTADOS_PYG_NIIF',
  fiscal_period VARCHAR(24) NOT NULL DEFAULT '2026-11',
  branch_scope VARCHAR(64) NOT NULL DEFAULT 'CONSOLIDADO_NACIONAL',
  total_revenue_cop NUMERIC(19, 2) NOT NULL DEFAULT 340000000,
  total_costs_expenses_cop NUMERIC(19, 2) NOT NULL DEFAULT 255500000,
  net_income_cop NUMERIC(19, 2) NOT NULL DEFAULT 84500000,
  margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 24.85,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_reports.rep_export_jobs (
  export_job_id VARCHAR(64) PRIMARY KEY,
  report_def_id VARCHAR(64) NOT NULL REFERENCES srv_reports.rep_saved_definitions(report_def_id) ON DELETE CASCADE,
  requested_by VARCHAR(120) NOT NULL DEFAULT 'Gerencia Financiera',
  rows_exported INTEGER NOT NULL DEFAULT 248,
  file_format VARCHAR(16) NOT NULL DEFAULT 'XLSX',
  status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_reports.rep_kpi_targets (
  kpi_id VARCHAR(64) PRIMARY KEY,
  kpi_code VARCHAR(48) NOT NULL UNIQUE,
  kpi_name VARCHAR(160) NOT NULL,
  target_value_cop NUMERIC(19, 2) NOT NULL,
  current_value_cop NUMERIC(19, 2) NOT NULL,
  compliance_pct NUMERIC(6, 2) NOT NULL DEFAULT 100.00
);

INSERT INTO srv_finance.puc_accounts_catalog (puc_code, account_name, account_class, nature)
VALUES
  ('110505', 'Caja General Principal', '1_ACTIVO', 'DEBITO'),
  ('111005', 'Bancos Moneda Nacional', '1_ACTIVO', 'DEBITO'),
  ('130505', 'Clientes Nacionales', '1_ACTIVO', 'DEBITO'),
  ('220501', 'Proveedores Nacionales', '2_PASIVO', 'CREDITO'),
  ('240801', 'IVA Generado en Ventas 19%', '2_PASIVO', 'CREDITO'),
  ('413501', 'Comercio al por Mayor y al por Menor', '4_INGRESOS', 'CREDITO')
ON CONFLICT (puc_code) DO NOTHING;

INSERT INTO srv_finance.puc_cost_centers (cost_center_id, cost_center_code, cost_center_name, monthly_budget_cop, executed_amount_cop)
VALUES ('cc-200', 'CC-200-LOGISTICA', 'Operación Planta Norte y Distribución', 45000000, 31800000)
ON CONFLICT (cost_center_id) DO NOTHING;

INSERT INTO srv_finance.puc_fixed_assets (asset_id, asset_tag, asset_name, historical_cost_cop, useful_life_months, accumulated_depreciation_cop, net_book_value_cop)
VALUES ('af-0042', 'AF-MAQ-0042', 'Montacargas Eléctrico Toyota 2.5 Ton', 95000000, 60, 15833333, 79166667)
ON CONFLICT (asset_id) DO NOTHING;

INSERT INTO srv_finance.puc_exogena_magnetic_media (exogena_id, format_code, concept_code, tax_year, reported_nits_count, total_reported_cop)
VALUES ('exo-1001-2026', '1001', '5004', 2026, 128, 845000000)
ON CONFLICT (exogena_id) DO NOTHING;

INSERT INTO srv_reports.rep_saved_definitions (report_def_id, report_code, report_title, source_domain)
VALUES ('rep-def-01', 'REP-RENT-V2', 'Rentabilidad por Cliente y Línea v2', 'VENTAS_INVENTARIO_CARTERA')
ON CONFLICT (report_def_id) DO NOTHING;

INSERT INTO srv_reports.rep_financial_snapshots (snapshot_id, statement_type, fiscal_period, net_income_cop, margin_pct)
VALUES ('snap-pyg-202611', 'ESTADO_RESULTADOS_PYG_NIIF', '2026-11', 84500000, 24.85)
ON CONFLICT (snapshot_id) DO NOTHING;
