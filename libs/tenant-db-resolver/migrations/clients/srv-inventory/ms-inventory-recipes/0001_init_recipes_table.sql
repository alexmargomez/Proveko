-- Migration: 0001_init_recipes_table.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-recipes (rec_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.rec_recipes (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  finished_product_sku VARCHAR(64) NOT NULL,
  ingredient_sku VARCHAR(64) NOT NULL,
  quantity_required NUMERIC(19, 4) NOT NULL,
  unit_cost NUMERIC(19, 4) NOT NULL
);
