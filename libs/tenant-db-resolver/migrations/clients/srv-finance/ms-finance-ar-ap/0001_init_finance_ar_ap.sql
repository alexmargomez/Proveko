-- Migration: 0001_init_finance_ar_ap.sql
-- Microservice: ms:finance (srv_finance) | Module: mod:finance-ar-ap (arp_)
CREATE SCHEMA IF NOT EXISTS srv_finance;

CREATE TABLE IF NOT EXISTS srv_finance.arp_ledgers (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  ledger_type VARCHAR(24) NOT NULL,
  original_amount NUMERIC(19, 4) NOT NULL,
  remaining_balance NUMERIC(19, 4) NOT NULL,
  due_date VARCHAR(10) NOT NULL
);
