-- Migration: 0001_init_contacts_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-directory (dir_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.dir_contacts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  tax_id VARCHAR(32) NOT NULL,
  id_type VARCHAR(16) NOT NULL,
  legal_name VARCHAR(180) NOT NULL,
  email VARCHAR(160),
  credit_limit NUMERIC(19, 4) NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
