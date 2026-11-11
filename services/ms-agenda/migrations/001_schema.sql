CREATE SCHEMA IF NOT EXISTS scheduling;

CREATE TABLE IF NOT EXISTS scheduling.seq_counters (
  prefix VARCHAR(32) PRIMARY KEY,
  current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduling.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS scheduling.resources (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'Especialista General',
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduling.appointments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  resource_id TEXT NOT NULL REFERENCES scheduling.resources(id) ON DELETE RESTRICT,
  resource_name TEXT NOT NULL,
  resource_specialty TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_nit TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  date_time TEXT NOT NULL,
  service_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Programada',
  created_at TEXT NOT NULL,
  UNIQUE (resource_id, date_time)
);

CREATE INDEX IF NOT EXISTS idx_scheduling_appointments_dt ON scheduling.appointments (date_time ASC);
