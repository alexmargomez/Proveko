-- Migration: 0001_init_pos_tables.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-pos (pos_)
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_cash_shifts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  cashier_user_id VARCHAR(64) NOT NULL,
  opening_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(19, 4),
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_sale_tickets (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  subtotal NUMERIC(19, 4) NOT NULL,
  tax_total NUMERIC(19, 4) NOT NULL,
  grand_total NUMERIC(19, 4) NOT NULL,
  emitted_via VARCHAR(48) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
