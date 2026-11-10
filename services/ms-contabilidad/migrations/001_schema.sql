CREATE SCHEMA IF NOT EXISTS contabilidad;

CREATE TABLE IF NOT EXISTS contabilidad.puc_cuentas (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contabilidad.comprobantes (
  id TEXT PRIMARY KEY,
  debit_account_id TEXT NOT NULL,
  debit_account_name TEXT NOT NULL,
  credit_account_id TEXT NOT NULL,
  credit_account_name TEXT NOT NULL,
  third_party_id TEXT NOT NULL,
  third_party_name TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount NUMERIC(19, 4) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contabilidad_comprobantes_created ON contabilidad.comprobantes (created_at DESC);
