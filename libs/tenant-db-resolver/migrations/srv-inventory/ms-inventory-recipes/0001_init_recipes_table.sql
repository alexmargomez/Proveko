-- Migration: 0001_init_recipes_table.sql
-- Microservice: ms:inventory (srv_inventory) | Module: mod:inventory-recipes (rcp_)
CREATE SCHEMA IF NOT EXISTS srv_inventory;

CREATE TABLE IF NOT EXISTS srv_inventory.rcp_recipes (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  output_item_id VARCHAR(64) NOT NULL,
  recipe_name VARCHAR(160) NOT NULL,
  yield_quantity NUMERIC(19, 4) NOT NULL DEFAULT 1,
  standard_cost_cop NUMERIC(19, 2) NOT NULL DEFAULT 18900
);

CREATE TABLE IF NOT EXISTS srv_inventory.rcp_recipe_ingredients (
  ingredient_line_id VARCHAR(64) PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES srv_inventory.rcp_recipes(id) ON DELETE CASCADE,
  component_sku VARCHAR(64) NOT NULL,
  component_name VARCHAR(160) NOT NULL,
  required_qty NUMERIC(19, 4) NOT NULL,
  waste_tolerance_pct NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
  line_cost_cop NUMERIC(19, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS srv_inventory.rcp_production_orders (
  prod_order_id VARCHAR(64) PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES srv_inventory.rcp_recipes(id) ON DELETE RESTRICT,
  order_code VARCHAR(48) NOT NULL UNIQUE,
  planned_batches NUMERIC(12, 2) NOT NULL DEFAULT 10,
  produced_qty NUMERIC(12, 2) NOT NULL DEFAULT 10,
  status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_inventory.rcp_recipes (id, branch_id, output_item_id, recipe_name, yield_quantity, standard_cost_cop)
VALUES
  ('22222222-2222-4222-8222-222222222401', 'br-main', 'BOM-101', 'Mortero Premezclado Seco x 40Kg', 1, 18900)
ON CONFLICT (id) DO NOTHING;
