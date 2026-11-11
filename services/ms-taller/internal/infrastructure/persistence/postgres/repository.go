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
	"ms-taller/internal/platform/apperr"
	"ms-taller/internal/platform/dbpool"
	"ms-taller/internal/platform/money"
	"ms-taller/internal/platform/sequences"
	"ms-taller/internal/domain"
	"ms-taller/migrations"
)

const (
	schemaName        = "workshop"
	serviceKey        = "ms-taller"
	baseVehicleSeq    = 203
	baseWorkerSeq     = 105
	baseOrderSeq      = 705
	baseSettlementSeq = 305
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
		SELECT EXISTS(SELECT 1 FROM workshop.vehicles)
		    OR EXISTS(SELECT 1 FROM workshop.workers)
		    OR EXISTS(SELECT 1 FROM workshop.work_orders)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		now := time.Now()
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.vehicles (id, plate, brand, vehicle_type, customer_id, customer_name, current_km, next_oil_km, soat_expiry)
			VALUES
				('veh-201', 'KLP842', 'Toyota Hilux 2.8 4x4', 'Camioneta', 'cli-101', 'Inversiones Andinas S.A.S.', 68400, 73400, '2027-04-18'),
				('veh-202', 'MTR519', 'Mazda CX-30 Grand Touring', 'Automóvil', 'cli-102', 'Distribuidora del Valle Ltda.', 34200, 39200, '2027-08-05'),
				('veh-203', 'FQZ910', 'Chevrolet NHR Reward Euro VI', 'Utilitario / Carga', '', 'Logística Metropolitana S.A.S.', 112500, 117500, '2027-02-22')
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.workers (id, code, name, doc_number, specialty, commission_pct, phone, total_day_gross)
			VALUES
				('tec-104', 'TEC-104', 'Ricardo Ospina', '71.384.920', 'Inyección Electrónica y Diagnóstico', 40, '3104829104', 220000),
				('tec-105', 'TEC-105', 'Julián Morales', '1.026.584.119', 'Frenos, Suspensión y Sincronización', 35, '3158291044', 140000)
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.work_orders (
				id, created_at, customer_id, customer_name, vehicle_id, plate, vehicle_brand,
				current_km, next_oil_km, worker_id, worker_name, status, service_desc, total_estimated
			)
			VALUES
				('OT-705', $1, 'cli-101', 'Inversiones Andinas S.A.S.', 'veh-201', 'KLP842', 'Toyota Hilux 2.8 4x4', 68400, 73400, 'tec-104', 'Ricardo Ospina', 'En Proceso', 'Mantenimiento preventivo 70.000 km, cambio de aceite sintético y filtros', 420000),
				('OT-704', $2, 'cli-102', 'Distribuidora del Valle Ltda.', 'veh-202', 'MTR519', 'Mazda CX-30 Grand Touring', 34200, 39200, 'tec-105', 'Julián Morales', 'Listo', 'Rectificación de discos delanteros, cambio de pastillas cerámicas y alineación', 310000)
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-45*time.Minute), now.Add(-2*time.Hour)); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.settlements (id, recorded_at, worker_id, worker_name, gross_labor, commission_pct, technician_payout, company_retention)
			VALUES ('LIQ-305', $1, 'tec-104', 'Ricardo Ospina', 350000, 40, 140000, 210000)
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-24*time.Hour)); err != nil {
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

func (r *Repository) GetState(ctx context.Context, dbName string) (domain.WorkshopState, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.WorkshopState{}, err
	}

	nextOrd, err := sequences.PeekSQL(ctx, pool, schemaName, "OT", baseOrderSeq)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	nextWk, err := sequences.PeekSQL(ctx, pool, schemaName, "TEC", baseWorkerSeq)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	nextVeh, err := sequences.PeekSQL(ctx, pool, schemaName, "VEH", baseVehicleSeq)
	if err != nil {
		return domain.WorkshopState{}, err
	}

	vRows, err := pool.Query(ctx, `
		SELECT id, plate, brand, vehicle_type, customer_id, customer_name, current_km, next_oil_km, soat_expiry
		FROM workshop.vehicles
		ORDER BY plate ASC
	`)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	defer vRows.Close()

	vehicles := []domain.Vehicle{}
	for vRows.Next() {
		var v domain.Vehicle
		if err := vRows.Scan(
			&v.ID, &v.Plate, &v.Brand, &v.VehicleType, &v.CustomerID, &v.CustomerName,
			&v.CurrentKm, &v.NextOilKm, &v.SoatExpiry,
		); err != nil {
			return domain.WorkshopState{}, err
		}
		v.NextOilChangeKm = v.NextOilKm
		vehicles = append(vehicles, v)
	}
	if err := vRows.Err(); err != nil {
		return domain.WorkshopState{}, err
	}

	wRows, err := pool.Query(ctx, `
		SELECT id, code, name, doc_number, specialty, commission_pct::float8, phone, total_day_gross::float8
		FROM workshop.workers
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	defer wRows.Close()

	workers := []domain.Worker{}
	for wRows.Next() {
		var wk domain.Worker
		if err := wRows.Scan(
			&wk.ID, &wk.Code, &wk.Name, &wk.DocNumber, &wk.Specialty, &wk.CommissionPct, &wk.Phone, &wk.TotalDayGross,
		); err != nil {
			return domain.WorkshopState{}, err
		}
		workers = append(workers, wk)
	}
	if err := wRows.Err(); err != nil {
		return domain.WorkshopState{}, err
	}

	oRows, err := pool.Query(ctx, `
		SELECT id, to_char(created_at, 'YYYY-MM-DD HH24:MI'), customer_id, customer_name,
		       vehicle_id, plate, vehicle_brand, current_km, next_oil_km,
		       worker_id, worker_name, status, service_desc, total_estimated::float8
		FROM workshop.work_orders
		ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	defer oRows.Close()

	orders := []domain.WorkOrder{}
	for oRows.Next() {
		var o domain.WorkOrder
		if err := oRows.Scan(
			&o.ID, &o.CreatedAt, &o.CustomerID, &o.CustomerName,
			&o.VehicleID, &o.Plate, &o.VehicleBrand, &o.CurrentKm, &o.NextOilKm,
			&o.WorkerID, &o.WorkerName, &o.Status, &o.ServiceDesc, &o.TotalEstimated,
		); err != nil {
			return domain.WorkshopState{}, err
		}
		orders = append(orders, o)
	}
	if err := oRows.Err(); err != nil {
		return domain.WorkshopState{}, err
	}

	sRows, err := pool.Query(ctx, `
		SELECT id, to_char(recorded_at, 'YYYY-MM-DD HH24:MI'), worker_id, worker_name,
		       gross_labor::float8, commission_pct::float8, technician_payout::float8, company_retention::float8
		FROM workshop.settlements
		ORDER BY recorded_at DESC, id DESC
	`)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	defer sRows.Close()

	settlements := []domain.Settlement{}
	for sRows.Next() {
		var s domain.Settlement
		if err := sRows.Scan(
			&s.ID, &s.Date, &s.WorkerID, &s.WorkerName,
			&s.GrossLabor, &s.CommissionPct, &s.TechnicianPayout, &s.CompanyRetention,
		); err != nil {
			return domain.WorkshopState{}, err
		}
		settlements = append(settlements, s)
	}
	if err := sRows.Err(); err != nil {
		return domain.WorkshopState{}, err
	}

	return domain.WorkshopState{
		NextOrderCode:   nextOrd,
		NextWorkerCode:  nextWk,
		NextVehicleCode: nextVeh,
		Orders:          orders,
		Workers:         workers,
		Settlements:     settlements,
		Vehicles:        vehicles,
	}, nil
}

func (r *Repository) CreateVehicle(ctx context.Context, dbName, idemKey string, in domain.CreateVehicleInput) (domain.Vehicle, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Vehicle{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Vehicle{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM workshop.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "veh:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Vehicle
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Vehicle{}, err
		}
	}

	normPlate := domain.NormalizePlate(in.Plate)
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workshop.vehicles WHERE plate = $1)`, normPlate).Scan(&exists); err != nil {
		return domain.Vehicle{}, err
	}
	if exists {
		return domain.Vehicle{}, apperr.Conflict("Ya existe un vehículo registrado con la placa " + normPlate)
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "VEH", baseVehicleSeq)
	if err != nil {
		return domain.Vehicle{}, err
	}
	veh, err := domain.BuildVehicle(code, in)
	if err != nil {
		return domain.Vehicle{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO workshop.vehicles (id, plate, brand, vehicle_type, customer_id, customer_name, current_km, next_oil_km, soat_expiry)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, veh.ID, veh.Plate, veh.Brand, veh.VehicleType, veh.CustomerID, veh.CustomerName, veh.CurrentKm, veh.NextOilKm, veh.SoatExpiry); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.Vehicle{}, apperr.Conflict("Ya existe un vehículo registrado con la placa " + veh.Plate)
		}
		return domain.Vehicle{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(veh)
		if err != nil {
			return domain.Vehicle{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "veh:"+cleanKey, raw); err != nil {
			return domain.Vehicle{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Vehicle{}, err
	}
	return veh, nil
}

func (r *Repository) DeleteVehicle(ctx context.Context, dbName, vehicleID string) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var hasOpen bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM workshop.work_orders WHERE vehicle_id = $1 AND status <> $2)
	`, vehicleID, domain.OrderStatusEntregado).Scan(&hasOpen); err != nil {
		return err
	}
	if hasOpen {
		return apperr.Conflict("No se puede eliminar un vehículo con órdenes de trabajo activas en el taller")
	}

	tag, err := tx.Exec(ctx, `DELETE FROM workshop.vehicles WHERE id = $1`, vehicleID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Vehículo no encontrado")
	}
	return tx.Commit(ctx)
}

