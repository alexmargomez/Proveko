CREATE SCHEMA IF NOT EXISTS hoteleria;

CREATE TABLE IF NOT EXISTS hoteleria.rooms (
    id              VARCHAR(32) PRIMARY KEY,
    room_number     VARCHAR(80) NOT NULL UNIQUE,
    room_type       VARCHAR(100) NOT NULL,
    floor_zone      VARCHAR(60) NOT NULL DEFAULT 'Piso 1',
    nightly_rate    NUMERIC(14, 2) NOT NULL CHECK (nightly_rate >= 0),
    status          VARCHAR(32) NOT NULL DEFAULT 'Disponible',
    check_in_code   VARCHAR(40) NOT NULL DEFAULT '',
    guest_id        VARCHAR(40) NOT NULL DEFAULT '',
    guest_name      VARCHAR(160) NOT NULL DEFAULT '',
    check_in_date   VARCHAR(32) NOT NULL DEFAULT '',
    nights          INTEGER NOT NULL DEFAULT 0,
    extras_total    NUMERIC(14, 2) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hoteleria.room_charges (
    id          BIGSERIAL PRIMARY KEY,
    room_id     VARCHAR(32) NOT NULL REFERENCES hoteleria.rooms(id) ON DELETE CASCADE,
    concept     VARCHAR(160) NOT NULL,
    amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hoteleria_rooms_status ON hoteleria.rooms (status);
