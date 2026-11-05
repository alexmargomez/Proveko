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

CREATE TABLE IF NOT EXISTS public.warehouses (
  warehouse_code VARCHAR(64) PRIMARY KEY,
  warehouse_name VARCHAR(180) NOT NULL,
  city_location VARCHAR(180) NOT NULL,
  capacity_label VARCHAR(120) NOT NULL,
  manager_signature VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  transfer_id VARCHAR(64) PRIMARY KEY,
  origin_warehouse_code VARCHAR(64) NOT NULL REFERENCES public.warehouses(warehouse_code) ON DELETE RESTRICT,
  target_warehouse_code VARCHAR(64) NOT NULL REFERENCES public.warehouses(warehouse_code) ON DELETE RESTRICT,
  item_summary VARCHAR(255) NOT NULL,
  carrier_name VARCHAR(180),
  manager_signature VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
