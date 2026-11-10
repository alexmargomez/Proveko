CREATE SCHEMA IF NOT EXISTS customers;

CREATE TABLE IF NOT EXISTS customers.tariffs (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    discount_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.contracts (
    id                TEXT PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    entity_name       TEXT NOT NULL,
    tariff_id         TEXT REFERENCES customers.tariffs(id),
    tariff_name       TEXT NOT NULL DEFAULT '',
    budget_ceiling    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    consumed_amount   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    available_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'Activo',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.customers (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    doc_type     TEXT NOT NULL DEFAULT 'NIT',
    nit          TEXT NOT NULL,
    dv           TEXT NOT NULL DEFAULT '',
    name         TEXT NOT NULL,
    tax_regime   TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    city         TEXT NOT NULL DEFAULT '',
    address      TEXT NOT NULL DEFAULT '',
    contract_id  TEXT REFERENCES customers.contracts(id),
    tariff_id    TEXT REFERENCES customers.tariffs(id),
    credit_limit NUMERIC(18, 2) NOT NULL DEFAULT 0,
    current_debt NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.vehicles (
    id                 TEXT PRIMARY KEY,
    plate              TEXT NOT NULL UNIQUE,
    brand              TEXT NOT NULL,
    model_year         TEXT NOT NULL DEFAULT '',
    customer_id        TEXT REFERENCES customers.customers(id) ON DELETE SET NULL,
    customer_name      TEXT NOT NULL DEFAULT '',
    current_km         INTEGER NOT NULL DEFAULT 0,
    next_oil_change_km INTEGER NOT NULL DEFAULT 0,
    soat_expiry        TEXT NOT NULL DEFAULT '',
    notes              TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.drivers (
    id               TEXT PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    doc_number       TEXT NOT NULL,
    license_category TEXT NOT NULL DEFAULT 'C2',
    phone            TEXT NOT NULL DEFAULT '',
    vehicle_id       TEXT REFERENCES customers.vehicles(id) ON DELETE SET NULL,
    assigned_plate   TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'Activo',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.carriers (
    id           TEXT PRIMARY KEY,
    code         TEXT NOT NULL UNIQUE,
    nit          TEXT NOT NULL,
    name         TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT '',
    route_zone   TEXT NOT NULL DEFAULT '',
    phone        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.receivable_abonos (
    id         TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    customer_id TEXT REFERENCES customers.customers(id) ON DELETE SET NULL,
    abono_date TEXT NOT NULL,
    amount     NUMERIC(18, 2) NOT NULL,
    method     TEXT NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_nit ON customers.customers (nit);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON customers.vehicles (customer_id);
CREATE INDEX IF NOT EXISTS idx_receivable_abonos_invoice ON customers.receivable_abonos (invoice_id);
