CREATE SCHEMA IF NOT EXISTS caja;

CREATE TABLE IF NOT EXISTS caja.expenses (
    id              VARCHAR(32) PRIMARY KEY,
    expense_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category        VARCHAR(80) NOT NULL,
    description     TEXT NOT NULL,
    amount          NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    payment_source  VARCHAR(60) NOT NULL DEFAULT 'Efectivo Caja',
    responsible     VARCHAR(120) NOT NULL DEFAULT 'Caja Principal',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caja_expenses_date ON caja.expenses (expense_date DESC);

CREATE TABLE IF NOT EXISTS caja.bank_movements (
    id              VARCHAR(32) PRIMARY KEY,
    movement_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    account_name    VARCHAR(100) NOT NULL,
    movement_type   VARCHAR(32) NOT NULL,
    reference_code  VARCHAR(80) NOT NULL DEFAULT '',
    concept         TEXT NOT NULL,
    amount          NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    reconciled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caja_bank_movements_date ON caja.bank_movements (movement_date DESC);
