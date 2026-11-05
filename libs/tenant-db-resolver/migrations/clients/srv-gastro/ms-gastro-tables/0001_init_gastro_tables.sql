-- Migration: 0001_init_gastro_tables.sql
-- Microservice: ms:gastro (srv_gastro) | Module: mod:gastro-tables (tbl_)
CREATE SCHEMA IF NOT EXISTS srv_gastro;

CREATE TABLE IF NOT EXISTS srv_gastro.tbl_dining_tables (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  table_code VARCHAR(32) NOT NULL,
  zone_name VARCHAR(64) NOT NULL,
  capacity_seats INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE'
);
