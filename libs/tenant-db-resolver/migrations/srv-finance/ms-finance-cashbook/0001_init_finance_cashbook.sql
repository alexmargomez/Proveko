-- Migration: 0001_init_finance_cashbook.sql
-- Microservice: ms:finance (srv_finance) & srv_treasury (Tesorería, Cartera CxC/CxP, Bancos y Cajas Menores)
CREATE SCHEMA IF NOT EXISTS srv_finance;
CREATE SCHEMA IF NOT EXISTS srv_treasury;

CREATE TABLE IF NOT EXISTS srv_finance.csh_entries (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  entry_type VARCHAR(16) NOT NULL,
  concept VARCHAR(180) NOT NULL,
  amount NUMERIC(19, 4) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ESQUEMA: srv_treasury (Cuentas Bancarias, Cartera CxC, CxP, Conciliación y Cajas Menores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_treasury.trs_bank_accounts (
  bank_account_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  bank_name VARCHAR(120) NOT NULL,
  account_number VARCHAR(48) NOT NULL UNIQUE,
  account_type VARCHAR(32) NOT NULL DEFAULT 'CORRIENTE',
  puc_code VARCHAR(16) NOT NULL DEFAULT '111005',
  current_book_balance_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_accounts_receivable (
  cxc_id VARCHAR(64) PRIMARY KEY,
  invoice_number VARCHAR(32) NOT NULL,
  customer_nit VARCHAR(32) NOT NULL,
  customer_name VARCHAR(180) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  aging_bucket VARCHAR(32) NOT NULL DEFAULT 'CORRIENTE_0_30',
  original_amount_cop NUMERIC(19, 2) NOT NULL,
  balance_pending_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_cash_receipt_vouchers (
  rc_id VARCHAR(64) PRIMARY KEY,
  cxc_id VARCHAR(64) REFERENCES srv_treasury.trs_accounts_receivable(cxc_id) ON DELETE SET NULL,
  bank_account_id VARCHAR(64) REFERENCES srv_treasury.trs_bank_accounts(bank_account_id) ON DELETE SET NULL,
  rc_consecutive VARCHAR(48) NOT NULL UNIQUE,
  customer_name VARCHAR(180) NOT NULL,
  payment_method VARCHAR(48) NOT NULL DEFAULT 'TRANSFERENCIA_QR',
  amount_received_cop NUMERIC(19, 2) NOT NULL,
  withholding_suffered_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_accounts_payable (
  cxp_id VARCHAR(64) PRIMARY KEY,
  supplier_invoice_number VARCHAR(48) NOT NULL,
  supplier_nit VARCHAR(32) NOT NULL,
  supplier_name VARCHAR(180) NOT NULL,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  original_amount_cop NUMERIC(19, 2) NOT NULL,
  balance_payable_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_disbursement_vouchers (
  ce_id VARCHAR(64) PRIMARY KEY,
  cxp_id VARCHAR(64) REFERENCES srv_treasury.trs_accounts_payable(cxp_id) ON DELETE SET NULL,
  bank_account_id VARCHAR(64) REFERENCES srv_treasury.trs_bank_accounts(bank_account_id) ON DELETE SET NULL,
  ce_consecutive VARCHAR(48) NOT NULL UNIQUE,
  beneficiary_name VARCHAR(180) NOT NULL,
  payment_channel VARCHAR(48) NOT NULL DEFAULT 'DISPERSION_PAB_ACH',
  amount_paid_cop NUMERIC(19, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_bank_reconciliations (
  reconciliation_id VARCHAR(64) PRIMARY KEY,
  bank_account_id VARCHAR(64) NOT NULL REFERENCES srv_treasury.trs_bank_accounts(bank_account_id) ON DELETE CASCADE,
  period_month VARCHAR(16) NOT NULL,
  book_balance_cop NUMERIC(19, 2) NOT NULL,
  statement_balance_cop NUMERIC(19, 2) NOT NULL,
  unreconciled_diff_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'RECONCILED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_petty_cash_funds (
  fund_id VARCHAR(64) PRIMARY KEY,
  fund_code VARCHAR(32) NOT NULL UNIQUE,
  fund_name VARCHAR(140) NOT NULL,
  custodian_name VARCHAR(140) NOT NULL,
  authorized_limit_cop NUMERIC(19, 2) NOT NULL DEFAULT 1500000,
  current_available_cop NUMERIC(19, 2) NOT NULL DEFAULT 1158000,
  reimbursement_threshold_pct INTEGER NOT NULL DEFAULT 80
);

CREATE TABLE IF NOT EXISTS srv_treasury.trs_petty_cash_expenses (
  expense_id VARCHAR(64) PRIMARY KEY,
  fund_id VARCHAR(64) NOT NULL REFERENCES srv_treasury.trs_petty_cash_funds(fund_id) ON DELETE CASCADE,
  voucher_code VARCHAR(48) NOT NULL,
  expense_concept VARCHAR(180) NOT NULL,
  third_party_nit VARCHAR(32) NOT NULL,
  amount_cop NUMERIC(19, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_treasury.trs_bank_accounts (bank_account_id, bank_name, account_number, account_type, current_book_balance_cop)
VALUES ('bnk-bancolombia-01', 'Bancolombia Cuenta Corriente', '441-889201-04', 'CORRIENTE', 48920000)
ON CONFLICT (bank_account_id) DO NOTHING;

INSERT INTO srv_treasury.trs_accounts_receivable (cxc_id, invoice_number, customer_nit, customer_name, aging_bucket, original_amount_cop, balance_pending_cop)
VALUES ('cxc-10421', 'FEV-10421', '901.452.110-4', 'Comercializadora del Valle S.A.S.', 'CORRIENTE_0_30', 4850000, 0)
ON CONFLICT (cxc_id) DO NOTHING;

INSERT INTO srv_treasury.trs_cash_receipt_vouchers (rc_id, cxc_id, bank_account_id, rc_consecutive, customer_name, amount_received_cop)
VALUES ('rc-2026-891', 'cxc-10421', 'bnk-bancolombia-01', 'RC-2026-00891', 'Comercializadora del Valle S.A.S.', 4850000)
ON CONFLICT (rc_id) DO NOTHING;

INSERT INTO srv_treasury.trs_petty_cash_funds (fund_id, fund_code, fund_name, custodian_name, authorized_limit_cop, current_available_cop)
VALUES ('fnd-admin-01', 'CM-ADMIN-01', 'Caja Menor Sede Principal', 'Claudia Patricia Gómez', 1500000, 1158000)
ON CONFLICT (fund_id) DO NOTHING;
