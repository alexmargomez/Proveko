-- Migration: 0001_init_finance_ar_ap.sql
-- Microservice: ms:finance (srv_finance) & srv_hr_payroll (Nómina Electrónica DIAN CUNE, PILA y Prestaciones Sociales)
CREATE SCHEMA IF NOT EXISTS srv_finance;
CREATE SCHEMA IF NOT EXISTS srv_hr_payroll;

CREATE TABLE IF NOT EXISTS srv_finance.arp_ledgers (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  contact_id VARCHAR(64) NOT NULL,
  ledger_type VARCHAR(24) NOT NULL,
  original_amount NUMERIC(19, 4) NOT NULL,
  remaining_balance NUMERIC(19, 4) NOT NULL,
  due_date VARCHAR(10) NOT NULL
);

-- ============================================================================
-- ESQUEMA: srv_hr_payroll (Empleados, Contratos, Liquidación, PILA, Prestaciones y Nómina Electrónica DIAN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_employees (
  employee_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  document_number VARCHAR(32) NOT NULL UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  job_title VARCHAR(120) NOT NULL,
  eps_entity VARCHAR(80) NOT NULL DEFAULT 'EPS Sura',
  pension_afp_entity VARCHAR(80) NOT NULL DEFAULT 'AFP Porvenir',
  arl_entity VARCHAR(80) NOT NULL DEFAULT 'ARL Sura',
  arl_risk_class VARCHAR(16) NOT NULL DEFAULT 'RIESGO_II',
  compensation_box_ccf VARCHAR(80) NOT NULL DEFAULT 'Compensar / Comfandi',
  bank_account_info VARCHAR(120),
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_employment_contracts (
  contract_id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_employees(employee_id) ON DELETE CASCADE,
  contract_type VARCHAR(48) NOT NULL DEFAULT 'TERMINO_INDEFINIDO',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  base_salary_cop NUMERIC(19, 2) NOT NULL,
  receives_transport_allowance BOOLEAN NOT NULL DEFAULT TRUE,
  exonerated_ley_1607 BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_payroll_concepts (
  concept_code VARCHAR(32) PRIMARY KEY,
  concept_name VARCHAR(140) NOT NULL,
  concept_nature VARCHAR(24) NOT NULL DEFAULT 'DEVENGADO',
  dian_xml_tag VARCHAR(64) NOT NULL,
  default_percentage NUMERIC(6, 3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_payroll_periods (
  period_id VARCHAR(64) PRIMARY KEY,
  period_code VARCHAR(32) NOT NULL UNIQUE,
  period_type VARCHAR(24) NOT NULL DEFAULT 'QUINCENAL',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_accrued_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  total_deducted_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  total_net_paid_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'CLOSED'
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_payroll_payslips (
  payslip_id VARCHAR(64) PRIMARY KEY,
  period_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_payroll_periods(period_id) ON DELETE CASCADE,
  employee_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_employees(employee_id) ON DELETE CASCADE,
  worked_days INTEGER NOT NULL DEFAULT 15,
  accrued_salary_cop NUMERIC(19, 2) NOT NULL,
  overtime_and_surcharges_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  health_deduction_4pct_cop NUMERIC(19, 2) NOT NULL,
  pension_deduction_4pct_cop NUMERIC(19, 2) NOT NULL,
  net_pay_cop NUMERIC(19, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_pila_contributions (
  pila_id VARCHAR(64) PRIMARY KEY,
  period_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_payroll_periods(period_id) ON DELETE CASCADE,
  planilla_number VARCHAR(48) NOT NULL UNIQUE,
  employees_count INTEGER NOT NULL DEFAULT 14,
  total_eps_cop NUMERIC(19, 2) NOT NULL,
  total_afp_cop NUMERIC(19, 2) NOT NULL,
  total_arl_cop NUMERIC(19, 2) NOT NULL,
  total_parafiscales_cop NUMERIC(19, 2) NOT NULL,
  ley_1607_exoneration_applied BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(24) NOT NULL DEFAULT 'PAID'
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_social_benefits_provisions (
  provision_id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_employees(employee_id) ON DELETE CASCADE,
  period_month VARCHAR(16) NOT NULL,
  prima_servicios_cop NUMERIC(19, 2) NOT NULL,
  cesantias_cop NUMERIC(19, 2) NOT NULL,
  intereses_cesantias_cop NUMERIC(19, 2) NOT NULL,
  vacaciones_cop NUMERIC(19, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS srv_hr_payroll.hrp_electronic_payroll_dian (
  ni_id VARCHAR(64) PRIMARY KEY,
  payslip_id VARCHAR(64) NOT NULL REFERENCES srv_hr_payroll.hrp_payroll_payslips(payslip_id) ON DELETE CASCADE,
  ni_consecutive VARCHAR(48) NOT NULL UNIQUE,
  cune_hash VARCHAR(128) NOT NULL,
  reported_net_cop NUMERIC(19, 2) NOT NULL,
  dian_status VARCHAR(32) NOT NULL DEFAULT 'ACCEPTED_DIAN',
  transmitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_hr_payroll.hrp_employees (employee_id, document_number, full_name, job_title)
VALUES ('emp-julian-01', '1.032.488.910', 'Julián David Torres', 'Jefe de Operaciones')
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO srv_hr_payroll.hrp_employment_contracts (contract_id, employee_id, contract_type, base_salary_cop, exonerated_ley_1607)
VALUES ('ctr-emp-01', 'emp-julian-01', 'TERMINO_INDEFINIDO', 2850000, TRUE)
ON CONFLICT (contract_id) DO NOTHING;

INSERT INTO srv_hr_payroll.hrp_payroll_periods (period_id, period_code, total_accrued_cop, total_deducted_cop, total_net_paid_cop)
VALUES ('prd-2026-11-q1', 'NOM-2026-11-Q1', 3120000, 228000, 2892000)
ON CONFLICT (period_id) DO NOTHING;

INSERT INTO srv_hr_payroll.hrp_payroll_payslips (payslip_id, period_id, employee_id, worked_days, accrued_salary_cop, overtime_and_surcharges_cop, health_deduction_4pct_cop, pension_deduction_4pct_cop, net_pay_cop)
VALUES ('psl-2026-01', 'prd-2026-11-q1', 'emp-julian-01', 15, 2850000, 270000, 114000, 114000, 2892000)
ON CONFLICT (payslip_id) DO NOTHING;

INSERT INTO srv_hr_payroll.hrp_electronic_payroll_dian (ni_id, payslip_id, ni_consecutive, cune_hash, reported_net_cop)
VALUES ('ni-2026-314', 'psl-2026-01', 'NE-2026-00314', 'CUNE-9f82a41c-dian-2026-ok', 2892000)
ON CONFLICT (ni_id) DO NOTHING;
