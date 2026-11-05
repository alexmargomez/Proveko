-- Migration: 0001_init_hotel_bookings.sql
-- Microservice: ms:hotel (srv_hotel) & srv_appointments (Agendamiento, Recursos, Recordatorios WhatsApp IA y Turnador v2)
CREATE SCHEMA IF NOT EXISTS srv_hotel;
CREATE SCHEMA IF NOT EXISTS srv_appointments;

CREATE TABLE IF NOT EXISTS srv_hotel.bkg_reservations (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  guest_contact_id VARCHAR(64) NOT NULL,
  room_number VARCHAR(24) NOT NULL,
  nights_count INTEGER NOT NULL,
  estimated_total NUMERIC(19, 4) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CONFIRMED'
);

CREATE TABLE IF NOT EXISTS srv_hotel.bkg_rate_plans_seasons (
  rate_plan_id VARCHAR(64) PRIMARY KEY,
  season_name VARCHAR(160) NOT NULL,
  room_category VARCHAR(80) NOT NULL,
  meal_plan VARCHAR(80) NOT NULL DEFAULT 'ALOJAMIENTO_DESAYUNO_BUFFET',
  nightly_rate_cop NUMERIC(19, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================================
-- ESQUEMA: srv_appointments (Agendas Multi-Profesional v2, Mallas Horarias, Recordatorios IA y Turnador)
-- ============================================================================
CREATE TABLE IF NOT EXISTS srv_appointments.apt_resources_professionals (
  resource_id VARCHAR(64) PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  specialist_name VARCHAR(160) NOT NULL,
  specialty_or_role VARCHAR(120) NOT NULL,
  consulting_room_code VARCHAR(48) NOT NULL,
  default_slot_minutes INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS srv_appointments.apt_schedule_templates (
  template_id VARCHAR(64) PRIMARY KEY,
  resource_id VARCHAR(64) NOT NULL REFERENCES srv_appointments.apt_resources_professionals(resource_id) ON DELETE CASCADE,
  work_days_label VARCHAR(120) NOT NULL DEFAULT 'Lunes a Viernes',
  start_time VARCHAR(16) NOT NULL DEFAULT '07:00',
  end_time VARCHAR(16) NOT NULL DEFAULT '17:00',
  slot_duration_min INTEGER NOT NULL DEFAULT 30,
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS srv_appointments.apt_appointments (
  appointment_id VARCHAR(64) PRIMARY KEY,
  resource_id VARCHAR(64) NOT NULL REFERENCES srv_appointments.apt_resources_professionals(resource_id) ON DELETE RESTRICT,
  appointment_code VARCHAR(48) NOT NULL UNIQUE,
  customer_name VARCHAR(180) NOT NULL,
  customer_whatsapp VARCHAR(40) NOT NULL,
  scheduled_at VARCHAR(40) NOT NULL,
  service_name VARCHAR(180) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED_WHATSAPP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_appointments.apt_automated_reminders (
  reminder_id VARCHAR(64) PRIMARY KEY,
  appointment_id VARCHAR(64) NOT NULL REFERENCES srv_appointments.apt_appointments(appointment_id) ON DELETE CASCADE,
  notification_code VARCHAR(48) NOT NULL UNIQUE,
  channel VARCHAR(32) NOT NULL DEFAULT 'WHATSAPP_INTERACTIVO_IA',
  customer_response VARCHAR(64) NOT NULL DEFAULT 'CONFIRMADA_POR_BOTON',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_appointments.apt_waitlist_queue (
  queue_id VARCHAR(64) PRIMARY KEY,
  turn_ticket VARCHAR(24) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  target_room_module VARCHAR(64) NOT NULL,
  waiting_minutes INTEGER NOT NULL DEFAULT 8,
  status VARCHAR(24) NOT NULL DEFAULT 'CALLING_ON_TV',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_hotel.bkg_rate_plans_seasons (rate_plan_id, season_name, room_category, nightly_rate_cop)
VALUES ('sea-alta-01', 'Temporada Alta Puentes Festivos — Plan Americano', 'Suite Junior VIP', 340000)
ON CONFLICT (rate_plan_id) DO NOTHING;

INSERT INTO srv_appointments.apt_resources_professionals (resource_id, specialist_name, specialty_or_role, consulting_room_code)
VALUES ('res-dr-mejia', 'Dr. Alejandro Mejía', 'Especialista Principal', 'Consultorio 201')
ON CONFLICT (resource_id) DO NOTHING;

INSERT INTO srv_appointments.apt_schedule_templates (template_id, resource_id, work_days_label, start_time, end_time, slot_duration_min)
VALUES ('tpl-mejia-01', 'res-dr-mejia', 'Lunes a Viernes 07:00 AM - 05:00 PM', '07:00', '17:00', 30)
ON CONFLICT (template_id) DO NOTHING;

INSERT INTO srv_appointments.apt_appointments (appointment_id, resource_id, appointment_code, customer_name, customer_whatsapp, scheduled_at, service_name)
VALUES ('cit-2026-412', 'res-dr-mejia', 'CIT-2026-0412', 'Laura Valentina Ríos', '+57 3158841200', '2026-11-12 09:30 AM', 'Valoración Especializada Integral')
ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO srv_appointments.apt_automated_reminders (reminder_id, appointment_id, notification_code, channel, customer_response)
VALUES ('wsp-2026-8812', 'cit-2026-412', 'WSP-2026-8812', 'WHATSAPP_INTERACTIVO_IA', 'CONFIRMADA_POR_BOTON')
ON CONFLICT (reminder_id) DO NOTHING;

INSERT INTO srv_appointments.apt_waitlist_queue (queue_id, turn_ticket, customer_name, target_room_module, waiting_minutes)
VALUES ('que-a042', 'A-042', 'Jorge Enrique Vargas', 'Consultorio 201', 8)
ON CONFLICT (queue_id) DO NOTHING;
