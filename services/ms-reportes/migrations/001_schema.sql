CREATE SCHEMA IF NOT EXISTS reporting;

CREATE TABLE IF NOT EXISTS reporting.seq_counters (
  prefix TEXT PRIMARY KEY,
  current_val BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS reporting.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS reporting.executive_snapshots (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  total_sales NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
  total_collected NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (total_collected >= 0),
  total_pending_receivables NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (total_pending_receivables >= 0),
  total_expenses NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (total_expenses >= 0),
  net_operating_profit NUMERIC(19, 2) NOT NULL DEFAULT 0,
  inventory_cost_value NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (inventory_cost_value >= 0),
  inventory_sale_value NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (inventory_sale_value >= 0),
  low_stock_count INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_count >= 0),
  customers_count INTEGER NOT NULL DEFAULT 0 CHECK (customers_count >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reporting_snapshots_created ON reporting.executive_snapshots (created_at DESC);
