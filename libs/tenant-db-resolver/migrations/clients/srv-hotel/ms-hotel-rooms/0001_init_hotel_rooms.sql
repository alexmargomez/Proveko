-- Migration: 0001_init_hotel_rooms.sql
-- Microservice: ms:hotel (srv_hotel) | Module: mod:hotel-rooms (rom_)
CREATE SCHEMA IF NOT EXISTS srv_hotel;

CREATE TABLE IF NOT EXISTS srv_hotel.rom_rooms (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  room_number VARCHAR(24) NOT NULL,
  category VARCHAR(24) NOT NULL,
  nightly_rate NUMERIC(19, 4) NOT NULL,
  housekeeping_status VARCHAR(24) NOT NULL DEFAULT 'CLEAN'
);
