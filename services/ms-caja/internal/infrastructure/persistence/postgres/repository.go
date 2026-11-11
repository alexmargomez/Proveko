package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-caja/internal/platform/apperr"
	"ms-caja/internal/platform/dbpool"
	"ms-caja/internal/platform/sequences"
	"ms-caja/internal/domain"
	"ms-caja/migrations"
)

const (
	schemaName     = "treasury"
	serviceKey     = "ms-caja"
	baseIncomeSeq  = 302
	baseExpenseSeq = 507
	baseBankSeq    = 207
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
		SELECT EXISTS(SELECT 1 FROM treasury.cash_incomes)
		    OR EXISTS(SELECT 1 FROM treasury.expenses)
		    OR EXISTS(SELECT 1 FROM treasury.bank_movements)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		now := time.Now()
		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.cash_incomes (id, recorded_at, category, description, amount, payment_method, responsible)
			VALUES
				('ING-301', $1, 'Base / Apertura de Caja', 'Base inicial de efectivo para turno de apertura', 350000, 'Efectivo', 'Caja Principal'),
				('ING-302', $2, 'Recaudo Cartera', 'Abono convenio empresarial transferencia verificada', 240000, 'Transferencia Bancaria', 'Tesorería General')
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-2*time.Hour), now.Add(-1*time.Hour)); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.expenses (id, recorded_at, category, description, amount, payment_source, responsible)
			VALUES
				('EGR-506', $1, 'Insumos Operativos', 'Compra rollos térmicos 80mm y elementos de cafetería', 46500, 'Efectivo Caja', 'Caja Principal'),
				('EGR-507', $2, 'Transporte y Mensajería', 'Envío urgente de documentos y repuestos urbanos', 28000, 'Efectivo Caja', 'Caja Principal')
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-90*time.Minute), now.Add(-30*time.Minute)); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.bank_movements (id, recorded_at, account_name, movement_type, reference, concept, amount, actor)
			VALUES
				('BCO-206', $1, 'Bancolombia — Cuenta Empresarial', 'Egreso', 'ACH-551902', 'Pago anticipo proveedor nacional de suministros', 120000, 'Tesorería General'),
				('BCO-207', $2, 'Nequi Negocios', 'Ingreso', 'QR-884920', 'Liquidación ventas QR mostrador mañana', 185000, 'Caja Principal')
			ON CONFLICT (id) DO NOTHING
		`, now.Add(-80*time.Minute), now.Add(-20*time.Minute)); err != nil {
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

func (r *Repository) GetSnapshot(ctx context.Context, dbName string) (domain.TreasurySnapshot, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}

	nextInc, err := sequences.PeekSQL(ctx, pool, schemaName, "ING", baseIncomeSeq)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}
	nextExp, err := sequences.PeekSQL(ctx, pool, schemaName, "EGR", baseExpenseSeq)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}
	nextBco, err := sequences.PeekSQL(ctx, pool, schemaName, "BCO", baseBankSeq)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}

	incRows, err := pool.Query(ctx, `
		SELECT id, to_char(recorded_at, 'YYYY-MM-DD HH24:MI'), category, description, amount::float8, payment_method, responsible
		FROM treasury.cash_incomes
		ORDER BY recorded_at DESC, id DESC
	`)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}
	defer incRows.Close()

	incomes := []domain.CashIncome{}
	for incRows.Next() {
		var it domain.CashIncome
		if err := incRows.Scan(&it.ID, &it.Date, &it.Category, &it.Description, &it.Amount, &it.PaymentMethod, &it.Responsible); err != nil {
			return domain.TreasurySnapshot{}, err
		}
		incomes = append(incomes, it)
	}
	if err := incRows.Err(); err != nil {
		return domain.TreasurySnapshot{}, err
	}

	expRows, err := pool.Query(ctx, `
		SELECT id, to_char(recorded_at, 'YYYY-MM-DD HH24:MI'), category, description, amount::float8, payment_source, responsible
		FROM treasury.expenses
		ORDER BY recorded_at DESC, id DESC
	`)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}
	defer expRows.Close()

	expenses := []domain.Expense{}
	for expRows.Next() {
		var exp domain.Expense
		if err := expRows.Scan(&exp.ID, &exp.Date, &exp.Category, &exp.Description, &exp.Amount, &exp.PaymentSource, &exp.Responsible); err != nil {
			return domain.TreasurySnapshot{}, err
		}
		expenses = append(expenses, exp)
	}
	if err := expRows.Err(); err != nil {
		return domain.TreasurySnapshot{}, err
	}

	bcoRows, err := pool.Query(ctx, `
		SELECT id, to_char(recorded_at, 'YYYY-MM-DD HH24:MI'), account_name, movement_type, reference, concept, amount::float8, actor
		FROM treasury.bank_movements
		ORDER BY recorded_at DESC, id DESC
	`)
	if err != nil {
		return domain.TreasurySnapshot{}, err
	}
	defer bcoRows.Close()

	movements := []domain.BankMovement{}
	for bcoRows.Next() {
		var bm domain.BankMovement
		if err := bcoRows.Scan(&bm.ID, &bm.Date, &bm.AccountName, &bm.MovementType, &bm.Reference, &bm.Concept, &bm.Amount, &bm.Actor); err != nil {
			return domain.TreasurySnapshot{}, err
		}
		movements = append(movements, bm)
	}
	if err := bcoRows.Err(); err != nil {
		return domain.TreasurySnapshot{}, err
	}

	return domain.TreasurySnapshot{
		NextIncomeCode:  nextInc,
		NextExpenseCode: nextExp,
		NextBankCode:    nextBco,
		Incomes:         incomes,
		Expenses:        expenses,
		BankMovements:   movements,
	}, nil
}

func (r *Repository) CreateIncome(ctx context.Context, dbName, idemKey string, in domain.CreateIncomeInput, actor string) (domain.CashIncome, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.CashIncome{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.CashIncome{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM treasury.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "inc:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.CashIncome
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.CashIncome{}, err
		}
	}

	now := time.Now()
	code, err := sequences.NextSQL(ctx, tx, schemaName, "ING", baseIncomeSeq)
	if err != nil {
		return domain.CashIncome{}, err
	}
	inc, err := domain.BuildCashIncome(code, in, actor, now)
	if err != nil {
		return domain.CashIncome{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO treasury.cash_incomes (id, recorded_at, category, description, amount, payment_method, responsible)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, inc.ID, now, inc.Category, inc.Description, inc.Amount, inc.PaymentMethod, inc.Responsible); err != nil {
		return domain.CashIncome{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(inc)
		if err != nil {
			return domain.CashIncome{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "inc:"+cleanKey, raw); err != nil {
			return domain.CashIncome{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CashIncome{}, err
	}
	return inc, nil
}

func (r *Repository) CreateExpense(ctx context.Context, dbName, idemKey string, in domain.CreateExpenseInput, actor string) (domain.Expense, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.Expense{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Expense{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM treasury.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "exp:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.Expense
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.Expense{}, err
		}
	}

	now := time.Now()
	code, err := sequences.NextSQL(ctx, tx, schemaName, "EGR", baseExpenseSeq)
	if err != nil {
		return domain.Expense{}, err
	}
	exp, err := domain.BuildExpense(code, in, actor, now)
	if err != nil {
		return domain.Expense{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO treasury.expenses (id, recorded_at, category, description, amount, payment_source, responsible)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, exp.ID, now, exp.Category, exp.Description, exp.Amount, exp.PaymentSource, exp.Responsible); err != nil {
		return domain.Expense{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(exp)
		if err != nil {
			return domain.Expense{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "exp:"+cleanKey, raw); err != nil {
			return domain.Expense{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Expense{}, err
	}
	return exp, nil
}

func (r *Repository) DeleteExpense(ctx context.Context, dbName, expenseID string) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}

	tag, err := pool.Exec(ctx, `DELETE FROM treasury.expenses WHERE id = $1`, expenseID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Comprobante de gasto no encontrado")
	}
	return nil
}

func (r *Repository) CreateBankMovement(ctx context.Context, dbName, idemKey string, in domain.CreateBankMovementInput, actor string) (domain.BankMovement, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.BankMovement{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.BankMovement{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM treasury.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "bco:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.BankMovement
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.BankMovement{}, err
		}
	}

	now := time.Now()
	code, err := sequences.NextSQL(ctx, tx, schemaName, "BCO", baseBankSeq)
	if err != nil {
		return domain.BankMovement{}, err
	}
	mov, err := domain.BuildBankMovement(code, in, actor, now)
	if err != nil {
		return domain.BankMovement{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO treasury.bank_movements (id, recorded_at, account_name, movement_type, reference, concept, amount, actor)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, mov.ID, now, mov.AccountName, mov.MovementType, mov.Reference, mov.Concept, mov.Amount, mov.Actor); err != nil {
		return domain.BankMovement{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(mov)
		if err != nil {
			return domain.BankMovement{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO treasury.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "bco:"+cleanKey, raw); err != nil {
			return domain.BankMovement{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.BankMovement{}, err
	}
	return mov, nil
}
