-- Migration: 0001_init_stock_tables.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-stock (stk_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.stk_items (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  quantity_on_hand NUMERIC(19, 4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(19, 4) NOT NULL DEFAULT 0
);
