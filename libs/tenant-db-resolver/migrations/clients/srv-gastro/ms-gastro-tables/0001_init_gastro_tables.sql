-- Migration: 0001_init_gastro_tables.sql
-- Microservice: ms:gastro (srv_gastro) | Module: mod:gastro-tables (tbl_)
-- Expansión Enterprise: Mesas, Sesiones de Mesa/Barra, Modificadores de Carta y Despacho de Domicilios
CREATE SCHEMA IF NOT EXISTS srv_gastro;

CREATE TABLE IF NOT EXISTS srv_gastro.tbl_dining_tables (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  table_code VARCHAR(32) NOT NULL,
  zone_name VARCHAR(64) NOT NULL,
  capacity_seats INTEGER NOT NULL DEFAULT 4,
  status VARCHAR(24) NOT NULL DEFAULT 'AVAILABLE'
);

CREATE TABLE IF NOT EXISTS srv_gastro.tbl_table_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES srv_gastro.tbl_dining_tables(id) ON DELETE CASCADE,
  waiter_name VARCHAR(120) NOT NULL DEFAULT 'Mateo Ríos',
  guests_count INTEGER NOT NULL DEFAULT 4,
  bar_bottle_measure VARCHAR(64) DEFAULT 'Botella Completa 750ml',
  accumulated_consumption_cop NUMERIC(19, 2) NOT NULL DEFAULT 186000,
  impoconsumo_8pct_cop NUMERIC(19, 2) NOT NULL DEFAULT 13778,
  suggested_tip_10pct_cop NUMERIC(19, 2) NOT NULL DEFAULT 17222,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN_OCCUPIED',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_gastro.tbl_menu_modifier_groups (
  modifier_group_id VARCHAR(64) PRIMARY KEY,
  group_name VARCHAR(140) NOT NULL,
  target_category VARCHAR(120) NOT NULL,
  options_csv TEXT NOT NULL,
  extra_price_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS srv_gastro.tbl_delivery_dispatches (
  delivery_id VARCHAR(64) PRIMARY KEY,
  order_code VARCHAR(48) NOT NULL UNIQUE,
  customer_name_phone VARCHAR(160) NOT NULL,
  delivery_address VARCHAR(220) NOT NULL,
  channel VARCHAR(48) NOT NULL DEFAULT 'WHATSAPP_DIRECTO',
  courier_name_plate VARCHAR(160) NOT NULL,
  total_to_collect_cop NUMERIC(19, 2) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DISPATCHED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_gastro.tbl_dining_tables (id, branch_id, table_code, zone_name, capacity_seats, status)
VALUES ('44444444-4444-4444-8444-444444444101', 'br-main', 'MESA-05', 'Terraza Principal', 4, 'OCCUPIED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO srv_gastro.tbl_menu_modifier_groups (modifier_group_id, group_name, target_category, options_csv, extra_price_cop)
VALUES ('mod-grp-01', 'Término de Cocción / Adiciones Parrilla', 'Cortes de Parrilla y Hamburguesas', 'Azul, Medio, 3/4, Bien Asado + Tocineta', 8500)
ON CONFLICT (modifier_group_id) DO NOTHING;

INSERT INTO srv_gastro.tbl_delivery_dispatches (delivery_id, order_code, customer_name_phone, delivery_address, channel, courier_name_plate, total_to_collect_cop)
VALUES ('dom-2026-419', 'DOM-2026-419', 'Andrés Ospina — 310 554 1190', 'Cra 15 # 88-20 Apto 502', 'WHATSAPP_DIRECTO', 'Kevin Mora — Moto KLM-45D', 94000)
ON CONFLICT (delivery_id) DO NOTHING;
