-- Migration: 0001_init_gastro_kds.sql
-- Microservice: ms:gastro (srv_gastro) & srv_workshop (Talleres Automotrices, OT Kanban y Garantías — Inspirado en FixMotor)
CREATE SCHEMA IF NOT EXISTS srv_gastro;
CREATE SCHEMA IF NOT EXISTS srv_workshop;

CREATE TABLE IF NOT EXISTS srv_gastro.kds_orders (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  table_code VARCHAR(32) NOT NULL,
  kitchen_station VARCHAR(48) NOT NULL,
  items_summary TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PREPARING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_gastro.kds_order_items (
  kds_item_id VARCHAR(64) PRIMARY KEY,
  kds_order_id UUID NOT NULL REFERENCES srv_gastro.kds_orders(id) ON DELETE CASCADE,
  dish_name VARCHAR(160) NOT NULL,
  modifiers_notes VARCHAR(200) DEFAULT 'Término 3/4',
  quantity INTEGER NOT NULL DEFAULT 1,
  voided_supervisor_pin VARCHAR(32)
);

-- ============================================================================
-- ESQUEMA: srv_workshop (Talleres Automotrices, Maquinaria, OT Kanban, Comisiones y Garantías — FixMotor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_workshop.wks_customer_vehicles (
  vehicle_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  plate_or_serial VARCHAR(32) NOT NULL UNIQUE,
  vin_chassis VARCHAR(64),
  brand_line_model VARCHAR(160) NOT NULL,
  owner_nit VARCHAR(32) NOT NULL,
  owner_name VARCHAR(180) NOT NULL,
  last_mileage_km INTEGER NOT NULL DEFAULT 0,
  soat_expiry_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '180 days'),
  tecnomecanica_expiry_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '180 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_workshop.wks_work_orders (
  work_order_id VARCHAR(64) PRIMARY KEY,
  vehicle_id VARCHAR(64) NOT NULL REFERENCES srv_workshop.wks_customer_vehicles(vehicle_id) ON DELETE RESTRICT,
  ot_number VARCHAR(48) NOT NULL UNIQUE,
  kanban_stage VARCHAR(48) NOT NULL DEFAULT 'EN_REPARACION_BAHIA',
  lead_technician_name VARCHAR(140) NOT NULL,
  customer_symptoms TEXT NOT NULL,
  technical_diagnosis TEXT,
  labor_total_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  parts_total_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  total_ot_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_workshop.wks_intake_checklists (
  checklist_id VARCHAR(64) PRIMARY KEY,
  work_order_id VARCHAR(64) NOT NULL REFERENCES srv_workshop.wks_work_orders(work_order_id) ON DELETE CASCADE,
  fuel_level VARCHAR(24) NOT NULL DEFAULT 'MEDIO_TANQUE',
  entry_mileage_km INTEGER NOT NULL DEFAULT 42850,
  bodywork_notes TEXT NOT NULL DEFAULT 'Sin rayones nuevos — Kit carretera completo',
  customer_signature VARCHAR(160) NOT NULL DEFAULT 'Firmado Digitalmente en Tablet',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_workshop.wks_work_order_items (
  ot_item_id VARCHAR(64) PRIMARY KEY,
  work_order_id VARCHAR(64) NOT NULL REFERENCES srv_workshop.wks_work_orders(work_order_id) ON DELETE CASCADE,
  item_type VARCHAR(24) NOT NULL DEFAULT 'MANO_DE_OBRA',
  description VARCHAR(200) NOT NULL,
  technician_name VARCHAR(140),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price_cop NUMERIC(19, 2) NOT NULL,
  line_total_cop NUMERIC(19, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS srv_workshop.wks_technician_commissions (
  commission_id VARCHAR(64) PRIMARY KEY,
  work_order_id VARCHAR(64) NOT NULL REFERENCES srv_workshop.wks_work_orders(work_order_id) ON DELETE CASCADE,
  settlement_code VARCHAR(48) NOT NULL,
  technician_name VARCHAR(140) NOT NULL,
  labor_base_cop NUMERIC(19, 2) NOT NULL,
  commission_pct NUMERIC(5, 2) NOT NULL DEFAULT 35.00,
  commission_payable_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'LIQUIDATED'
);

CREATE TABLE IF NOT EXISTS srv_workshop.wks_warranty_claims (
  warranty_id VARCHAR(64) PRIMARY KEY,
  work_order_id VARCHAR(64) NOT NULL REFERENCES srv_workshop.wks_work_orders(work_order_id) ON DELETE CASCADE,
  certificate_code VARCHAR(48) NOT NULL UNIQUE,
  coverage_description TEXT NOT NULL,
  warranty_days INTEGER NOT NULL DEFAULT 90,
  warranty_km INTEGER NOT NULL DEFAULT 5000,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE_WARRANTY',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_workshop.wks_customer_vehicles (vehicle_id, plate_or_serial, vin_chassis, brand_line_model, owner_nit, owner_name, last_mileage_km)
VALUES ('veh-klm-482', 'KLM-482', '9FB532884102991', 'Toyota Hilux SRX 4x4 2.8L Diesel 2024', '900.812.441-9', 'Inversiones del Norte S.A.S.', 42850)
ON CONFLICT (vehicle_id) DO NOTHING;

INSERT INTO srv_workshop.wks_work_orders (work_order_id, vehicle_id, ot_number, kanban_stage, lead_technician_name, customer_symptoms, labor_total_cop, parts_total_cop, total_ot_cop)
VALUES ('ot-2026-842', 'veh-klm-482', 'OT-2026-00842', 'EN_REPARACION_BAHIA', 'Ing. Mauricio Castaño', 'Mantenimiento 40.000 Km + Revisión Inyectores', 650000, 1200000, 1850000)
ON CONFLICT (work_order_id) DO NOTHING;

INSERT INTO srv_workshop.wks_technician_commissions (commission_id, work_order_id, settlement_code, technician_name, labor_base_cop, commission_pct, commission_payable_cop)
VALUES ('com-tec-01', 'ot-2026-842', 'LIQ-TEC-2026-11', 'Ing. Mauricio Castaño', 6800000, 35.00, 2380000)
ON CONFLICT (commission_id) DO NOTHING;

INSERT INTO srv_workshop.wks_warranty_claims (warranty_id, work_order_id, certificate_code, coverage_description, warranty_days, warranty_km)
VALUES ('gar-2026-019', 'ot-2026-842', 'GAR-2026-019', 'Sincronización e Inyectores Diesel', 90, 5000)
ON CONFLICT (warranty_id) DO NOTHING;
