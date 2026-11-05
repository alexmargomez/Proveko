-- Migration: 0001_init_lots_table.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-lots (lot_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.lot_batches (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  item_id VARCHAR(64) NOT NULL,
  warehouse_id VARCHAR(64) NOT NULL DEFAULT 'wh-central',
  lot_number VARCHAR(64) NOT NULL,
  sanitary_registry VARCHAR(64) NOT NULL DEFAULT 'INVIMA-2026-OK',
  manufacturing_date VARCHAR(10) NOT NULL DEFAULT '2026-01-15',
  expiration_date VARCHAR(10) NOT NULL,
  quantity_remaining NUMERIC(19, 4) NOT NULL DEFAULT 0,
  fefo_semaphore VARCHAR(24) NOT NULL DEFAULT 'VERDE_OPTIMO'
);

INSERT INTO srv_inventory.lot_batches (id, branch_id, item_id, warehouse_id, lot_number, expiration_date, quantity_remaining, fefo_semaphore)
VALUES
  ('22222222-2222-4222-8222-222222222301', 'br-main', 'INS-00104', 'wh-central', 'LOT-2026-901', '2027-06-15', 95, 'VERDE_OPTIMO')
ON CONFLICT (id) DO NOTHING;
