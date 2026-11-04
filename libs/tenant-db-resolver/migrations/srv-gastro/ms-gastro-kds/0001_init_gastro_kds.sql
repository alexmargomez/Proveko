-- Migration: 0001_init_gastro_kds.sql
-- Microservice: ms:gastro (srv_gastro) | Module: mod:gastro-kds (kds_)
CREATE SCHEMA IF NOT EXISTS srv_gastro;

CREATE TABLE IF NOT EXISTS srv_gastro.kds_tickets (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  table_code VARCHAR(32) NOT NULL,
  station VARCHAR(24) NOT NULL,
  items_summary TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PREPARING'
);
