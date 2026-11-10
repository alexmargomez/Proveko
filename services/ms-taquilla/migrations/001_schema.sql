CREATE SCHEMA IF NOT EXISTS taquilla;

CREATE TABLE IF NOT EXISTS taquilla.boletas (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  zone TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(19, 4) NOT NULL CHECK (unit_price >= 0),
  total NUMERIC(19, 4) NOT NULL CHECK (total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taquilla_boletas_event ON taquilla.boletas (event_name);
CREATE INDEX IF NOT EXISTS idx_taquilla_boletas_created ON taquilla.boletas (created_at DESC);
