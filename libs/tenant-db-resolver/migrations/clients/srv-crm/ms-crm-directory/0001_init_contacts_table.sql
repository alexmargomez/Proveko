-- Migration: 0001_init_contacts_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-directory (dir_)
-- Expansión Enterprise: Terceros DIAN (v2 + Siigo), Sucursales, Contactos, Contratos con Bolsa Presupuestal (v2) y Métricas 360° LTV (FixMotor)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.dir_contacts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  tax_id VARCHAR(32) NOT NULL,
  verification_digit VARCHAR(2) NOT NULL DEFAULT '0',
  id_type VARCHAR(16) NOT NULL DEFAULT '31_NIT',
  person_type VARCHAR(16) NOT NULL DEFAULT 'JURIDICA',
  legal_name VARCHAR(180) NOT NULL,
  trade_name VARCHAR(180),
  party_role VARCHAR(40) NOT NULL DEFAULT 'CLIENTE_PROVEEDOR',
  tax_regime_code VARCHAR(16) NOT NULL DEFAULT '48_IVA',
  fiscal_responsibilities_json JSONB NOT NULL DEFAULT '["O-47"]'::jsonb,
  dane_department_code VARCHAR(8) NOT NULL DEFAULT '08',
  dane_municipality_code VARCHAR(10) NOT NULL DEFAULT '08001',
  city_name VARCHAR(80) NOT NULL DEFAULT 'Barranquilla',
  address_line VARCHAR(220),
  phone_whatsapp VARCHAR(40),
  email VARCHAR(160),
  billing_email_dian VARCHAR(160),
  credit_limit NUMERIC(19, 4) NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.dir_contact_branches (
  branch_record_id VARCHAR(64) PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES srv_crm.dir_contacts(id) ON DELETE CASCADE,
  branch_code VARCHAR(32) NOT NULL,
  branch_name VARCHAR(140) NOT NULL,
  dane_municipality_code VARCHAR(10) NOT NULL DEFAULT '08001',
  delivery_address VARCHAR(220) NOT NULL,
  contact_phone VARCHAR(40),
  is_default_shipping BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.dir_contact_persons (
  person_id VARCHAR(64) PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES srv_crm.dir_contacts(id) ON DELETE CASCADE,
  full_name VARCHAR(160) NOT NULL,
  job_title VARCHAR(100) NOT NULL DEFAULT 'Compras / Pagos',
  email VARCHAR(160),
  mobile_whatsapp VARCHAR(40),
  receives_fe_xml BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.dir_commercial_contracts (
  contract_id VARCHAR(64) PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES srv_crm.dir_contacts(id) ON DELETE CASCADE,
  contract_number VARCHAR(48) NOT NULL UNIQUE,
  contract_name VARCHAR(180) NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '365 days'),
  budget_ceiling_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  consumed_amount_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  available_balance_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  warning_threshold_pct INTEGER NOT NULL DEFAULT 80,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.dir_customer_360_metrics (
  metric_id VARCHAR(64) PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES srv_crm.dir_contacts(id) ON DELETE CASCADE,
  rfm_segment VARCHAR(48) NOT NULL DEFAULT 'CAMPEON_VIP',
  lifetime_value_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  average_ticket_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  total_orders_count INTEGER NOT NULL DEFAULT 1,
  days_since_last_purchase INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_internal_roles (
  role_id VARCHAR(64) PRIMARY KEY,
  role_name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  allowed_submodules_json JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_internal_users (
  user_id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NOT NULL,
  role_id VARCHAR(64) NOT NULL REFERENCES public.client_internal_roles(role_id) ON DELETE RESTRICT,
  password_hint VARCHAR(120) NOT NULL,
  is_client_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.client_internal_roles (role_id, role_name, description, allowed_submodules_json)
VALUES
  ('rol-admin', 'Administrador General (Cuenta Admin)', 'Control total en la BD del cliente y gestión de usuarios.', '["*"]'::jsonb),
  ('rol-cajero', 'Cajero, Facturador y Cartera', 'Operación de Caja POS, Facturación DIAN, Tarifarios v2, Glosas y CxC.', '["mod-pos","mod-dian","mod-tariffs","mod-grouped-billing","mod-glosas-disputes","mod-quotes","mod-directory","mod-receivables-cxc"]'::jsonb),
  ('rol-bodega', 'Encargado de Inventario, Compras y Báscula', 'Existencias, Bodegas WMS, Actas v2, Toma Ciega, Compras, RADIAN y Báscula.', '["mod-stock","mod-warehouses","mod-transfers","mod-tech-reception","mod-physical-count","mod-recipes","mod-lots","mod-scale","mod-purchase-orders","mod-fleet-scale"]'::jsonb),
  ('rol-operador', 'Coordinador Operativo (Taller / Gastro / Citas / Hotel)', 'Órdenes de trabajo FixMotor, Salón y KDS, Agenda de Citas v2, Alojamiento y Taquilla QR.', '["mod-vehicles-assets","mod-work-orders-kanban","mod-tables","mod-kds","mod-calendar-slots","mod-bookings","mod-rooms","mod-event-tickets"]'::jsonb)
ON CONFLICT (role_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.client_submodule_records (
  record_id VARCHAR(64) PRIMARY KEY,
  submodule_key VARCHAR(64) NOT NULL,
  cells_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_crm.dir_contacts (id, branch_id, tax_id, verification_digit, id_type, legal_name, party_role, city_name, email, credit_limit)
VALUES
  ('11111111-1111-4111-8111-111111111101', 'br-main', '901.452.110', '4', '31_NIT', 'Comercializadora del Valle S.A.S.', 'CLIENTE_CORPORATIVO', 'Cali', 'facturacion@comvalle.co', 25000000),
  ('11111111-1111-4111-8111-111111111102', 'br-main', '900.771.220', '8', '31_NIT', 'Transportes Rápidos del Norte S.A.S.', 'TRANSPORTISTA', 'Barranquilla', 'logistica@transnorte.co', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO srv_crm.dir_commercial_contracts (contract_id, contact_id, contract_number, contract_name, budget_ceiling_cop, consumed_amount_cop, available_balance_cop, status)
VALUES
  ('cnt-2026-0084', '11111111-1111-4111-8111-111111111101', 'CNT-2026-0084', 'Convenio Suministro Institucional Anual v2', 120000000, 35500000, 84500000, 'ACTIVE')
ON CONFLICT (contract_id) DO NOTHING;

INSERT INTO srv_crm.dir_customer_360_metrics (metric_id, contact_id, rfm_segment, lifetime_value_cop, average_ticket_cop, total_orders_count, days_since_last_purchase)
VALUES
  ('m360-001', '11111111-1111-4111-8111-111111111101', 'CAMPEON_VIP', 68400000, 4850000, 14, 4)
ON CONFLICT (metric_id) DO NOTHING;
