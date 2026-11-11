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
	"ms-nomina/internal/platform/apperr"
	"ms-nomina/internal/platform/dbpool"
	"ms-nomina/internal/platform/money"
	"ms-nomina/internal/platform/sequences"
	"ms-nomina/internal/domain"
	"ms-nomina/migrations"
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
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-nomina", migrations.SchemaSQL)
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

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-nomina::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM payroll.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
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
	ym := time.Now().UTC().Format("2006-01")

	empCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	if err != nil {
		return err
	}
	empCode2, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	if err != nil {
		return err
	}
	nomCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.PayrollSeqPrefix, domain.PayrollSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO payroll.employees (id, code, name, doc_number, position, base_salary, phone, active, created_at)
		VALUES
			('emp-demo-1', $1, 'Laura Marcela Gómez', '1032488910', 'Coordinadora Administrativa', 2450000, '3157204419', TRUE, $3),
			('emp-demo-2', $2, 'Carlos Andrés Medina', '1019044812', 'Líder de Operaciones y Logística', 1950000, '3114908821', TRUE, $3)
		ON CONFLICT DO NOTHING
	`, empCode1, empCode2, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO payroll.settlements (
			id, code, employee_id, employee_code, employee_name, employee_doc, employee_position,
			period, base_salary, bonuses, deductions, net_pay, created_at
		) VALUES (
			$1, $1, 'emp-demo-1', $2, 'Laura Marcela Gómez', '1032488910', 'Coordinadora Administrativa',
			$3, 1225000, 95000, 98000, 1222000, $4
		) ON CONFLICT DO NOTHING
	`, nomCode1, empCode1, ym+" — Q1 (1 al 15)", now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO payroll.seq_counters (prefix, current_val) VALUES ($1, 1)
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

	nextNom, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.PayrollSeqPrefix, domain.PayrollSeqStart)
	if err != nil {
		return nil, err
	}
	nextEmp, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	if err != nil {
		return nil, err
	}

	eRows, err := p.Query(ctx, `
		SELECT id, code, name, doc_number, position, base_salary::float8, phone, active, created_at
		FROM payroll.employees
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer eRows.Close()

	employees := []*domain.Employee{}
	for eRows.Next() {
		var item domain.Employee
		if err := eRows.Scan(
			&item.ID, &item.Code, &item.Name, &item.DocNumber, &item.Position,
			&item.BaseSalary, &item.Phone, &item.Active, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		employees = append(employees, &item)
	}
	if err := eRows.Err(); err != nil {
		return nil, err
	}

	pRows, err := p.Query(ctx, `
		SELECT id, code, employee_id, employee_code, employee_name, employee_doc, employee_position,
		       period, base_salary::float8, bonuses::float8, deductions::float8, net_pay::float8, created_at
		FROM payroll.settlements
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer pRows.Close()

	payrolls := []*domain.PayrollSettlement{}
	for pRows.Next() {
		var item domain.PayrollSettlement
		if err := pRows.Scan(
			&item.ID, &item.Code, &item.EmployeeID, &item.EmployeeCode, &item.EmployeeName,
			&item.EmployeeDoc, &item.EmployeePosition, &item.Period,
			&item.BaseSalary, &item.Bonuses, &item.Deductions, &item.NetPay, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		payrolls = append(payrolls, &item)
	}
	if err := pRows.Err(); err != nil {
		return nil, err
	}

	return &domain.AllState{
		NextCode:         nextNom,
		NextEmployeeCode: nextEmp,
		Employees:        employees,
		Payrolls:         payrolls,
	}, nil
}

func (r *Repository) CreateEmployee(ctx context.Context, dbName, idemKey string, in domain.CreateEmployeeInput) (*domain.Employee, error) {
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
			SELECT response_json FROM payroll.idempotency_keys
			WHERE scope = 'employee' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.Employee
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewEmployee("tmp", "TMP", in, now); err != nil {
		return nil, err
	}

	docNorm := strings.TrimSpace(in.DocNumber)
	var docExists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM payroll.employees WHERE LOWER(doc_number) = LOWER($1))
	`, docNorm).Scan(&docExists); err != nil {
		return nil, err
	}
	if docExists {
		return nil, apperr.Conflict("Ya existe un colaborador registrado con ese número de documento")
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	if err != nil {
		return nil, err
	}
	emp, err := domain.NewEmployee(money.NewID("emp"), code, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO payroll.employees (id, code, name, doc_number, position, base_salary, phone, active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, emp.ID, emp.Code, emp.Name, emp.DocNumber, emp.Position, emp.BaseSalary, emp.Phone, emp.Active, emp.CreatedAt); err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("Ya existe un colaborador registrado con ese número de documento")
		}
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(emp)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO payroll.idempotency_keys (scope, idem_key, response_json)
			VALUES ('employee', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return emp, nil
}

func (r *Repository) CreatePayroll(ctx context.Context, dbName, idemKey string, in domain.CreatePayrollInput) (*domain.PayrollSettlement, error) {
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
			SELECT response_json FROM payroll.idempotency_keys
			WHERE scope = 'payroll' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.PayrollSettlement
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	empID := in.ResolvedEmployeeID()
	var emp domain.Employee
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, doc_number, position, base_salary::float8, phone, active, created_at
		FROM payroll.employees
		WHERE id = $1 OR code = $1
		FOR UPDATE
	`, empID).Scan(
		&emp.ID, &emp.Code, &emp.Name, &emp.DocNumber, &emp.Position,
		&emp.BaseSalary, &emp.Phone, &emp.Active, &emp.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Colaborador no encontrado en nómina")
	}
	if err != nil {
		return nil, err
	}

	periodNorm := strings.TrimSpace(in.Period)
	var alreadySettled bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM payroll.settlements
			WHERE employee_id = $1 AND LOWER(period) = LOWER($2)
		)
	`, emp.ID, periodNorm).Scan(&alreadySettled); err != nil {
		return nil, err
	}
	if alreadySettled {
		return nil, apperr.Conflict("El colaborador ya fue liquidado en el periodo seleccionado")
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewPayrollSettlement("TMP", &emp, in, now); err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.PayrollSeqPrefix, domain.PayrollSeqStart)
	if err != nil {
		return nil, err
	}
	settlement, err := domain.NewPayrollSettlement(code, &emp, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO payroll.settlements (
			id, code, employee_id, employee_code, employee_name, employee_doc, employee_position,
			period, base_salary, bonuses, deductions, net_pay, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		settlement.ID, settlement.Code, settlement.EmployeeID, settlement.EmployeeCode,
		settlement.EmployeeName, settlement.EmployeeDoc, settlement.EmployeePosition,
		settlement.Period, settlement.BaseSalary, settlement.Bonuses,
		settlement.Deductions, settlement.NetPay, settlement.CreatedAt,
	); err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("El colaborador ya fue liquidado en el periodo seleccionado")
		}
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(settlement)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO payroll.idempotency_keys (scope, idem_key, response_json)
			VALUES ('payroll', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return settlement, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}
