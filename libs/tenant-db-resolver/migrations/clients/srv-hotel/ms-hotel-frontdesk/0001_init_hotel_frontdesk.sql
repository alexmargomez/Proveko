-- Migration: 0001_init_hotel_frontdesk.sql
-- Microservice: ms:hotel (srv_hotel) | Module: mod:hotel-frontdesk (fdk_)
CREATE SCHEMA IF NOT EXISTS srv_hotel;

CREATE TABLE IF NOT EXISTS srv_hotel.fdk_room_folios (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  room_number VARCHAR(24) NOT NULL,
  guest_contact_id VARCHAR(64) NOT NULL,
  running_balance NUMERIC(19, 4) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'CHECKED_IN'
);
