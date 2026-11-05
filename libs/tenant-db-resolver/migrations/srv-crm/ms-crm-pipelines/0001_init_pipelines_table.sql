-- Migration: 0001_init_pipelines_table.sql
-- Microservice: ms:crm (srv_crm) | Module: mod:crm-pipelines (pip_)
CREATE SCHEMA IF NOT EXISTS srv_crm;

CREATE TABLE IF NOT EXISTS srv_crm.pip_opportunities (
  id UUID PRIMARY KEY,
  branch_id VARCHAR(64) NOT NULL DEFAULT 'br-main',
  contact_id UUID REFERENCES srv_crm.dir_contacts(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  stage VARCHAR(48) NOT NULL DEFAULT 'PROPOSAL',
  expected_value NUMERIC(19, 4) NOT NULL DEFAULT 0,
  probability_pct INTEGER NOT NULL DEFAULT 60,
  assigned_executive VARCHAR(120) NOT NULL DEFAULT 'Ing. Carlos Ruiz',
  expected_close_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srv_crm.pip_activities_log (
  activity_id VARCHAR(64) PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES srv_crm.pip_opportunities(id) ON DELETE CASCADE,
  activity_type VARCHAR(32) NOT NULL DEFAULT 'WHATSAPP_FOLLOWUP',
  summary TEXT NOT NULL,
  performed_by VARCHAR(120) NOT NULL DEFAULT 'Ing. Carlos Ruiz',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO srv_crm.pip_opportunities (id, branch_id, contact_id, title, stage, expected_value)
VALUES
  ('11111111-1111-4111-8111-111111111201', 'br-main', '11111111-1111-4111-8111-111111111101', 'Suministro Mensual Dotación Industrial', 'PROPUESTA_ENVIADA', 28000000)
ON CONFLICT (id) DO NOTHING;
