CREATE SCHEMA IF NOT EXISTS treasury;

CREATE TABLE IF NOT EXISTS treasury.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS treasury.idempotency_keys (
    idem_key      VARCHAR(128) PRIMARY KEY,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury.cash_incomes (
    id             VARCHAR(32) PRIMARY KEY,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category       VARCHAR(80) NOT NULL,
    description    VARCHAR(240) NOT NULL,
    amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(60) NOT NULL,
    responsible    VARCHAR(120) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_cash_incomes_date ON treasury.cash_incomes (recorded_at DESC);

CREATE TABLE IF NOT EXISTS treasury.expenses (
    id             VARCHAR(32) PRIMARY KEY,
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category       VARCHAR(80) NOT NULL,
    description    VARCHAR(240) NOT NULL,
    amount         NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    payment_source VARCHAR(60) NOT NULL,
    responsible    VARCHAR(120) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treasury_expenses_date ON treasury.expenses (recorded_at DESC);

CREATE TABLE IF NOT EXISTS treasury.bank_movements (
    id            VARCHAR(32) PRIMARY KEY,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_name  VARCHAR(140) NOT NULL,
    movement_type VARCHAR(24) NOT NULL CHECK (movement_type IN ('Ingreso', 'Egreso')),
    reference     VARCHAR(80) NOT NULL DEFAULT '',
    concept       VARCHAR(240) NOT NULL,
    amount        NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    actor         VARCHAR(120) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_treasury_bank_movements_date ON treasury.bank_movements (recorded_at DESC);
