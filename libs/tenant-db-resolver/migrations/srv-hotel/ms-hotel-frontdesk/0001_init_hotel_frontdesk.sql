-- Migration: 0001_init_hotel_frontdesk.sql
-- Microservice: ms:hotel (srv_hotel) & srv_ticketing (Taquilla QR Criptográfica, Control de Aforo y Mesa PQRSF SLA Ley 1755)
CREATE SCHEMA IF NOT EXISTS srv_hotel;
CREATE SCHEMA IF NOT EXISTS srv_ticketing;

CREATE TABLE IF NOT EXISTS srv_hotel.fdk_checkins (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  reservation_id VARCHAR(64) NOT NULL,
  room_number VARCHAR(24) NOT NULL,
  guest_contact_id VARCHAR(64) NOT NULL,
  checkin_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS srv_hotel.fdk_guest_folios (
  folio_id VARCHAR(64) PRIMARY KEY,
  checkin_id UUID NOT NULL REFERENCES srv_hotel.fdk_checkins(id) ON DELETE CASCADE,
  charge_concept VARCHAR(180) NOT NULL,
  source_outlet VARCHAR(64) NOT NULL DEFAULT 'RESTAURANTE_MINIBAR',
  amount_cop NUMERIC(19, 2) NOT NULL,
  charged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ESQUEMA: srv_ticketing (Eventos, Taquilla QR Antifraude, Torniquetes y Mesa de Ayuda PQRSF con SLA Días Hábiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_ticketing.tck_events_venues (
  event_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  event_code VARCHAR(48) NOT NULL UNIQUE,
  event_name VARCHAR(180) NOT NULL,
  gate_name VARCHAR(120) NOT NULL DEFAULT 'Portería Principal Calle 85',
  max_legal_capacity INTEGER NOT NULL DEFAULT 450,
  checked_in_count INTEGER NOT NULL DEFAULT 340,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN_GATE'
);

CREATE TABLE IF NOT EXISTS srv_ticketing.tck_tickets_issued (
  ticket_id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL REFERENCES srv_ticketing.tck_events_venues(event_id) ON DELETE CASCADE,
  ticket_code VARCHAR(48) NOT NULL UNIQUE,
  zone_or_locality VARCHAR(80) NOT NULL DEFAULT 'Palco VIP (Incluye Consumo)',
  buyer_name VARCHAR(160) NOT NULL,
  qr_crypto_token VARCHAR(128) NOT NULL UNIQUE,
  price_cop NUMERIC(19, 2) NOT NULL,
  gate_scan_status VARCHAR(32) NOT NULL DEFAULT 'VALID_READY',
  scanned_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS srv_ticketing.tck_pqrsf_cases (
  case_id VARCHAR(64) PRIMARY KEY,
  radicado_number VARCHAR(48) NOT NULL UNIQUE,
  request_type VARCHAR(48) NOT NULL DEFAULT 'PETICION_LEY_1755',
  petitioner_name VARCHAR(180) NOT NULL,
  petitioner_email VARCHAR(160) NOT NULL,
  subject_summary TEXT NOT NULL,
  max_business_days_sla INTEGER NOT NULL DEFAULT 15,
  remaining_business_days INTEGER NOT NULL DEFAULT 12,
  sla_semaphore VARCHAR(24) NOT NULL DEFAULT 'VERDE_EN_TERMINO',
  status VARCHAR(24) NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_ticketing.tck_pqrsf_sla_logs (
  sla_log_id VARCHAR(64) PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL REFERENCES srv_ticketing.tck_pqrsf_cases(case_id) ON DELETE CASCADE,
  action_note TEXT NOT NULL,
  holiday_calendar_applied VARCHAR(64) NOT NULL DEFAULT 'CO_LEY_EMILIANI_2026',
  logged_by VARCHAR(140) NOT NULL DEFAULT 'Mesa de Ayuda PQRSF',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_ticketing.tck_events_venues (event_id, event_code, event_name, gate_name, max_legal_capacity, checked_in_count)
VALUES ('evt-sabado-01', 'EVT-2026-85', 'Sábado Concierto en Vivo', 'Portería Principal Calle 85', 450, 340)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO srv_ticketing.tck_tickets_issued (ticket_id, event_id, ticket_code, zone_or_locality, buyer_name, qr_crypto_token, price_cop)
VALUES ('tck-ev-99201', 'evt-sabado-01', 'TCK-EV-99201', 'Palco VIP (Incluye Consumo)', 'Santiago Ospina', 'QR-PK-88412', 65000)
ON CONFLICT (ticket_id) DO NOTHING;

INSERT INTO srv_ticketing.tck_pqrsf_cases (case_id, radicado_number, request_type, petitioner_name, petitioner_email, subject_summary, remaining_business_days)
VALUES ('pqrs-2026-914', 'PQRS-2026-00914', 'PETICION_LEY_1755', 'Marcela Quintero', 'marcela@cliente.co', 'Solicitud de copia de certificado y factura electrónica', 12)
ON CONFLICT (case_id) DO NOTHING;
