-- Migration: 0001_init_dian_invoices_table.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-electronic-dian (dian_)
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.dian_electronic_invoices (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  prefix_and_number VARCHAR(32) NOT NULL,
  cufe_sha384 VARCHAR(96) NOT NULL,
  customer_nit VARCHAR(32) NOT NULL,
  subtotal NUMERIC(19, 4) NOT NULL,
  iva_tax NUMERIC(19, 4) NOT NULL,
  grand_total NUMERIC(19, 4) NOT NULL,
  dian_status VARCHAR(32) NOT NULL DEFAULT 'QUEUED_FOR_SIGNING'
);
