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
	"ms-contabilidad/internal/platform/apperr"
	"ms-contabilidad/internal/platform/dbpool"
	"ms-contabilidad/internal/platform/money"
	"ms-contabilidad/internal/platform/sequences"
	"ms-contabilidad/internal/domain"
	"ms-contabilidad/migrations"
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
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-contabilidad", migrations.SchemaSQL)
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

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-contabilidad::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM accounting.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
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
	cmpCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO accounting.puc_accounts (id, code, name, category, created_at)
		VALUES
			('puc-110505', '110505', 'Caja General', 'Activo', $1),
			('puc-111005', '111005', 'Bancos Moneda Nacional', 'Activo', $1),
			('puc-130505', '130505', 'Clientes Nacionales', 'Activo', $1),
			('puc-220505', '220505', 'Proveedores Nacionales', 'Pasivo', $1),
			('puc-413505', '413505', 'Ingresos Operacionales Comercio', 'Ingreso', $1),
			('puc-513530', '513530', 'Servicios Públicos y Operación', 'Gasto', $1)
		ON CONFLICT DO NOTHING
	`, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO accounting.vouchers (
			id, code, debit_account_id, debit_account_code, debit_account_name,
			credit_account_id, credit_account_code, credit_account_name,
			third_party_id, third_party_name, third_party_nit, concept, amount, created_at
		) VALUES (
			$1, $1, 'puc-111005', '111005', 'Bancos Moneda Nacional',
			'puc-413505', '413505', 'Ingresos Operacionales Comercio',
			'cli-demo-1', 'Inversiones del Norte S.A.S.', '900.312.880-2',
			'Consignación recaudo operacional del día', 1850000, $2
		) ON CONFLICT DO NOTHING
	`, cmpCode1, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO accounting.seq_counters (prefix, current_val) VALUES ($1, 1)
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

	nextVoucher, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)
	if err != nil {
		return nil, err
	}

	aRows, err := p.Query(ctx, `
		SELECT id, code, name, category, created_at
		FROM accounting.puc_accounts
		ORDER BY code ASC
	`)
	if err != nil {
		return nil, err
	}
	defer aRows.Close()

	accounts := []*domain.PucAccount{}
	for aRows.Next() {
		var item domain.PucAccount
		if err := aRows.Scan(&item.ID, &item.Code, &item.Name, &item.Category, &item.CreatedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, &item)
	}
	if err := aRows.Err(); err != nil {
		return nil, err
	}

	vRows, err := p.Query(ctx, `
		SELECT id, code, debit_account_id, debit_account_code, debit_account_name,
		       credit_account_id, credit_account_code, credit_account_name,
		       third_party_id, third_party_name, third_party_nit, concept, amount::float8, created_at
		FROM accounting.vouchers
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer vRows.Close()

	vouchers := []*domain.AccountingVoucher{}
	for vRows.Next() {
		var item domain.AccountingVoucher
		if err := vRows.Scan(
			&item.ID, &item.Code, &item.DebitAccountID, &item.DebitAccountCode, &item.DebitAccountName,
			&item.CreditAccountID, &item.CreditAccountCode, &item.CreditAccountName,
			&item.ThirdPartyID, &item.ThirdPartyName, &item.ThirdPartyNit,
			&item.Concept, &item.Amount, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		vouchers = append(vouchers, &item)
	}
	if err := vRows.Err(); err != nil {
		return nil, err
	}

	return &domain.AllState{
		NextCode:        nextVoucher,
		NextVoucherCode: nextVoucher,
		PucAccounts:     accounts,
		Vouchers:        vouchers,
		Balances:        domain.ComputeAccountBalances(accounts, vouchers),
	}, nil
}

func (r *Repository) CreatePucAccount(ctx context.Context, dbName, idemKey string, in domain.CreatePucAccountInput) (*domain.PucAccount, error) {
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
			SELECT response_json FROM accounting.idempotency_keys
			WHERE scope = 'puc' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.PucAccount
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	acc, err := domain.NewPucAccount(money.NewID("puc"), in, now)
	if err != nil {
		return nil, err
	}

	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM accounting.puc_accounts WHERE code = $1)
	`, acc.Code).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, apperr.Conflict("La subcuenta PUC " + acc.Code + " ya se encuentra registrada en el catálogo")
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO accounting.puc_accounts (id, code, name, category, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, acc.ID, acc.Code, acc.Name, acc.Category, acc.CreatedAt); err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("La subcuenta PUC " + acc.Code + " ya se encuentra registrada en el catálogo")
		}
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(acc)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO accounting.idempotency_keys (scope, idem_key, response_json)
			VALUES ('puc', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return acc, nil
}

func (r *Repository) CreateVoucher(ctx context.Context, dbName, idemKey string, in domain.CreateVoucherInput) (*domain.AccountingVoucher, error) {
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
			SELECT response_json FROM accounting.idempotency_keys
			WHERE scope = 'voucher' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.AccountingVoucher
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	if err := domain.ValidateVoucherBasics(in); err != nil {
		return nil, err
	}

	debitRef := strings.TrimSpace(in.DebitAccountID)
	creditRef := strings.TrimSpace(in.CreditAccountID)

	var debitAcc domain.PucAccount
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, category, created_at
		FROM accounting.puc_accounts
		WHERE id = $1 OR code = $1
	`, debitRef).Scan(&debitAcc.ID, &debitAcc.Code, &debitAcc.Name, &debitAcc.Category, &debitAcc.CreatedAt)
	var debitPtr *domain.PucAccount
	if err == nil {
		debitPtr = &debitAcc
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	var creditAcc domain.PucAccount
	err = tx.QueryRow(ctx, `
		SELECT id, code, name, category, created_at
		FROM accounting.puc_accounts
		WHERE id = $1 OR code = $1
	`, creditRef).Scan(&creditAcc.ID, &creditAcc.Code, &creditAcc.Name, &creditAcc.Category, &creditAcc.CreatedAt)
	var creditPtr *domain.PucAccount
	if err == nil {
		creditPtr = &creditAcc
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewAccountingVoucher("TMP", debitPtr, creditPtr, in, now); err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)
	if err != nil {
		return nil, err
	}
	voucher, err := domain.NewAccountingVoucher(code, debitPtr, creditPtr, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO accounting.vouchers (
			id, code, debit_account_id, debit_account_code, debit_account_name,
			credit_account_id, credit_account_code, credit_account_name,
			third_party_id, third_party_name, third_party_nit, concept, amount, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		voucher.ID, voucher.Code, voucher.DebitAccountID, voucher.DebitAccountCode, voucher.DebitAccountName,
		voucher.CreditAccountID, voucher.CreditAccountCode, voucher.CreditAccountName,
		voucher.ThirdPartyID, voucher.ThirdPartyName, voucher.ThirdPartyNit,
		voucher.Concept, voucher.Amount, voucher.CreatedAt,
	); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(voucher)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO accounting.idempotency_keys (scope, idem_key, response_json)
			VALUES ('voucher', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return voucher, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}