func (r *Repository) CreateWorkOrder(ctx context.Context, dbName, idemKey string, in domain.CreateWorkOrderInput) (domain.WorkOrder, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.WorkOrder{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.WorkOrder{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM workshop.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "ord:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.WorkOrder
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.WorkOrder{}, err
		}
	}

	var veh domain.Vehicle
	err = tx.QueryRow(ctx, `
		SELECT id, plate, brand, vehicle_type, customer_id, customer_name, current_km, next_oil_km, soat_expiry
		FROM workshop.vehicles
		WHERE id = $1 OR plate = upper($1)
		FOR UPDATE
	`, in.VehicleID).Scan(
		&veh.ID, &veh.Plate, &veh.Brand, &veh.VehicleType, &veh.CustomerID, &veh.CustomerName,
		&veh.CurrentKm, &veh.NextOilKm, &veh.SoatExpiry,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.WorkOrder{}, apperr.NotFound("Vehículo no encontrado")
	}
	if err != nil {
		return domain.WorkOrder{}, err
	}

	var workerName string
	if strings.TrimSpace(in.WorkerID) != "" {
		var resolvedID string
		err := tx.QueryRow(ctx, `
			SELECT id, name FROM workshop.workers WHERE id = $1 OR lower(code) = lower($1)
		`, in.WorkerID).Scan(&resolvedID, &workerName)
		if err == nil {
			in.WorkerID = resolvedID
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.WorkOrder{}, err
		}
	}

	now := time.Now()
	code, err := sequences.NextSQL(ctx, tx, schemaName, "OT", baseOrderSeq)
	if err != nil {
		return domain.WorkOrder{}, err
	}
	order, err := domain.BuildWorkOrder(code, in, &veh, workerName, now)
	if err != nil {
		return domain.WorkOrder{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE workshop.vehicles
		SET current_km = $1, next_oil_km = $2
		WHERE id = $3
	`, veh.CurrentKm, veh.NextOilKm, veh.ID); err != nil {
		return domain.WorkOrder{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO workshop.work_orders (
			id, created_at, customer_id, customer_name, vehicle_id, plate, vehicle_brand,
			current_km, next_oil_km, worker_id, worker_name, status, service_desc, total_estimated
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`, order.ID, now, order.CustomerID, order.CustomerName, order.VehicleID, order.Plate, order.VehicleBrand,
		order.CurrentKm, order.NextOilKm, order.WorkerID, order.WorkerName, order.Status, order.ServiceDesc, order.TotalEstimated,
	); err != nil {
		return domain.WorkOrder{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(order)
		if err != nil {
			return domain.WorkOrder{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "ord:"+cleanKey, raw); err != nil {
			return domain.WorkOrder{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.WorkOrder{}, err
	}
	return order, nil
}

func (r *Repository) AdvanceWorkOrderStage(ctx context.Context, dbName, orderID, requestedStatus string) (domain.WorkOrder, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.WorkOrder{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.WorkOrder{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var o domain.WorkOrder
	err = tx.QueryRow(ctx, `
		SELECT id, to_char(created_at, 'YYYY-MM-DD HH24:MI'), customer_id, customer_name,
		       vehicle_id, plate, vehicle_brand, current_km, next_oil_km,
		       worker_id, worker_name, status, service_desc, total_estimated::float8
		FROM workshop.work_orders
		WHERE id = $1
		FOR UPDATE
	`, orderID).Scan(
		&o.ID, &o.CreatedAt, &o.CustomerID, &o.CustomerName,
		&o.VehicleID, &o.Plate, &o.VehicleBrand, &o.CurrentKm, &o.NextOilKm,
		&o.WorkerID, &o.WorkerName, &o.Status, &o.ServiceDesc, &o.TotalEstimated,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.WorkOrder{}, apperr.NotFound("Orden de trabajo no encontrada")
	}
	if err != nil {
		return domain.WorkOrder{}, err
	}

	if err := o.AdvanceStage(requestedStatus); err != nil {
		return domain.WorkOrder{}, err
	}

	if _, err := tx.Exec(ctx, `UPDATE workshop.work_orders SET status = $1 WHERE id = $2`, o.Status, o.ID); err != nil {
		return domain.WorkOrder{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.WorkOrder{}, err
	}
	return o, nil
}

func (r *Repository) CreateWorker(ctx context.Context, dbName, idemKey string, in domain.CreateWorkerInput) (domain.Worker, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Worker{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Worker{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM workshop.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "tec:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Worker
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Worker{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "TEC", baseWorkerSeq)
	if err != nil {
		return domain.Worker{}, err
	}
	wk, err := domain.BuildWorker(code, in)
	if err != nil {
		return domain.Worker{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO workshop.workers (id, code, name, doc_number, specialty, commission_pct, phone, total_day_gross)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
	`, wk.ID, wk.Code, wk.Name, wk.DocNumber, wk.Specialty, wk.CommissionPct, wk.Phone); err != nil {
		return domain.Worker{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(wk)
		if err != nil {
			return domain.Worker{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "tec:"+cleanKey, raw); err != nil {
			return domain.Worker{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Worker{}, err
	}
	return wk, nil
}

func (r *Repository) SettleWorker(ctx context.Context, dbName, idemKey, workerID string) (domain.Settlement, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Settlement{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Settlement{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM workshop.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "liq:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Settlement
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Settlement{}, err
		}
	}

	var wk domain.Worker
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, doc_number, specialty, commission_pct::float8, phone, total_day_gross::float8
		FROM workshop.workers
		WHERE id = $1 OR lower(code) = lower($1)
		FOR UPDATE
	`, workerID).Scan(&wk.ID, &wk.Code, &wk.Name, &wk.DocNumber, &wk.Specialty, &wk.CommissionPct, &wk.Phone, &wk.TotalDayGross)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Settlement{}, apperr.NotFound("Técnico especialista no encontrado")
	}
	if err != nil {
		return domain.Settlement{}, err
	}

	now := time.Now()
	liqCode, err := sequences.NextSQL(ctx, tx, schemaName, "LIQ", baseSettlementSeq)
	if err != nil {
		return domain.Settlement{}, err
	}
	settlement, err := wk.Settle(liqCode, now)
	if err != nil {
		return domain.Settlement{}, err
	}

	if _, err := tx.Exec(ctx, `UPDATE workshop.workers SET total_day_gross = 0 WHERE id = $1`, wk.ID); err != nil {
		return domain.Settlement{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO workshop.settlements (
			id, recorded_at, worker_id, worker_name, gross_labor, commission_pct, technician_payout, company_retention
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, settlement.ID, now, settlement.WorkerID, settlement.WorkerName, settlement.GrossLabor, settlement.CommissionPct, settlement.TechnicianPayout, settlement.CompanyRetention); err != nil {
		return domain.Settlement{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(settlement)
		if err != nil {
			return domain.Settlement{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "liq:"+cleanKey, raw); err != nil {
			return domain.Settlement{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Settlement{}, err
	}
	return settlement, nil
}

func (r *Repository) RegisterInvoicedOrderAndCommission(ctx context.Context, dbName string, in domain.InvoiceSyncInput) (domain.InvoiceSyncResult, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.InvoiceSyncResult{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.InvoiceSyncResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(in.IdempotencyKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM workshop.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "inv:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.InvoiceSyncResult
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.InvoiceSyncResult{}, err
		}
	}

	res := domain.InvoiceSyncResult{Ok: true}
	orderID := strings.TrimSpace(in.WorkOrderID)
	vehID := strings.TrimSpace(in.VehicleID)
	mechID := strings.TrimSpace(in.MechanicID)

	if orderID != "" {
		var ordVehID, ordWorkerID string
		err := tx.QueryRow(ctx, `
			SELECT vehicle_id, plate, vehicle_brand, current_km, next_oil_km, worker_id
			FROM workshop.work_orders
			WHERE id = $1
			FOR UPDATE
		`, orderID).Scan(&ordVehID, &res.Plate, &res.VehicleBrand, &res.CurrentKm, &res.NextOilKm, &ordWorkerID)
		if err == nil {
			if _, err := tx.Exec(ctx, `UPDATE workshop.work_orders SET status = $1 WHERE id = $2`, domain.OrderStatusEntregado, orderID); err != nil {
				return domain.InvoiceSyncResult{}, err
			}
			if vehID == "" {
				vehID = ordVehID
			}
			if mechID == "" {
				mechID = ordWorkerID
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.InvoiceSyncResult{}, err
		}
	}

	if res.Plate == "" && vehID != "" {
		err := tx.QueryRow(ctx, `
			SELECT plate, brand, current_km, next_oil_km
			FROM workshop.vehicles
			WHERE id = $1 OR plate = upper($1)
		`, vehID).Scan(&res.Plate, &res.VehicleBrand, &res.CurrentKm, &res.NextOilKm)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return domain.InvoiceSyncResult{}, err
		}
	}

	if mechID != "" {
		var matchedID string
		var curGross float64
		err := tx.QueryRow(ctx, `
			SELECT id, name, total_day_gross::float8
			FROM workshop.workers
			WHERE id = $1 OR lower(code) = lower($1)
			FOR UPDATE
		`, mechID).Scan(&matchedID, &res.MechanicName, &curGross)
		if err == nil {
			if money.IsFinite(in.LaborGross) && in.LaborGross > 0 {
				newGross := money.RoundCents(curGross + in.LaborGross)
				if _, err := tx.Exec(ctx, `UPDATE workshop.workers SET total_day_gross = $1 WHERE id = $2`, newGross, matchedID); err != nil {
					return domain.InvoiceSyncResult{}, err
				}
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.InvoiceSyncResult{}, err
		}
	}

	if cleanKey != "" {
		raw, err := json.Marshal(res)
		if err != nil {
			return domain.InvoiceSyncResult{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO workshop.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "inv:"+cleanKey, raw); err != nil {
			return domain.InvoiceSyncResult{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.InvoiceSyncResult{}, err
	}
	return res, nil
}
