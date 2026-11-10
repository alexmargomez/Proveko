CREATE SCHEMA IF NOT EXISTS agenda;

CREATE TABLE IF NOT EXISTS agenda.citas (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  date_time TEXT NOT NULL,
  service_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Programada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_citas_datetime ON agenda.citas (date_time);
CREATE INDEX IF NOT EXISTS idx_agenda_citas_worker ON agenda.citas (worker_id);
