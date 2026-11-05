-- Migration: 0001_init_contacts_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-directory (dir_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.dir_contacts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  tax_id VARCHAR(32) NOT NULL,
  id_type VARCHAR(16) NOT NULL,
  legal_name VARCHAR(180) NOT NULL,
  email VARCHAR(160),
  credit_limit NUMERIC(19, 4) NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  ('rol-cajero', 'Cajero y Facturador', 'Operación de Caja POS, Facturación y Clientes.', '["mod-pos","mod-dian","mod-quotes","mod-directory"]'::jsonb),
  ('rol-bodega', 'Encargado de Inventario y Bodega', 'Existencias, Bodegas, Solicitudes de Traslados, Lotes y Báscula.', '["mod-stock","mod-warehouses","mod-transfers","mod-lots","mod-scale"]'::jsonb),
  ('rol-operador', 'Operador de Servicio', 'Comandas, Mesas, Reservas de Cupos y Tickets.', '["mod-tables","mod-kds","mod-split","mod-bookings","mod-tickets","mod-rooms"]'::jsonb)
ON CONFLICT (role_id) DO NOTHING;
