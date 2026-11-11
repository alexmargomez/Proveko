package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-bascula/internal/platform/apperr"
	"ms-bascula/internal/platform/dbpool"
	"ms-bascula/internal/platform/sequences"
	"ms-bascula/internal/domain"
	"ms-bascula/migrations"
)

const (
	schemaName     = "scale"
	serviceKey     = "ms-bascula"
	baseTicketSeq  = 1005
	baseVehicleSeq = 302
	baseDriverSeq  = 202
	baseCarrierSeq = 402
	baseRouteSeq   = 105
)

type Repository struct {
	dbMgr  *dbpool.Manager
	seedMu sync.RWMutex
	seeded map[string]bool
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func (r *Repository) openAndSeed(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, serviceKey, migrations.SchemaSQL)
	if err != nil {
		return nil, err
	}

	r.seedMu.RLock()
	done := r.seeded[dbName]
	r.seedMu.RUnlock()
	if done {
		return pool, nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "seed::"+serviceKey+"::"+dbName); err != nil {
		return nil, err
	}

	var hasAny bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM scale.heavy_vehicles)
		    OR EXISTS(SELECT 1 FROM scale.drivers)
		    OR EXISTS(SELECT 1 FROM scale.carriers)
		    OR EXISTS(SELECT 1 FROM scale.cargo_routes)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		now := time.Now()
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.heavy_vehicles (id, code, plate, brand, axle_config, reference_tare_kg)
			VALUES
				('cam-301', 'CAM-301', 'TRK941', 'Kenworth T800 Cummins ISX', 'C3S3 Tractocamión 6 Ejes', 16200),
				('cam-302', 'CAM-302', 'WLP628', 'International ProStar Euro V', 'C3S2 Dobletroque', 14800)
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.drivers (id, code, name, doc_number, license_category, phone)
			VALUES
				('cond-201', 'COND-201', 'Hernando Quintero', '79.482.110', 'C3', '3114902218'),
				('cond-202', 'COND-202', 'Wilson Valderrama', '80.192.445', 'C3', '3168204190')
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.carriers (id, code, name, nit, city, phone)
			VALUES
				('trn-401', 'TRN-401', 'Transportes Interoceánicos S.A.S.', '900.512.330-4', 'Buenaventura', '6022418800'),
				('trn-402', 'TRN-402', 'Logística de Carga Nacional S.A.', '890.904.118-2', 'Medellín', '6043229100')
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.cargo_routes (id, code, description, origin, destination)
			VALUES
				('car-104', 'CAR-104', 'Granel Agrícola — Maíz Amarillo Importado', 'Puerto Buenaventura', 'Planta Mosquera'),
				('car-105', 'CAR-105', 'Clinker y Agregados Industriales', 'Planta Nobsa', 'Zona Franca Bogotá')
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.scale_tickets (
				id, recorded_at, vehicle_id, plate, driver_id, driver_name,
				carrier_id, carrier_name, cargo_id, cargo_desc,
				gross_kg, tare_kg, net_kg, status
			)
			VALUES (
				'BAS-1005', $1, 'cam-301', 'TRK941', 'cond-201', 'Hernando Quintero',
				'trn-401', 'Transportes Interoceánicos S.A.S.', 'car-104',
				'Granel Agrícola — Maíz Amarillo Importado (Puerto Buenaventura -> Planta Mosquera)',
				51400, 16200, 35200, 'Pesaje Completado'
			)
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-50*time.Minute)); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	r.seedMu.Lock()
	r.seeded[dbName] = true
	r.seedMu.Unlock()
	return pool, nil
}

