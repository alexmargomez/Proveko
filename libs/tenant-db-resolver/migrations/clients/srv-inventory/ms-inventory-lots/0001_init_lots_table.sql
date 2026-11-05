-- Migration: 0001_init_lots_table.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-lots (lot_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.lot_batches (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  batch_code VARCHAR(64) NOT NULL,
  expiration_date VARCHAR(10) NOT NULL,
  available_qty NUMERIC(19, 4) NOT NULL DEFAULT 0
);
