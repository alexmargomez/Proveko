CREATE SCHEMA IF NOT EXISTS reportes;

CREATE TABLE IF NOT EXISTS reportes.cortes_gerenciales (
  id TEXT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_sales NUMERIC(19, 4) NOT NULL DEFAULT 0,
  total_collected NUMERIC(19, 4) NOT NULL DEFAULT 0,
  total_pending_receivables NUMERIC(19, 4) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(19, 4) NOT NULL DEFAULT 0,
  net_operating_profit NUMERIC(19, 4) NOT NULL DEFAULT 0,
  inventory_cost_value NUMERIC(19, 4) NOT NULL DEFAULT 0,
  inventory_sale_value NUMERIC(19, 4) NOT NULL DEFAULT 0
);