func (r *Repository) GetState(ctx context.Context, dbName string) (domain.ScaleState, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.ScaleState{}, err
	}

	nextTk, err := sequences.PeekSQL(ctx, pool, schemaName, "BAS", baseTicketSeq)
	if err != nil {
		return domain.ScaleState{}, err
	}
	nextVeh, err := sequences.PeekSQL(ctx, pool, schemaName, "CAM", baseVehicleSeq)
	if err != nil {
		return domain.ScaleState{}, err
	}
	nextDrv, err := sequences.PeekSQL(ctx, pool, schemaName, "COND", baseDriverSeq)
	if err != nil {
		return domain.ScaleState{}, err
	}
	nextCar, err := sequences.PeekSQL(ctx, pool, schemaName, "TRN", baseCarrierSeq)
	if err != nil {
		return domain.ScaleState{}, err
	}
	nextRt, err := sequences.PeekSQL(ctx, pool, schemaName, "CAR", baseRouteSeq)
	if err != nil {
		return domain.ScaleState{}, err
	}

	vRows, err := pool.Query(ctx, `
		SELECT id, code, plate, brand, axle_config, reference_tare_kg::float8
		FROM scale.heavy_vehicles
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.ScaleState{}, err
	}
	defer vRows.Close()

	vehicles := []domain.HeavyVehicle{}
	for vRows.Next() {
		var v domain.HeavyVehicle
		if err := vRows.Scan(&v.ID, &v.Code, &v.Plate, &v.Brand, &v.AxleConfig, &v.ReferenceTareKg); err != nil {
			return domain.ScaleState{}, err
		}
		vehicles = append(vehicles, v)
	}
	if err := vRows.Err(); err != nil {
		return domain.ScaleState{}, err
	}

	dRows, err := pool.Query(ctx, `
		SELECT id, code, name, doc_number, license_category, phone
		FROM scale.drivers
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.ScaleState{}, err
	}
	defer dRows.Close()

	drivers := []domain.Driver{}
	for dRows.Next() {
		var d domain.Driver
		if err := dRows.Scan(&d.ID, &d.Code, &d.Name, &d.DocNumber, &d.LicenseCategory, &d.Phone); err != nil {
			return domain.ScaleState{}, err
		}
		drivers = append(drivers, d)
	}
	if err := dRows.Err(); err != nil {
		return domain.ScaleState{}, err
	}

	cRows, err := pool.Query(ctx, `
		SELECT id, code, name, nit, city, phone
		FROM scale.carriers
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.ScaleState{}, err
	}
	defer cRows.Close()

	carriers := []domain.Carrier{}
	for cRows.Next() {
		var c domain.Carrier
		if err := cRows.Scan(&c.ID, &c.Code, &c.Name, &c.Nit, &c.City, &c.Phone); err != nil {
			return domain.ScaleState{}, err
		}
		carriers = append(carriers, c)
	}
	if err := cRows.Err(); err != nil {
		return domain.ScaleState{}, err
	}

	rRows, err := pool.Query(ctx, `
		SELECT id, code, description, origin, destination
		FROM scale.cargo_routes
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.ScaleState{}, err
	}
	defer rRows.Close()

	routes := []domain.CargoRoute{}
	for rRows.Next() {
		var rt domain.CargoRoute
		if err := rRows.Scan(&rt.ID, &rt.Code, &rt.Description, &rt.Origin, &rt.Destination); err != nil {
			return domain.ScaleState{}, err
		}
		routes = append(routes, rt)
	}
	if err := rRows.Err(); err != nil {
		return domain.ScaleState{}, err
	}

	tRows, err := pool.Query(ctx, `
		SELECT id, to_char(recorded_at, 'YYYY-MM-DD HH24:MI'), vehicle_id, plate,
		       driver_id, driver_name, carrier_id, carrier_name, cargo_id, cargo_desc,
		       gross_kg::float8, tare_kg::float8, net_kg::float8, status
		FROM scale.scale_tickets
		ORDER BY recorded_at DESC, id DESC
	`)
	if err != nil {
		return domain.ScaleState{}, err
	}
	defer tRows.Close()

	tickets := []domain.ScaleTicket{}
	for tRows.Next() {
		var tk domain.ScaleTicket
		if err := tRows.Scan(
			&tk.ID, &tk.Date, &tk.VehicleID, &tk.Plate,
			&tk.DriverID, &tk.DriverName, &tk.CarrierID, &tk.CarrierName, &tk.CargoID, &tk.CargoDesc,
			&tk.GrossKg, &tk.TareKg, &tk.NetKg, &tk.Status,
		); err != nil {
			return domain.ScaleState{}, err
		}
		tickets = append(tickets, tk)
	}
	if err := tRows.Err(); err != nil {
		return domain.ScaleState{}, err
	}

	return domain.ScaleState{
		NextTicketCode:  nextTk,
		NextVehicleCode: nextVeh,
		NextDriverCode:  nextDrv,
		NextCarrierCode: nextCar,
		NextRouteCode:   nextRt,
		Tickets:         tickets,
		Vehicles:        vehicles,
		Drivers:         drivers,
		Carriers:        carriers,
		Routes:          routes,
	}, nil
}

