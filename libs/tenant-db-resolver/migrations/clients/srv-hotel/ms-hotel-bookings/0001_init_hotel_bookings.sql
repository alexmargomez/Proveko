-- Migration: 0001_init_hotel_bookings.sql
-- Microservice: ms:hotel (srv_hotel) | Module: mod:hotel-bookings (bkg_)
CREATE SCHEMA IF NOT EXISTS srv_hotel;

CREATE TABLE IF NOT EXISTS srv_hotel.bkg_reservations (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL,
  guest_contact_id VARCHAR(64) NOT NULL,
  room_number VARCHAR(24) NOT NULL,
  nights_count INTEGER NOT NULL,
  estimated_total NUMERIC(19, 4) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CONFIRMED'
);
