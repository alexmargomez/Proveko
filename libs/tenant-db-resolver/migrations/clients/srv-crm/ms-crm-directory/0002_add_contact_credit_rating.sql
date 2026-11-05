-- Migration: 0002_add_contact_credit_rating.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-directory (dir_)
ALTER TABLE srv_crm.dir_contacts
  ADD COLUMN IF NOT EXISTS credit_rating VARCHAR(16) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0;