func (r *Repository) CreateVehicle(ctx context.Context, dbName, idemKey string, in domain.CreateHeavyVehicleInput) (domain.HeavyVehicle, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM scale.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "cam:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.HeavyVehicle
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.HeavyVehicle{}, err
		}
	}

	normPlate := domain.NormalizeHeavyPlate(in.Plate)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM scale.heavy_vehicles WHERE plate = $1)`, normPlate).Scan(&exists); err != nil {
		return domain.HeavyVehicle{}, err
	}
	if exists {
		return domain.HeavyVehicle{}, apperr.Conflict("Ya existe un tractocamión registrado con la placa " + normPlate)
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "CAM", baseVehicleSeq)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}
	veh, err := domain.BuildHeavyVehicle(code, in)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scale.heavy_vehicles (id, code, plate, brand, axle_config, reference_tare_kg)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, veh.ID, veh.Code, veh.Plate, veh.Brand, veh.AxleConfig, veh.ReferenceTareKg); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.HeavyVehicle{}, apperr.Conflict("Ya existe un tractocamión registrado con la placa " + veh.Plate)
		}
		return domain.HeavyVehicle{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(veh)
		if err != nil {
			return domain.HeavyVehicle{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "cam:"+cleanKey, raw); err != nil {
			return domain.HeavyVehicle{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.HeavyVehicle{}, err
	}
	return veh, nil
}

func (r *Repository) CreateDriver(ctx context.Context, dbName, idemKey string, in domain.CreateDriverInput) (domain.Driver, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Driver{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Driver{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM scale.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "cond:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Driver
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Driver{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "COND", baseDriverSeq)
	if err != nil {
		return domain.Driver{}, err
	}
	drv, err := domain.BuildDriver(code, in)
	if err != nil {
		return domain.Driver{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scale.drivers (id, code, name, doc_number, license_category, phone)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, drv.ID, drv.Code, drv.Name, drv.DocNumber, drv.LicenseCategory, drv.Phone); err != nil {
		return domain.Driver{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(drv)
		if err != nil {
			return domain.Driver{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "cond:"+cleanKey, raw); err != nil {
			return domain.Driver{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Driver{}, err
	}
	return drv, nil
}

func (r *Repository) CreateCarrier(ctx context.Context, dbName, idemKey string, in domain.CreateCarrierInput) (domain.Carrier, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Carrier{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Carrier{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM scale.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "trn:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Carrier
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Carrier{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "TRN", baseCarrierSeq)
	if err != nil {
		return domain.Carrier{}, err
	}
	car, err := domain.BuildCarrier(code, in)
	if err != nil {
		return domain.Carrier{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scale.carriers (id, code, name, nit, city, phone)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, car.ID, car.Code, car.Name, car.Nit, car.City, car.Phone); err != nil {
		return domain.Carrier{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(car)
		if err != nil {
			return domain.Carrier{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "trn:"+cleanKey, raw); err != nil {
			return domain.Carrier{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Carrier{}, err
	}
	return car, nil
}

func (r *Repository) CreateRoute(ctx context.Context, dbName, idemKey string, in domain.CreateCargoRouteInput) (domain.CargoRoute, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.CargoRoute{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.CargoRoute{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM scale.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "car:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.CargoRoute
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.CargoRoute{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "CAR", baseRouteSeq)
	if err != nil {
		return domain.CargoRoute{}, err
	}
	rt, err := domain.BuildCargoRoute(code, in)
	if err != nil {
		return domain.CargoRoute{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scale.cargo_routes (id, code, description, origin, destination)
		VALUES ($1, $2, $3, $4, $5)
	`, rt.ID, rt.Code, rt.Description, rt.Origin, rt.Destination); err != nil {
		return domain.CargoRoute{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(rt)
		if err != nil {
			return domain.CargoRoute{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "car:"+cleanKey, raw); err != nil {
			return domain.CargoRoute{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CargoRoute{}, err
	}
	return rt, nil
}

func (r *Repository) CreateTicket(ctx context.Context, dbName, idemKey string, in domain.CreateScaleTicketInput) (domain.ScaleTicket, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.ScaleTicket{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM scale.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "bas:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.ScaleTicket
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.ScaleTicket{}, err
		}
	}

	var veh domain.HeavyVehicle
	err = tx.QueryRow(ctx, `
		SELECT id, code, plate, brand, axle_config, reference_tare_kg::float8
		FROM scale.heavy_vehicles
		WHERE id = $1 OR lower(code) = lower($1) OR plate = upper($1)
	`, in.VehicleID).Scan(&veh.ID, &veh.Code, &veh.Plate, &veh.Brand, &veh.AxleConfig, &veh.ReferenceTareKg)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ScaleTicket{}, apperr.NotFound("Tractocamión o vehículo pesado no encontrado")
	}
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	var drv domain.Driver
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, doc_number, license_category, phone
		FROM scale.drivers
		WHERE id = $1 OR lower(code) = lower($1)
	`, in.DriverID).Scan(&drv.ID, &drv.Code, &drv.Name, &drv.DocNumber, &drv.LicenseCategory, &drv.Phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ScaleTicket{}, apperr.NotFound("Conductor no encontrado")
	}
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	var car domain.Carrier
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, nit, city, phone
		FROM scale.carriers
		WHERE id = $1 OR lower(code) = lower($1)
	`, in.CarrierID).Scan(&car.ID, &car.Code, &car.Name, &car.Nit, &car.City, &car.Phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ScaleTicket{}, apperr.NotFound("Empresa transportadora no encontrada")
	}
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	var rt domain.CargoRoute
	err = tx.QueryRow(ctx, `
		SELECT id, code, description, origin, destination
		FROM scale.cargo_routes
		WHERE id = $1 OR lower(code) = lower($1)
	`, in.CargoID).Scan(&rt.ID, &rt.Code, &rt.Description, &rt.Origin, &rt.Destination)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ScaleTicket{}, apperr.NotFound("Tipo de carga o ruta no encontrado")
	}
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	now := time.Now()
	code, err := sequences.NextSQL(ctx, tx, schemaName, "BAS", baseTicketSeq)
	if err != nil {
		return domain.ScaleTicket{}, err
	}
	tk, err := domain.BuildScaleTicket(code, in, veh, drv, car, rt, now)
	if err != nil {
		return domain.ScaleTicket{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scale.scale_tickets (
			id, recorded_at, vehicle_id, plate, driver_id, driver_name,
			carrier_id, carrier_name, cargo_id, cargo_desc,
			gross_kg, tare_kg, net_kg, status
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`, tk.ID, now, tk.VehicleID, tk.Plate, tk.DriverID, tk.DriverName, tk.CarrierID, tk.CarrierName, tk.CargoID, tk.CargoDesc, tk.GrossKg, tk.TareKg, tk.NetKg, tk.Status); err != nil {
		return domain.ScaleTicket{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(tk)
		if err != nil {
			return domain.ScaleTicket{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scale.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "bas:"+cleanKey, raw); err != nil {
			return domain.ScaleTicket{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.ScaleTicket{}, err
	}
	return tk, nil
}
