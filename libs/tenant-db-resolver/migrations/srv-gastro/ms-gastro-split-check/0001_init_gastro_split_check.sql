-- Migration: 0001_init_gastro_split_check.sql
-- Microservice: ms:gastro (srv_gastro) | Module: mod:gastro-split-check (spl_)
CREATE SCHEMA IF NOT EXISTS srv_gastro;

CREATE TABLE IF NOT EXISTS srv_gastro.spl_split_bills (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  table_code VARCHAR(32) NOT NULL,
  seat_number INTEGER NOT NULL,
  subtotal NUMERIC(19, 4) NOT NULL,
  tip_amount NUMERIC(19, 4) NOT NULL,
  total_due NUMERIC(19, 4) NOT NULL
);
