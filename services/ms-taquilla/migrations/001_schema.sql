CREATE SCHEMA IF NOT EXISTS ticketing;

CREATE TABLE IF NOT EXISTS ticketing.seq_counters (
  prefix TEXT PRIMARY KEY,
  current_val BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticketing.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS ticketing.events (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  zone TEXT NOT NULL DEFAULT 'General',
  base_price NUMERIC(19, 2) NOT NULL CHECK (base_price >= 0),
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticketing.tickets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  event_id TEXT REFERENCES ticketing.events(id) ON DELETE RESTRICT,
  event_name TEXT NOT NULL,
  zone TEXT NOT NULL,
  customer_id TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_nit TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL CHECK (qty >= 1),
  unit_price NUMERIC(19, 2) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(19, 2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Efectivo',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticketing_events_created ON ticketing.events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticketing_tickets_event ON ticketing.tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_ticketing_tickets_created ON ticketing.tickets (created_at DESC);
