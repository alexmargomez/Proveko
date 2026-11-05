-- Migration: 0002_add_pos_tip_and_notes.sql
-- Microservice: ms:invoicing (srv_invoicing) | Module: mod:invoicing-pos (pos_)
ALTER TABLE srv_invoicing.pos_sale_tickets
  ADD COLUMN IF NOT EXISTS voluntary_tip NUMERIC(19, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashier_notes VARCHAR(255);
