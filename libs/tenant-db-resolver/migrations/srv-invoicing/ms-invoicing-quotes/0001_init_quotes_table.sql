-- Migration: 0001_init_quotes_table.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-quotes (quo_)
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.quo_quotes (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  quote_code VARCHAR(32) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  total_amount NUMERIC(19, 4) NOT NULL,
  valid_until_date VARCHAR(10) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN'
);
