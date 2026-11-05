-- Migration: 0001_init_finance_accounting_puc.sql
-- Microservice: ms:finance (srv_finance) | Module: mod:finance-accounting-puc (puc_)
CREATE SCHEMA IF NOT EXISTS srv_finance;

CREATE TABLE IF NOT EXISTS srv_finance.puc_journal_headers (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  voucher_number VARCHAR(32) NOT NULL,
  total_debit NUMERIC(19, 4) NOT NULL,
  total_credit NUMERIC(19, 4) NOT NULL,
  balanced BOOLEAN NOT NULL DEFAULT TRUE
);
