-- Migration: 0001_init_pipelines_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-pipelines (pip_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.pip_deals (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  title VARCHAR(180) NOT NULL,
  stage VARCHAR(32) NOT NULL DEFAULT 'LEAD',
  expected_value NUMERIC(19, 4) NOT NULL DEFAULT 0
);
