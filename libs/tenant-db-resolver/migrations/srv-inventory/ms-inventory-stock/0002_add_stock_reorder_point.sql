-- Migration: 0002_add_stock_reorder_point.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-stock (stk_)
ALTER TABLE srv_inventory.stk_items
  ADD COLUMN IF NOT EXISTS min_reorder_point NUMERIC(19, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_aisle VARCHAR(32);
