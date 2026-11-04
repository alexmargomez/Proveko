-- Migration: 0001_init_finance_cashbook.sql
-- Microservice: ms:finance (srv_finance) | Module: mod:finance-cashbook (csh_)
CREATE SCHEMA IF NOT EXISTS srv_finance;

CREATE TABLE IF NOT EXISTS srv_finance.csh_entries (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  entry_type VARCHAR(16) NOT NULL,
  concept VARCHAR(180) NOT NULL,
  amount NUMERIC(19, 4) NOT NULL
);
