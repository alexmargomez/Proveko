-- Migration: 0001_init_pos_tables.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-pos (pos_)
-- Expansión Enterprise: Terminales POS, Turnos, Arqueo Ciego X/Z, Tirilla Electrónica, Líneas de Venta y Pagos Mixtos
CREATE SCHEMA IF NOT EXISTS srv_invoicing;

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_terminals (
  terminal_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  terminal_code VARCHAR(32) NOT NULL UNIQUE,
  terminal_name VARCHAR(120) NOT NULL,
  dian_pos_prefix VARCHAR(16) NOT NULL DEFAULT 'POSE',
  status VARCHAR(24) NOT NULL DEFAULT 'ONLINE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_cash_shifts (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  terminal_id VARCHAR(64) REFERENCES srv_invoicing.pos_terminals(terminal_id) ON DELETE SET NULL,
  cashier_user_id VARCHAR(64) NOT NULL,
  cashier_name VARCHAR(140) NOT NULL DEFAULT 'Laura Gómez — Turno Mañana',
  opening_balance NUMERIC(19, 4) NOT NULL DEFAULT 250000,
  closing_balance NUMERIC(19, 4),
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_blind_cash_counts (
  blind_count_id VARCHAR(64) PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES srv_invoicing.pos_cash_shifts(id) ON DELETE CASCADE,
  declared_cash_cop NUMERIC(19, 2) NOT NULL,
  declared_cards_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  declared_transfers_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  system_expected_cash_cop NUMERIC(19, 2) NOT NULL,
  difference_cop NUMERIC(19, 2) NOT NULL DEFAULT 0,
  denominations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_sale_tickets (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  shift_id UUID REFERENCES srv_invoicing.pos_cash_shifts(id) ON DELETE SET NULL,
  ticket_number VARCHAR(48) NOT NULL DEFAULT 'POS-9001',
  contact_id VARCHAR(64) NOT NULL,
  customer_name VARCHAR(180) NOT NULL DEFAULT 'Consumidor Final',
  subtotal NUMERIC(19, 4) NOT NULL,
  tax_total NUMERIC(19, 4) NOT NULL,
  inc_total NUMERIC(19, 4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(19, 4) NOT NULL,
  emitted_via VARCHAR(48) NOT NULL DEFAULT 'POS_ELECTRONICO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_sale_ticket_lines (
  line_id VARCHAR(64) PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES srv_invoicing.pos_sale_tickets(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  qty NUMERIC(19, 4) NOT NULL DEFAULT 1,
  unit_price_cop NUMERIC(19, 2) NOT NULL,
  discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_rate_pct NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  line_total_cop NUMERIC(19, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS srv_invoicing.pos_ticket_payments (
  payment_id VARCHAR(64) PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES srv_invoicing.pos_sale_tickets(id) ON DELETE CASCADE,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'EFECTIVO',
  amount_cop NUMERIC(19, 2) NOT NULL,
  voucher_or_qr_ref VARCHAR(64),
  change_returned_cop NUMERIC(19, 2) NOT NULL DEFAULT 0
);

INSERT INTO srv_invoicing.pos_terminals (terminal_id, terminal_code, terminal_name)
VALUES ('term-pos-01', 'CAJA-01', 'Caja Principal Mostrador 01')
ON CONFLICT (terminal_id) DO NOTHING;

INSERT INTO srv_invoicing.pos_cash_shifts (id, branch_id, terminal_id, cashier_user_id, cashier_name, opening_balance, status)
VALUES ('33333333-3333-4333-8333-333333333101', 'br-main', 'term-pos-01', 'usr-cajero-01', 'Laura Gómez — Turno Mañana', 300000, 'OPEN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO srv_invoicing.pos_sale_tickets (id, branch_id, shift_id, ticket_number, contact_id, customer_name, subtotal, tax_total, grand_total, emitted_via)
VALUES ('33333333-3333-4333-8333-333333333102', 'br-main', '33333333-3333-4333-8333-333333333101', 'POS-9001', '222222222-2', 'Consumidor Final', 124790, 23710, 148500, 'POS_ELECTRONICO')
ON CONFLICT (id) DO NOTHING;
