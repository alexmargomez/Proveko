-- Migration: 0001_init_loyalty_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-loyalty (loy_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.loy_wallets (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  points_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
  tier_level VARCHAR(16) NOT NULL DEFAULT 'SILVER'
);
