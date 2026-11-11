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
	"ms-agenda/internal/platform/apperr"
	"ms-agenda/internal/platform/dbpool"
	"ms-agenda/internal/platform/money"
	"ms-agenda/internal/platform/sequences"
	"ms-agenda/internal/domain"
	"ms-agenda/migrations"
)

const seedMarkerPrefix = "__SEEDED__"

type Repository struct {
	dbMgr  *dbpool.Manager
	mu     sync.RWMutex
	seeded map[string]bool
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func (r *Repository) pool(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-agenda", migrations.SchemaSQL)
	if err != nil {
		return nil, err
	}
	if err := r.ensureSeeded(ctx, p, dbName); err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repository) ensureSeeded(ctx context.Context, p *pgxpool.Pool, dbName string) error {
	r.mu.RLock()
	done := r.seeded[dbName]
	r.mu.RUnlock()
	if done {
		return nil
	}

	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-agenda::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM scheduling.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		r.mu.Lock()
		r.seeded[dbName] = true
		r.mu.Unlock()
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	slot := time.Now().UTC().Add(2 * time.Hour).Format("2006-01-02") + " 10:00"

	resCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	if err != nil {
		return err
	}
	resCode2, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	if err != nil {
		return err
	}
	aptCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scheduling.resources (id, code, name, specialty, phone, active, created_at)
		VALUES
			('res-demo-1', $1, 'Dra. Camila Restrepo', 'Consultoría Especializada', '3158402210', TRUE, $3),
			('res-demo-2', $2, 'Ing. Sebastián Morales', 'Diagnóstico Técnico', '3106904415', TRUE, $3)
		ON CONFLICT DO NOTHING
	`, resCode1, resCode2, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scheduling.appointments (
			id, code, resource_id, resource_name, resource_specialty,
			customer_id, customer_name, customer_nit, customer_phone,
			date_time, service_name, notes, status, created_at
		) VALUES (
			$1, $1, 'res-demo-1', 'Dra. Camila Restrepo', 'Consultoría Especializada',
			'cli-demo-1', 'Inversiones del Norte S.A.S.', '900.312.880-2', '6014402290',
			$2, 'Valoración inicial y plan de atención', 'Confirmada vía telefónica', $3, $4
		) ON CONFLICT DO NOTHING
	`, aptCode1, slot, domain.DefaultAppointStatus, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scheduling.seq_counters (prefix, current_val) VALUES ($1, 1)
		ON CONFLICT (prefix) DO NOTHING
	`, seedMarkerPrefix); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	r.seeded[dbName] = true
	r.mu.Unlock()
	return nil
}

func (r *Repository) GetAll(ctx context.Context, dbName string) (*domain.AllState, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}

	nextApt, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart)
	if err != nil {
		return nil, err
	}
	nextRes, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	if err != nil {
		return nil, err
	}

	rRows, err := p.Query(ctx, `
		SELECT id, code, name, specialty, phone, active, created_at
		FROM scheduling.resources
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rRows.Close()

	resources := []*domain.ProfResource{}
	for rRows.Next() {
		var item domain.ProfResource
		if err := rRows.Scan(&item.ID, &item.Code, &item.Name, &item.Specialty, &item.Phone, &item.Active, &item.CreatedAt); err != nil {
			return nil, err
		}
		resources = append(resources, &item)
	}
	if err := rRows.Err(); err != nil {
		return nil, err
	}

	aRows, err := p.Query(ctx, `
		SELECT id, code, resource_id, resource_name, resource_specialty,
		       customer_id, customer_name, customer_nit, customer_phone,
		       date_time, service_name, notes, status, created_at
		FROM scheduling.appointments
		ORDER BY date_time ASC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer aRows.Close()

	appointments := []*domain.Appointment{}
	for aRows.Next() {
		var item domain.Appointment
		if err := aRows.Scan(
			&item.ID, &item.Code, &item.ResourceID, &item.ResourceName, &item.ResourceSpecialty,
			&item.CustomerID, &item.CustomerName, &item.CustomerNit, &item.CustomerPhone,
			&item.DateTime, &item.ServiceName, &item.Notes, &item.Status, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		appointments = append(appointments, &item)
	}
	if err := aRows.Err(); err != nil {
		return nil, err
	}

	return &domain.AllState{
		NextCode:         nextApt,
		NextResourceCode: nextRes,
		Resources:        resources,
		Appointments:     appointments,
	}, nil
}

func (r *Repository) CreateResource(ctx context.Context, dbName, idemKey string, in domain.CreateResourceInput) (*domain.ProfResource, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if idemKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `
			SELECT response_json FROM scheduling.idempotency_keys
			WHERE scope = 'resource' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.ProfResource
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	res, err := domain.NewProfResource(money.NewID("res"), code, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scheduling.resources (id, code, name, specialty, phone, active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, res.ID, res.Code, res.Name, res.Specialty, res.Phone, res.Active, res.CreatedAt); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(res)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scheduling.idempotency_keys (scope, idem_key, response_json)
			VALUES ('resource', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return res, nil
}

func (r *Repository) CreateAppointment(ctx context.Context, dbName, idemKey string, in domain.CreateAppointmentInput) (*domain.Appointment, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if idemKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `
			SELECT response_json FROM scheduling.idempotency_keys
			WHERE scope = 'appointment' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.Appointment
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	resID := in.ResolvedResourceID()
	var res domain.ProfResource
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, specialty, phone, active, created_at
		FROM scheduling.resources
		WHERE id = $1
		FOR UPDATE
	`, resID).Scan(&res.ID, &res.Code, &res.Name, &res.Specialty, &res.Phone, &res.Active, &res.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Profesional o recurso de agenda no encontrado")
	}
	if err != nil {
		return nil, err
	}

	normDT, err := domain.NormalizeDateTime(in.DateTime)
	if err != nil {
		return nil, err
	}

	var slotBusy bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM scheduling.appointments WHERE resource_id = $1 AND date_time = $2)
	`, res.ID, normDT).Scan(&slotBusy); err != nil {
		return nil, err
	}
	if slotBusy {
		return nil, apperr.Conflict("El profesional o recurso seleccionado ya tiene una cita asignada en esa fecha y hora")
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	apt, err := domain.NewAppointment(code, &res, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO scheduling.appointments (
			id, code, resource_id, resource_name, resource_specialty,
			customer_id, customer_name, customer_nit, customer_phone,
			date_time, service_name, notes, status, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		apt.ID, apt.Code, apt.ResourceID, apt.ResourceName, apt.ResourceSpecialty,
		apt.CustomerID, apt.CustomerName, apt.CustomerNit, apt.CustomerPhone,
		apt.DateTime, apt.ServiceName, apt.Notes, apt.Status, apt.CreatedAt,
	); err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("El profesional o recurso seleccionado ya tiene una cita asignada en esa fecha y hora")
		}
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(apt)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO scheduling.idempotency_keys (scope, idem_key, response_json)
			VALUES ('appointment', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return apt, nil
}

func (r *Repository) DeleteAppointment(ctx context.Context, dbName, appointmentID string) error {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `DELETE FROM scheduling.appointments WHERE id = $1`, appointmentID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Cita no encontrada")
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}
