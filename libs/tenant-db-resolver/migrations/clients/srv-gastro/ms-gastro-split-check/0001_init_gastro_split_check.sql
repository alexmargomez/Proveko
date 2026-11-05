-- Migration: 0001_init_gastro_split_check.sql
-- Microservice: ms:gastro (srv_gastro) & srv_fleet (Flotas, Báscula Camionera RS-232, Manifiestos RNDC y Llantas)
CREATE SCHEMA IF NOT EXISTS srv_gastro;
CREATE SCHEMA IF NOT EXISTS srv_fleet;

CREATE TABLE IF NOT EXISTS srv_gastro.spl_checks (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  table_code VARCHAR(32) NOT NULL,
  split_mode VARCHAR(32) NOT NULL,
  seats_count INTEGER NOT NULL DEFAULT 2,
  total_amount NUMERIC(19, 4) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'SETTLED'
);

-- ============================================================================
-- ESQUEMA: srv_fleet (Tractomulas, Báscula RS-232, Manifiestos RNDC, Liquidación de Viajes y Llantas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_fleet.flt_vehicles_tractors (
  tractor_id VARCHAR(64) PRIMARY KEY,
  plate VARCHAR(24) NOT NULL UNIQUE,
  trailer_plate VARCHAR(24) NOT NULL DEFAULT 'R-5520',
  configuration_code VARCHAR(16) NOT NULL DEFAULT '3S3_TRACTOMULA',
  driver_name VARCHAR(160) NOT NULL,
  driver_cc VARCHAR(32) NOT NULL,
  owner_nit VARCHAR(32) NOT NULL,
  empty_tare_kg NUMERIC(14, 2) NOT NULL DEFAULT 16800,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS srv_fleet.flt_weighbridge_tickets (
  weigh_ticket_id VARCHAR(64) PRIMARY KEY,
  tractor_id VARCHAR(64) REFERENCES srv_fleet.flt_vehicles_tractors(tractor_id) ON DELETE SET NULL,
  ticket_number VARCHAR(48) NOT NULL UNIQUE,
  plate VARCHAR(32) NOT NULL,
  driver_name VARCHAR(160) NOT NULL,
  gross_weight_kg NUMERIC(14, 2) NOT NULL,
  tare_weight_kg NUMERIC(14, 2) NOT NULL,
  humidity_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
  net_weight_kg NUMERIC(14, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
  weighed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_fleet.flt_rndc_manifests (
  manifest_id VARCHAR(64) PRIMARY KEY,
  tractor_id VARCHAR(64) NOT NULL REFERENCES srv_fleet.flt_vehicles_tractors(tractor_id) ON DELETE RESTRICT,
  manifest_code VARCHAR(48) NOT NULL UNIQUE,
  origin_dane_city VARCHAR(80) NOT NULL,
  destination_dane_city VARCHAR(80) NOT NULL,
  agreed_freight_cop NUMERIC(19, 2) NOT NULL,
  retention_1pct_cop NUMERIC(19, 2) NOT NULL,
  reteica_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  rndc_authorization_number VARCHAR(64) NOT NULL DEFAULT 'RNDC-MINTRANSPORTE-2026-OK',
  status VARCHAR(24) NOT NULL DEFAULT 'RADICADO_RNDC',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_fleet.flt_trip_expenses_advances (
  settlement_id VARCHAR(64) PRIMARY KEY,
  manifest_id VARCHAR(64) NOT NULL REFERENCES srv_fleet.flt_rndc_manifests(manifest_id) ON DELETE CASCADE,
  settlement_code VARCHAR(48) NOT NULL UNIQUE,
  advance_paid_cop NUMERIC(19, 2) NOT NULL,
  tolls_total_cop NUMERIC(19, 2) NOT NULL,
  fuel_acpm_cop NUMERIC(19, 2) NOT NULL,
  fuel_gallons NUMERIC(10, 2) NOT NULL DEFAULT 145,
  net_balance_owner_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CUMPLIDO_LIQUIDADO'
);

CREATE TABLE IF NOT EXISTS srv_fleet.flt_tire_tracking (
  tire_id VARCHAR(64) PRIMARY KEY,
  tractor_id VARCHAR(64) NOT NULL REFERENCES srv_fleet.flt_vehicles_tractors(tractor_id) ON DELETE CASCADE,
  tire_serial VARCHAR(64) NOT NULL UNIQUE,
  axle_position VARCHAR(48) NOT NULL,
  tread_depth_mm NUMERIC(5, 2) NOT NULL DEFAULT 8.50,
  accumulated_km INTEGER NOT NULL DEFAULT 64200,
  retread_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'OPTIMO'
);

INSERT INTO srv_fleet.flt_vehicles_tractors (tractor_id, plate, trailer_plate, driver_name, driver_cc, owner_nit, empty_tare_kg)
VALUES ('trc-wxy-812', 'WXY-812', 'R-5520', 'Álvaro Gómez', '79.412.880', '900.771.220-8', 16800)
ON CONFLICT (tractor_id) DO NOTHING;

INSERT INTO srv_fleet.flt_weighbridge_tickets (weigh_ticket_id, tractor_id, ticket_number, plate, driver_name, gross_weight_kg, tare_weight_kg, net_weight_kg)
VALUES ('bas-fl-7741', 'trc-wxy-812', 'BAS-FL-7741', 'WXY-812 / R-5520', 'Álvaro Gómez', 52400, 16800, 35600)
ON CONFLICT (weigh_ticket_id) DO NOTHING;

INSERT INTO srv_fleet.flt_rndc_manifests (manifest_id, tractor_id, manifest_code, origin_dane_city, destination_dane_city, agreed_freight_cop, retention_1pct_cop)
VALUES ('mn-2026-8841', 'trc-wxy-812', 'MN-2026-08841', 'Buenaventura (76109)', 'Bogotá D.C. (11001)', 4850000, 48500)
ON CONFLICT (manifest_id) DO NOTHING;

INSERT INTO srv_fleet.flt_trip_expenses_advances (settlement_id, manifest_id, settlement_code, advance_paid_cop, tolls_total_cop, fuel_acpm_cop, net_balance_owner_cop)
VALUES ('liq-v-310', 'mn-2026-8841', 'LIQ-V-2026-310', 2200000, 620000, 1330000, 2601500)
ON CONFLICT (settlement_id) DO NOTHING;

INSERT INTO srv_fleet.flt_tire_tracking (tire_id, tractor_id, tire_serial, axle_position, tread_depth_mm, accumulated_km)
VALUES ('tir-991', 'trc-wxy-812', 'MICH-295-80R22-991', 'Eje 1 Direccional Izq', 8.50, 64200)
ON CONFLICT (tire_id) DO NOTHING;
