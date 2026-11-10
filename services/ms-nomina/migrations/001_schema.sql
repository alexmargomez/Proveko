CREATE SCHEMA IF NOT EXISTS nomina;

CREATE TABLE IF NOT EXISTS nomina.liquidaciones (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  worker_doc TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL,
  base_salary NUMERIC(19, 4) NOT NULL CHECK (base_salary >= 0),
  bonuses NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  deductions NUMERIC(19, 4) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay NUMERIC(19, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nomina_liquidaciones_worker ON nomina.liquidaciones (worker_id);
CREATE INDEX IF NOT EXISTS idx_nomina_liquidaciones_period ON nomina.liquidaciones (period);
