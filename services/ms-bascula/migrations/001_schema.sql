CREATE SCHEMA IF NOT EXISTS scale;

CREATE TABLE IF NOT EXISTS scale.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scale.idempotency_keys (
    idem_key      VARCHAR(160) PRIMARY KEY,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale.heavy_vehicles (
    id                VARCHAR(48) PRIMARY KEY,
    code              VARCHAR(32) NOT NULL UNIQUE,
    plate             VARCHAR(24) NOT NULL UNIQUE,
    brand             VARCHAR(120) NOT NULL,
    axle_config       VARCHAR(60) NOT NULL DEFAULT 'C3S3 Tractocamión',
    reference_tare_kg NUMERIC(14, 2) NOT NULL DEFAULT 16000 CHECK (reference_tare_kg > 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale.drivers (
    id               VARCHAR(48) PRIMARY KEY,
    code             VARCHAR(32) NOT NULL UNIQUE,
    name             VARCHAR(160) NOT NULL,
    doc_number       VARCHAR(60) NOT NULL,
    license_category VARCHAR(24) NOT NULL DEFAULT 'C3',
    phone            VARCHAR(60) NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale.carriers (
    id         VARCHAR(48) PRIMARY KEY,
    code       VARCHAR(32) NOT NULL UNIQUE,
    name       VARCHAR(160) NOT NULL,
    nit        VARCHAR(60) NOT NULL,
    city       VARCHAR(80) NOT NULL DEFAULT 'Bogotá D.C.',
    phone      VARCHAR(60) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale.cargo_routes (
    id          VARCHAR(48) PRIMARY KEY,
    code        VARCHAR(32) NOT NULL UNIQUE,
    description VARCHAR(200) NOT NULL,
    origin      VARCHAR(120) NOT NULL DEFAULT '',
    destination VARCHAR(120) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scale.scale_tickets (
    id           VARCHAR(48) PRIMARY KEY,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vehicle_id   VARCHAR(48) NOT NULL,
    plate        VARCHAR(24) NOT NULL,
    driver_id    VARCHAR(48) NOT NULL,
    driver_name  VARCHAR(160) NOT NULL,
    carrier_id   VARCHAR(48) NOT NULL,
    carrier_name VARCHAR(160) NOT NULL,
    cargo_id     VARCHAR(48) NOT NULL,
    cargo_desc   VARCHAR(240) NOT NULL,
    gross_kg     NUMERIC(14, 2) NOT NULL CHECK (gross_kg > 0),
    tare_kg      NUMERIC(14, 2) NOT NULL CHECK (tare_kg > 0 AND gross_kg > tare_kg),
    net_kg       NUMERIC(14, 2) NOT NULL CHECK (net_kg > 0),
    status       VARCHAR(48) NOT NULL DEFAULT 'Pesaje Completado'
);

CREATE INDEX IF NOT EXISTS idx_scale_tickets_date ON scale.scale_tickets (recorded_at DESC);
