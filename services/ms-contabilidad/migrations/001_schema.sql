CREATE SCHEMA IF NOT EXISTS accounting;

CREATE TABLE IF NOT EXISTS accounting.seq_counters (
  prefix TEXT PRIMARY KEY,
  current_val BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS accounting.puc_accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounting.vouchers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  debit_account_id TEXT NOT NULL REFERENCES accounting.puc_accounts(id) ON DELETE RESTRICT,
  debit_account_code TEXT NOT NULL,
  debit_account_name TEXT NOT NULL,
  credit_account_id TEXT NOT NULL REFERENCES accounting.puc_accounts(id) ON DELETE RESTRICT,
  credit_account_code TEXT NOT NULL,
  credit_account_name TEXT NOT NULL,
  third_party_id TEXT NOT NULL DEFAULT '',
  third_party_name TEXT NOT NULL,
  third_party_nit TEXT NOT NULL DEFAULT '',
  concept TEXT NOT NULL,
  amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL,
  CHECK (debit_account_id <> credit_account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_puc_code ON accounting.puc_accounts (code);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_debit ON accounting.vouchers (debit_account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_credit ON accounting.vouchers (credit_account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_vouchers_created ON accounting.vouchers (created_at DESC);
