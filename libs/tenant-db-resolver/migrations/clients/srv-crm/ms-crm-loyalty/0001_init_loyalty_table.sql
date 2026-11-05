-- Migration: 0001_init_loyalty_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-loyalty (loy_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.loy_wallets (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  contact_id VARCHAR(64) NOT NULL,
  member_name VARCHAR(160) NOT NULL DEFAULT 'Cliente Preferencial',
  points_balance INTEGER NOT NULL DEFAULT 0,
  cashback_balance_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  tier_level VARCHAR(32) NOT NULL DEFAULT 'BRONZE',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.loy_point_transactions (
  tx_id VARCHAR(64) PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES srv_crm.loy_wallets(id) ON DELETE CASCADE,
  tx_type VARCHAR(24) NOT NULL DEFAULT 'ACCRUAL',
  points_delta INTEGER NOT NULL,
  reference_doc VARCHAR(64) NOT NULL DEFAULT 'POS-9001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_crm.loy_wallets (id, branch_id, contact_id, member_name, points_balance, cashback_balance_cop, tier_level)
VALUES
  ('11111111-1111-4111-8111-111111111301', 'br-main', '11111111-1111-4111-8111-111111111101', 'Diana Marcela Pineda', 2450, 122500, 'ORO_PREFERENCIAL')
ON CONFLICT (id) DO NOTHING;
