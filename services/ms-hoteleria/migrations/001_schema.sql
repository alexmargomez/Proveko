CREATE SCHEMA IF NOT EXISTS hospitality;

CREATE TABLE IF NOT EXISTS hospitality.seq_counters (
    prefix      VARCHAR(32) PRIMARY KEY,
    current_val INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hospitality.idempotency_keys (
    idem_key      VARCHAR(160) PRIMARY KEY,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitality.rooms (
    id            VARCHAR(48) PRIMARY KEY,
    room_number   VARCHAR(80) NOT NULL UNIQUE,
    room_type     VARCHAR(100) NOT NULL DEFAULT 'Estándar Sencilla',
    floor         VARCHAR(60) NOT NULL DEFAULT 'Piso 1',
    nightly_rate  NUMERIC(18, 2) NOT NULL CHECK (nightly_rate > 0),
    status        VARCHAR(32) NOT NULL DEFAULT 'Disponible' CHECK (status IN ('Disponible', 'Ocupada')),
    check_in_code VARCHAR(32) NOT NULL DEFAULT '',
    guest_id      VARCHAR(48) NOT NULL DEFAULT '',
    guest_name    VARCHAR(160) NOT NULL DEFAULT '',
    guest_doc     VARCHAR(60) NOT NULL DEFAULT '',
    check_in_date VARCHAR(24) NOT NULL DEFAULT '',
    nights        INTEGER NOT NULL DEFAULT 0 CHECK (nights >= 0),
    extras_total  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (extras_total >= 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospitality.room_charges (
    id            VARCHAR(48) PRIMARY KEY,
    room_id       VARCHAR(48) NOT NULL REFERENCES hospitality.rooms(id) ON DELETE CASCADE,
    check_in_code VARCHAR(32) NOT NULL DEFAULT '',
    concept       VARCHAR(200) NOT NULL,
    amount        NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitality_room_charges_room ON hospitality.room_charges (room_id, recorded_at ASC);
