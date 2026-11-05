-- Migration: 0001_init_transfers_table.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-transfers (trf_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.trf_orders (
  id UUID PRIMARY KEY,
  from_branch_id VARCHAR(64) NOT NULL,
  to_branch_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  quantity NUMERIC(19, 4) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'IN_TRANSIT'
);
