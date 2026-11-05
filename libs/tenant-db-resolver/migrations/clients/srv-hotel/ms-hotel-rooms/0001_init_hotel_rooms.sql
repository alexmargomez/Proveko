-- Migration: 0001_init_hotel_rooms.sql
-- Microservice: ms:hotel (srv_hotel) | Module: mod:hotel-rooms (rms_)
CREATE SCHEMA IF NOT EXISTS srv_hotel;

CREATE TABLE IF NOT EXISTS srv_hotel.rms_rooms (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  room_number VARCHAR(24) NOT NULL,
  room_type VARCHAR(48) NOT NULL,
  nightly_rate NUMERIC(19, 4) NOT NULL,
  housekeeping_status VARCHAR(24) NOT NULL DEFAULT 'CLEAN_INSPECTED'
);

CREATE TABLE IF NOT EXISTS srv_hotel.rms_housekeeping_tasks (
  task_id VARCHAR(64) PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES srv_hotel.rms_rooms(id) ON DELETE CASCADE,
  room_number VARCHAR(24) NOT NULL,
  staff_assigned VARCHAR(140) NOT NULL,
  cleaning_state VARCHAR(48) NOT NULL DEFAULT 'INSPECCIONADA_LISTA',
  minibar_report TEXT NOT NULL DEFAULT 'Sin novedades',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_hotel.rms_rooms (id, branch_id, room_number, room_type, nightly_rate, housekeeping_status)
VALUES ('55555555-5555-4555-8555-555555555101', 'br-main', '304', 'Suite Ejecutiva Vista Jardín', 210000, 'CLEAN_INSPECTED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO srv_hotel.rms_housekeeping_tasks (task_id, room_id, room_number, staff_assigned, cleaning_state, minibar_report)
VALUES ('hsk-304-01', '55555555-5555-4555-8555-555555555101', '304', 'Luz Marina Pineda', 'INSPECCIONADA_LISTA', '2x Agua Cristal Cargadas a Folio')
ON CONFLICT (task_id) DO NOTHING;
