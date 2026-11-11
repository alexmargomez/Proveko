CREATE SCHEMA IF NOT EXISTS workshop;

CREATE TABLE IF NOT EXISTS workshop.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workshop.idempotency_keys (
    idem_key      VARCHAR(160) PRIMARY KEY,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workshop.vehicles (
    id            VARCHAR(48) PRIMARY KEY,
    plate         VARCHAR(24) NOT NULL UNIQUE,
    brand         VARCHAR(120) NOT NULL,
    vehicle_type  VARCHAR(60) NOT NULL DEFAULT 'Automóvil',
    customer_id   VARCHAR(48) NOT NULL DEFAULT '',
    customer_name VARCHAR(160) NOT NULL DEFAULT '',
    current_km    INTEGER NOT NULL DEFAULT 0 CHECK (current_km >= 0),
    next_oil_km   INTEGER NOT NULL DEFAULT 5000 CHECK (next_oil_km >= 0),
    soat_expiry   VARCHAR(24) NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workshop.workers (
    id              VARCHAR(48) PRIMARY KEY,
    code            VARCHAR(32) NOT NULL UNIQUE,
    name            VARCHAR(160) NOT NULL,
    doc_number      VARCHAR(60) NOT NULL DEFAULT '',
    specialty       VARCHAR(140) NOT NULL DEFAULT 'Mecánica Automotriz General',
    commission_pct  NUMERIC(6, 2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
    phone           VARCHAR(60) NOT NULL DEFAULT '',
    total_day_gross NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total_day_gross >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workshop.work_orders (
    id              VARCHAR(48) PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    customer_id     VARCHAR(48) NOT NULL DEFAULT '',
    customer_name   VARCHAR(160) NOT NULL DEFAULT '',
    vehicle_id      VARCHAR(48) NOT NULL,
    plate           VARCHAR(24) NOT NULL,
    vehicle_brand   VARCHAR(120) NOT NULL,
    current_km      INTEGER NOT NULL DEFAULT 0 CHECK (current_km >= 0),
    next_oil_km     INTEGER NOT NULL DEFAULT 5000 CHECK (next_oil_km >= 0),
    worker_id       VARCHAR(48) NOT NULL DEFAULT '',
    worker_name     VARCHAR(160) NOT NULL DEFAULT '',
    status          VARCHAR(32) NOT NULL CHECK (status IN ('Recibido', 'En Proceso', 'Listo', 'Entregado')),
    service_desc    TEXT NOT NULL,
    total_estimated NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (total_estimated >= 0)
);

CREATE INDEX IF NOT EXISTS idx_workshop_orders_created ON workshop.work_orders (created_at DESC);

CREATE TABLE IF NOT EXISTS workshop.settlements (
    id                VARCHAR(48) PRIMARY KEY,
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id         VARCHAR(48) NOT NULL,
    worker_name       VARCHAR(160) NOT NULL,
    gross_labor       NUMERIC(18, 2) NOT NULL CHECK (gross_labor > 0),
    commission_pct    NUMERIC(6, 2) NOT NULL,
    technician_payout NUMERIC(18, 2) NOT NULL,
    company_retention NUMERIC(18, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workshop_settlements_date ON workshop.settlements (recorded_at DESC);
