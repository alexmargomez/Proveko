CREATE SCHEMA IF NOT EXISTS payroll;

CREATE TABLE IF NOT EXISTS payroll.seq_counters (
  prefix TEXT PRIMARY KEY,
  current_val BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll.idempotency_keys (
  scope TEXT NOT NULL,
  idem_key TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, idem_key)
);

CREATE TABLE IF NOT EXISTS payroll.employees (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  doc_number TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL DEFAULT '',
  base_salary NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll.settlements (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  employee_id TEXT NOT NULL REFERENCES payroll.employees(id) ON DELETE RESTRICT,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_doc TEXT NOT NULL,
  employee_position TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL,
  base_salary NUMERIC(19, 2) NOT NULL CHECK (base_salary > 0),
  bonuses NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (bonuses >= 0),
  deductions NUMERIC(19, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay NUMERIC(19, 2) NOT NULL CHECK (net_pay >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (employee_id, period)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employees_created ON payroll.employees (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_employee ON payroll.settlements (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_period ON payroll.settlements (period);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_created ON payroll.settlements (created_at DESC);
