-- Migration: 0001_init_simple_receipts_table.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-simple-receipt (rcp_)
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.rcp_simple_receipts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  consecutive_number VARCHAR(32) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  total_amount NUMERIC(19, 4) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
