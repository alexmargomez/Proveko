CREATE SCHEMA IF NOT EXISTS customers;

CREATE TABLE IF NOT EXISTS customers.tariffs (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.contracts (
    id                TEXT PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    entity_nit        TEXT NOT NULL DEFAULT '',
    tariff_id         TEXT REFERENCES customers.tariffs(id) ON DELETE SET NULL,
    tariff_name       TEXT NOT NULL DEFAULT '',
    budget_ceiling    NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (budget_ceiling >= 0),
    consumed_amount   NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
    available_balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.customers (
    id            TEXT PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    nit           TEXT NOT NULL,
    phone         TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    address       TEXT NOT NULL DEFAULT '',
    contract_id   TEXT REFERENCES customers.contracts(id) ON DELETE SET NULL,
    contract_code TEXT NOT NULL DEFAULT '',
    tariff_id     TEXT REFERENCES customers.tariffs(id) ON DELETE SET NULL,
    tariff_name   TEXT NOT NULL DEFAULT '',
    credit_limit  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    current_debt  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (current_debt >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.receivables (
    invoice_id      TEXT PRIMARY KEY,
    invoice_number  TEXT NOT NULL,
    issue_date      TEXT NOT NULL,
    customer_id     TEXT REFERENCES customers.customers(id) ON DELETE SET NULL,
    customer_name   TEXT NOT NULL,
    customer_nit    TEXT NOT NULL DEFAULT '',
    invoice_total   NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (invoice_total >= 0),
    pending_balance NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.abonos (
    id          TEXT PRIMARY KEY,
    invoice_id  TEXT NOT NULL REFERENCES customers.receivables(invoice_id) ON DELETE CASCADE,
    recorded_at TEXT NOT NULL,
    amount      NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    method      TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.idempotency_keys (
    idem_key   TEXT PRIMARY KEY,
    payload    JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_nit ON customers.customers (nit);
CREATE INDEX IF NOT EXISTS idx_receivables_customer ON customers.receivables (customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_pending ON customers.receivables (pending_balance);
CREATE INDEX IF NOT EXISTS idx_abonos_invoice ON customers.abonos (invoice_id);
