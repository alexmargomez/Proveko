CREATE SCHEMA IF NOT EXISTS taller;

CREATE TABLE IF NOT EXISTS taller.workers (
    id              VARCHAR(32) PRIMARY KEY,
    code            VARCHAR(32) NOT NULL UNIQUE,
    name            VARCHAR(140) NOT NULL,
    doc_number      VARCHAR(40) NOT NULL DEFAULT '',
    specialty       VARCHAR(120) NOT NULL DEFAULT 'Mecánica General',
    commission_pct  NUMERIC(6, 2) NOT NULL DEFAULT 40,
    phone           VARCHAR(40) NOT NULL DEFAULT '',
    total_day_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taller.work_orders (
    id              VARCHAR(32) PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    customer_id     VARCHAR(40) NOT NULL,
    customer_name   VARCHAR(160) NOT NULL,
    vehicle_id      VARCHAR(40) NOT NULL,
    plate           VARCHAR(24) NOT NULL,
    vehicle_brand   VARCHAR(140) NOT NULL DEFAULT '',
    current_km      INTEGER NOT NULL DEFAULT 0,
    next_oil_km     INTEGER NOT NULL DEFAULT 0,
    worker_id       VARCHAR(32) NOT NULL DEFAULT '',
    worker_name     VARCHAR(140) NOT NULL DEFAULT '',
    status          VARCHAR(32) NOT NULL DEFAULT 'Recibido',
    service_desc    TEXT NOT NULL,
    total_estimated NUMERIC(14, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_taller_work_orders_plate ON taller.work_orders (plate);
CREATE INDEX IF NOT EXISTS idx_taller_work_orders_status ON taller.work_orders (status);

CREATE TABLE IF NOT EXISTS taller.settlements (
    id                  VARCHAR(32) PRIMARY KEY,
    settled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    worker_id           VARCHAR(32) NOT NULL REFERENCES taller.workers(id),
    worker_name         VARCHAR(140) NOT NULL,
    gross_labor         NUMERIC(14, 2) NOT NULL,
    commission_pct      NUMERIC(6, 2) NOT NULL,
    technician_payout   NUMERIC(14, 2) NOT NULL,
    company_retention   NUMERIC(14, 2) NOT NULL
);
