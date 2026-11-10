CREATE SCHEMA IF NOT EXISTS bascula;

CREATE TABLE IF NOT EXISTS bascula.cargo_routes (
    id          VARCHAR(32) PRIMARY KEY,
    code        VARCHAR(32) NOT NULL UNIQUE,
    description VARCHAR(180) NOT NULL,
    origin      VARCHAR(120) NOT NULL DEFAULT '',
    destination VARCHAR(120) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bascula.scale_tickets (
    id              VARCHAR(32) PRIMARY KEY,
    weighed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vehicle_id      VARCHAR(40) NOT NULL,
    plate           VARCHAR(24) NOT NULL,
    driver_id       VARCHAR(40) NOT NULL,
    driver_name     VARCHAR(140) NOT NULL,
    carrier_id      VARCHAR(40) NOT NULL,
    carrier_name    VARCHAR(160) NOT NULL,
    cargo_id        VARCHAR(40) NOT NULL,
    cargo_desc      TEXT NOT NULL,
    gross_kg        NUMERIC(14, 2) NOT NULL CHECK (gross_kg > 0),
    tare_kg         NUMERIC(14, 2) NOT NULL CHECK (tare_kg >= 0),
    net_kg          NUMERIC(14, 2) NOT NULL CHECK (net_kg > 0),
    status          VARCHAR(40) NOT NULL DEFAULT 'Pesaje Completado'
);

CREATE INDEX IF NOT EXISTS idx_bascula_scale_tickets_plate ON bascula.scale_tickets (plate);
CREATE INDEX IF NOT EXISTS idx_bascula_scale_tickets_date ON bascula.scale_tickets (weighed_at DESC);
