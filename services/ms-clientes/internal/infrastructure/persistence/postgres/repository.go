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
	"ms-clientes/internal/platform/apperr"
	"ms-clientes/internal/platform/dbpool"
	"ms-clientes/internal/platform/sequences"
	"ms-clientes/internal/domain"
	"ms-clientes/migrations"
)

const (
	schemaName = "customers"
	serviceKey = "ms-clientes"
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

func (r *Repository) ensureSeeded(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
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
	if err := sequences.EnsureTableSQL(ctx, tx, schemaName); err != nil {
		return nil, err
	}

	var hasAny bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM customers.tariffs)
		    OR EXISTS(SELECT 1 FROM customers.contracts)
		    OR EXISTS(SELECT 1 FROM customers.customers)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		seed := domain.InitialSeedBundle(time.Now())
		for _, t := range seed.Tariffs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO customers.tariffs (id, code, name, discount_pct)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (id) DO NOTHING
			`, t.ID, t.Code, t.Name, t.DiscountPct); err != nil {
				return nil, err
			}
		}
		for _, c := range seed.Contracts {
			if _, err := tx.Exec(ctx, `
				INSERT INTO customers.contracts (id, code, name, entity_nit, tariff_id, tariff_name, budget_ceiling, consumed_amount, available_balance)
				VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9)
				ON CONFLICT (id) DO NOTHING
			`, c.ID, c.Code, c.Name, c.EntityNit, c.TariffID, c.TariffName, c.BudgetCeiling, c.ConsumedAmount, c.AvailableBalance); err != nil {
				return nil, err
			}
		}
		for _, cust := range seed.Customers {
			if _, err := tx.Exec(ctx, `
				INSERT INTO customers.customers (
					id, code, name, nit, phone, email, address,
					contract_id, contract_code, tariff_id, tariff_name, credit_limit, current_debt
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, NULLIF($10, ''), $11, $12, $13)
				ON CONFLICT (id) DO NOTHING
			`,
				cust.ID, cust.Code, cust.Name, cust.Nit, cust.Phone, cust.Email, cust.Address,
				cust.ContractID, cust.ContractCode, cust.TariffID, cust.TariffName, cust.CreditLimit, cust.CurrentDebt,
			); err != nil {
				return nil, err
			}
		}
		for _, rec := range seed.Receivables {
			if _, err := tx.Exec(ctx, `
				INSERT INTO customers.receivables (
					invoice_id, invoice_number, issue_date, customer_id, customer_name, customer_nit, invoice_total, pending_balance
				)
				VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8)
				ON CONFLICT (invoice_id) DO NOTHING
			`,
				rec.InvoiceID, rec.InvoiceNumber, rec.IssueDate, rec.CustomerID,
				rec.CustomerName, rec.CustomerNit, rec.InvoiceTotal, rec.PendingBalance,
			); err != nil {
				return nil, err
			}
			for _, ab := range rec.Abonos {
				if _, err := tx.Exec(ctx, `
					INSERT INTO customers.abonos (id, invoice_id, recorded_at, amount, method, note)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (id) DO NOTHING
				`, ab.ID, rec.InvoiceID, ab.Date, ab.Amount, ab.Method, ab.Note); err != nil {
					return nil, err
				}
			}
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

func loadIdempotentPayload[T any](ctx context.Context, tx pgx.Tx, scopedKey string) (T, bool, error) {
	var zero T
	if scopedKey == "" {
		return zero, false, nil
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "idem::"+scopedKey); err != nil {
		return zero, false, err
	}
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT payload FROM customers.idempotency_keys WHERE idem_key = $1`, scopedKey).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return zero, false, nil
	}
	if err != nil {
		return zero, false, err
	}
	if err := json.Unmarshal(raw, &zero); err != nil {
		return zero, false, err
	}
	return zero, true, nil
}

func saveIdempotentPayload(ctx context.Context, tx pgx.Tx, scopedKey string, value any) error {
	if scopedKey == "" {
		return nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO customers.idempotency_keys (idem_key, payload)
		VALUES ($1, $2::jsonb)
		ON CONFLICT (idem_key) DO NOTHING
	`, scopedKey, string(raw))
	return err
}

func (r *Repository) GetAll(ctx context.Context, dbName string) (domain.DirectorySnapshot, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}

	nextCust, err := sequences.PeekSQL(ctx, pool, schemaName, "CLI", domain.BaseCustomerSeq)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	nextCnt, err := sequences.PeekSQL(ctx, pool, schemaName, "CNV", domain.BaseContractSeq)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	nextTrf, err := sequences.PeekSQL(ctx, pool, schemaName, "TRF", domain.BaseTariffSeq)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}

	custRows, err := pool.Query(ctx, `
		SELECT id, code, name, nit, phone, email, address,
		       COALESCE(contract_id, ''), contract_code, COALESCE(tariff_id, ''), tariff_name,
		       credit_limit::float8, current_debt::float8
		FROM customers.customers
		ORDER BY created_at DESC, id ASC
	`)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	defer custRows.Close()

	customers := []domain.Customer{}
	for custRows.Next() {
		var c domain.Customer
		if err := custRows.Scan(
			&c.ID, &c.Code, &c.Name, &c.Nit, &c.Phone, &c.Email, &c.Address,
			&c.ContractID, &c.ContractCode, &c.TariffID, &c.TariffName,
			&c.CreditLimit, &c.CurrentDebt,
		); err != nil {
			return domain.DirectorySnapshot{}, err
		}
		customers = append(customers, c)
	}
	if err := custRows.Err(); err != nil {
		return domain.DirectorySnapshot{}, err
	}

	cntRows, err := pool.Query(ctx, `
		SELECT id, code, name, entity_nit, COALESCE(tariff_id, ''), tariff_name,
		       budget_ceiling::float8, consumed_amount::float8, available_balance::float8
		FROM customers.contracts
		ORDER BY created_at DESC, id ASC
	`)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	defer cntRows.Close()

	contracts := []domain.Contract{}
	for cntRows.Next() {
		var c domain.Contract
		if err := cntRows.Scan(
			&c.ID, &c.Code, &c.Name, &c.EntityNit, &c.TariffID, &c.TariffName,
			&c.BudgetCeiling, &c.ConsumedAmount, &c.AvailableBalance,
		); err != nil {
			return domain.DirectorySnapshot{}, err
		}
		contracts = append(contracts, c)
	}
	if err := cntRows.Err(); err != nil {
		return domain.DirectorySnapshot{}, err
	}

	trfRows, err := pool.Query(ctx, `
		SELECT id, code, name, discount_pct::float8
		FROM customers.tariffs
		ORDER BY created_at ASC, id ASC
	`)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	defer trfRows.Close()

	tariffs := []domain.Tariff{}
	for trfRows.Next() {
		var t domain.Tariff
		if err := trfRows.Scan(&t.ID, &t.Code, &t.Name, &t.DiscountPct); err != nil {
			return domain.DirectorySnapshot{}, err
		}
		tariffs = append(tariffs, t)
	}
	if err := trfRows.Err(); err != nil {
		return domain.DirectorySnapshot{}, err
	}

	recRows, err := pool.Query(ctx, `
		SELECT invoice_id, invoice_number, issue_date, COALESCE(customer_id, ''),
		       customer_name, customer_nit, invoice_total::float8, pending_balance::float8
		FROM customers.receivables
		WHERE pending_balance > 0
		ORDER BY created_at DESC, invoice_id DESC
	`)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	defer recRows.Close()

	pending := []domain.Receivable{}
	recIndex := make(map[string]int)
	invoiceIDs := make([]string, 0)
	for recRows.Next() {
		var rec domain.Receivable
		if err := recRows.Scan(
			&rec.InvoiceID, &rec.InvoiceNumber, &rec.IssueDate, &rec.CustomerID,
			&rec.CustomerName, &rec.CustomerNit, &rec.InvoiceTotal, &rec.PendingBalance,
		); err != nil {
			return domain.DirectorySnapshot{}, err
		}
		rec.Abonos = []domain.AbonoRecord{}
		recIndex[rec.InvoiceID] = len(pending)
		invoiceIDs = append(invoiceIDs, rec.InvoiceID)
		pending = append(pending, rec)
	}
	if err := recRows.Err(); err != nil {
		return domain.DirectorySnapshot{}, err
	}

	if len(invoiceIDs) > 0 {
		abRows, err := pool.Query(ctx, `
			SELECT id, invoice_id, recorded_at, amount::float8, method, note
			FROM customers.abonos
			WHERE invoice_id = ANY($1)
			ORDER BY created_at ASC, id ASC
		`, invoiceIDs)
		if err != nil {
			return domain.DirectorySnapshot{}, err
		}
		defer abRows.Close()

		for abRows.Next() {
			var invID string
			var ab domain.AbonoRecord
			if err := abRows.Scan(&ab.ID, &invID, &ab.Date, &ab.Amount, &ab.Method, &ab.Note); err != nil {
				return domain.DirectorySnapshot{}, err
			}
			if idx, ok := recIndex[invID]; ok {
				pending[idx].Abonos = append(pending[idx].Abonos, ab)
			}
		}
		if err := abRows.Err(); err != nil {
			return domain.DirectorySnapshot{}, err
		}
	}

	return domain.DirectorySnapshot{
		NextCustomerCode: nextCust,
		NextContractCode: nextCnt,
		NextTariffCode:   nextTrf,
		Customers:        customers,
		Contracts:        contracts,
		Tariffs:          tariffs,
		PendingInvoices:  pending,
	}, nil
}

func queryTariffTx(ctx context.Context, tx pgx.Tx, id string) (*domain.Tariff, error) {
	var t domain.Tariff
	err := tx.QueryRow(ctx, `
		SELECT id, code, name, discount_pct::float8
		FROM customers.tariffs
		WHERE id = $1
	`, id).Scan(&t.ID, &t.Code, &t.Name, &t.DiscountPct)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func queryContractTx(ctx context.Context, tx pgx.Tx, id string, forUpdate bool) (*domain.Contract, error) {
	sql := `
		SELECT id, code, name, entity_nit, COALESCE(tariff_id, ''), tariff_name,
		       budget_ceiling::float8, consumed_amount::float8, available_balance::float8
		FROM customers.contracts
		WHERE id = $1
	`
	if forUpdate {
		sql += " FOR UPDATE"
	}
	var c domain.Contract
	err := tx.QueryRow(ctx, sql, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.EntityNit, &c.TariffID, &c.TariffName,
		&c.BudgetCeiling, &c.ConsumedAmount, &c.AvailableBalance,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func queryCustomerTx(ctx context.Context, tx pgx.Tx, id string, forUpdate bool) (*domain.Customer, error) {
	sql := `
		SELECT id, code, name, nit, phone, email, address,
		       COALESCE(contract_id, ''), contract_code, COALESCE(tariff_id, ''), tariff_name,
		       credit_limit::float8, current_debt::float8
		FROM customers.customers
		WHERE id = $1
	`
	if forUpdate {
		sql += " FOR UPDATE"
	}
	var c domain.Customer
	err := tx.QueryRow(ctx, sql, id).Scan(
		&c.ID, &c.Code, &c.Name, &c.Nit, &c.Phone, &c.Email, &c.Address,
		&c.ContractID, &c.ContractCode, &c.TariffID, &c.TariffName,
		&c.CreditLimit, &c.CurrentDebt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func queryReceivableTx(ctx context.Context, tx pgx.Tx, invoiceID string, forUpdate bool) (*domain.Receivable, error) {
	sql := `
		SELECT invoice_id, invoice_number, issue_date, COALESCE(customer_id, ''),
		       customer_name, customer_nit, invoice_total::float8, pending_balance::float8
		FROM customers.receivables
		WHERE invoice_id = $1
	`
	if forUpdate {
		sql += " FOR UPDATE"
	}
	var rec domain.Receivable
	err := tx.QueryRow(ctx, sql, invoiceID).Scan(
		&rec.InvoiceID, &rec.InvoiceNumber, &rec.IssueDate, &rec.CustomerID,
		&rec.CustomerName, &rec.CustomerNit, &rec.InvoiceTotal, &rec.PendingBalance,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	abRows, err := tx.Query(ctx, `
		SELECT id, recorded_at, amount::float8, method, note
		FROM customers.abonos
		WHERE invoice_id = $1
		ORDER BY created_at ASC, id ASC
	`, invoiceID)
	if err != nil {
		return nil, err
	}
	defer abRows.Close()

	rec.Abonos = []domain.AbonoRecord{}
	for abRows.Next() {
		var ab domain.AbonoRecord
		if err := abRows.Scan(&ab.ID, &ab.Date, &ab.Amount, &ab.Method, &ab.Note); err != nil {
			return nil, err
		}
		rec.Abonos = append(rec.Abonos, ab)
	}
	if err := abRows.Err(); err != nil {
		return nil, err
	}
	return &rec, nil
}

func (r *Repository) CreateCustomer(ctx context.Context, dbName, idemKey string, in domain.CreateCustomerInput) (domain.Customer, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.Customer{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Customer{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var scopedIdem string
	if clean := strings.TrimSpace(idemKey); clean != "" {
		scopedIdem = "customer:" + clean
		if cached, found, err := loadIdempotentPayload[domain.Customer](ctx, tx, scopedIdem); err != nil {
			return domain.Customer{}, err
		} else if found {
			_ = tx.Commit(ctx)
			return cached, nil
		}
	}

	var nitExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM customers.customers WHERE LOWER(nit) = LOWER($1))`, strings.TrimSpace(in.Nit)).Scan(&nitExists); err != nil {
		return domain.Customer{}, err
	}
	if nitExists {
		return domain.Customer{}, apperr.Conflict("Ya existe un cliente registrado con ese NIT o documento")
	}

	var resolvedContract *domain.Contract
	if cntID := strings.TrimSpace(in.ContractID); cntID != "" {
		resolvedContract, err = queryContractTx(ctx, tx, cntID, false)
		if err != nil {
			return domain.Customer{}, err
		}
		if resolvedContract == nil {
			return domain.Customer{}, apperr.NotFound("El contrato comercial seleccionado no existe")
		}
	}

	var resolvedTariff *domain.Tariff
	if trfID := strings.TrimSpace(in.TariffID); trfID != "" {
		resolvedTariff, err = queryTariffTx(ctx, tx, trfID)
		if err != nil {
			return domain.Customer{}, err
		}
		if resolvedTariff == nil {
			return domain.Customer{}, apperr.NotFound("La tarifa comercial seleccionada no existe")
		}
	} else if resolvedContract != nil && resolvedContract.TariffID != "" {
		resolvedTariff, err = queryTariffTx(ctx, tx, resolvedContract.TariffID)
		if err != nil {
			return domain.Customer{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "CLI", domain.BaseCustomerSeq)
	if err != nil {
		return domain.Customer{}, err
	}
	created, err := domain.BuildCustomer(code, in, resolvedContract, resolvedTariff)
	if err != nil {
		return domain.Customer{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO customers.customers (
			id, code, name, nit, phone, email, address,
			contract_id, contract_code, tariff_id, tariff_name, credit_limit, current_debt
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, NULLIF($10, ''), $11, $12, $13)
	`,
		created.ID, created.Code, created.Name, created.Nit, created.Phone, created.Email, created.Address,
		created.ContractID, created.ContractCode, created.TariffID, created.TariffName, created.CreditLimit, created.CurrentDebt,
	); err != nil {
		return domain.Customer{}, err
	}

	if err := saveIdempotentPayload(ctx, tx, scopedIdem, created); err != nil {
		return domain.Customer{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Customer{}, err
	}
	return created, nil
}

func (r *Repository) DeleteCustomer(ctx context.Context, dbName, customerID string) error {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanID := strings.TrimSpace(customerID)
	cust, err := queryCustomerTx(ctx, tx, cleanID, true)
	if err != nil {
		return err
	}
	if cust == nil {
		return apperr.NotFound("Cliente no encontrado")
	}
	if cust.CurrentDebt > 0 {
		return apperr.Conflict("No es posible eliminar un cliente con saldo pendiente en cartera")
	}

	var hasPending bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM customers.receivables WHERE customer_id = $1 AND pending_balance > 0)
	`, cleanID).Scan(&hasPending); err != nil {
		return err
	}
	if hasPending {
		return apperr.Conflict("No es posible eliminar un cliente con facturas pendientes por cobrar")
	}

	if _, err := tx.Exec(ctx, `DELETE FROM customers.customers WHERE id = $1`, cleanID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) CreateTariff(ctx context.Context, dbName, idemKey string, in domain.CreateTariffInput) (domain.Tariff, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.Tariff{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Tariff{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var scopedIdem string
	if clean := strings.TrimSpace(idemKey); clean != "" {
		scopedIdem = "tariff:" + clean
		if cached, found, err := loadIdempotentPayload[domain.Tariff](ctx, tx, scopedIdem); err != nil {
			return domain.Tariff{}, err
		} else if found {
			_ = tx.Commit(ctx)
			return cached, nil
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "TRF", domain.BaseTariffSeq)
	if err != nil {
		return domain.Tariff{}, err
	}
	created, err := domain.BuildTariff(code, in)
	if err != nil {
		return domain.Tariff{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO customers.tariffs (id, code, name, discount_pct)
		VALUES ($1, $2, $3, $4)
	`, created.ID, created.Code, created.Name, created.DiscountPct); err != nil {
		return domain.Tariff{}, err
	}

	if err := saveIdempotentPayload(ctx, tx, scopedIdem, created); err != nil {
		return domain.Tariff{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Tariff{}, err
	}
	return created, nil
}

func (r *Repository) CreateContract(ctx context.Context, dbName, idemKey string, in domain.CreateContractInput) (domain.Contract, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.Contract{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Contract{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var scopedIdem string
	if clean := strings.TrimSpace(idemKey); clean != "" {
		scopedIdem = "contract:" + clean
		if cached, found, err := loadIdempotentPayload[domain.Contract](ctx, tx, scopedIdem); err != nil {
			return domain.Contract{}, err
		} else if found {
			_ = tx.Commit(ctx)
			return cached, nil
		}
	}

	var resolvedTariff *domain.Tariff
	if trfID := strings.TrimSpace(in.TariffID); trfID != "" {
		resolvedTariff, err = queryTariffTx(ctx, tx, trfID)
		if err != nil {
			return domain.Contract{}, err
		}
		if resolvedTariff == nil {
			return domain.Contract{}, apperr.NotFound("La tarifa asociada al contrato no existe")
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "CNV", domain.BaseContractSeq)
	if err != nil {
		return domain.Contract{}, err
	}
	created, err := domain.BuildContract(code, in, resolvedTariff)
	if err != nil {
		return domain.Contract{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO customers.contracts (
			id, code, name, entity_nit, tariff_id, tariff_name, budget_ceiling, consumed_amount, available_balance
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, $9)
	`,
		created.ID, created.Code, created.Name, created.EntityNit, created.TariffID,
		created.TariffName, created.BudgetCeiling, created.ConsumedAmount, created.AvailableBalance,
	); err != nil {
		return domain.Contract{}, err
	}

	if err := saveIdempotentPayload(ctx, tx, scopedIdem, created); err != nil {
		return domain.Contract{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Contract{}, err
	}
	return created, nil
}

func (r *Repository) RegisterAbono(ctx context.Context, dbName, idemKey, invoiceID string, in domain.RegisterAbonoInput) (domain.Receivable, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.Receivable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.Receivable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var scopedIdem string
	if clean := strings.TrimSpace(idemKey); clean != "" {
		scopedIdem = "abono:" + clean
		if cached, found, err := loadIdempotentPayload[domain.Receivable](ctx, tx, scopedIdem); err != nil {
			return domain.Receivable{}, err
		} else if found {
			_ = tx.Commit(ctx)
			return cached, nil
		}
	}

	cleanInvID := strings.TrimSpace(invoiceID)
	rec, err := queryReceivableTx(ctx, tx, cleanInvID, true)
	if err != nil {
		return domain.Receivable{}, err
	}
	if rec == nil {
		return domain.Receivable{}, apperr.NotFound("Factura o cuenta por cobrar no encontrada")
	}

	var cust *domain.Customer
	if rec.CustomerID != "" {
		cust, err = queryCustomerTx(ctx, tx, rec.CustomerID, true)
		if err != nil {
			return domain.Receivable{}, err
		}
	}

	abonoCode, err := sequences.NextSQL(ctx, tx, schemaName, "ABN", domain.BaseAbonoSeq)
	if err != nil {
		return domain.Receivable{}, err
	}

	updatedRec, updatedCust, abonoRecord, err := domain.ApplyAbono(*rec, cust, abonoCode, in, time.Now())
	if err != nil {
		return domain.Receivable{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE customers.receivables
		SET pending_balance = $2
		WHERE invoice_id = $1
	`, updatedRec.InvoiceID, updatedRec.PendingBalance); err != nil {
		return domain.Receivable{}, err
	}

	if updatedCust != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE customers.customers
			SET current_debt = $2
			WHERE id = $1
		`, updatedCust.ID, updatedCust.CurrentDebt); err != nil {
			return domain.Receivable{}, err
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO customers.abonos (id, invoice_id, recorded_at, amount, method, note)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, abonoRecord.ID, updatedRec.InvoiceID, abonoRecord.Date, abonoRecord.Amount, abonoRecord.Method, abonoRecord.Note); err != nil {
		return domain.Receivable{}, err
	}

	if err := saveIdempotentPayload(ctx, tx, scopedIdem, updatedRec); err != nil {
		return domain.Receivable{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Receivable{}, err
	}
	return updatedRec, nil
}

func (r *Repository) ResolveCommercialTerms(ctx context.Context, dbName, customerID, contractID string) (domain.CommercialTerms, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.CommercialTerms{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.CommercialTerms{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var cust *domain.Customer
	if cleanCust := strings.TrimSpace(customerID); cleanCust != "" {
		cust, err = queryCustomerTx(ctx, tx, cleanCust, false)
		if err != nil {
			return domain.CommercialTerms{}, err
		}
		if cust == nil {
			return domain.CommercialTerms{}, apperr.NotFound("Cliente no encontrado")
		}
	}

	var cnt *domain.Contract
	effectiveCntID := strings.TrimSpace(contractID)
	if effectiveCntID != "" {
		cnt, err = queryContractTx(ctx, tx, effectiveCntID, false)
		if err != nil {
			return domain.CommercialTerms{}, err
		}
		if cnt == nil {
			return domain.CommercialTerms{}, apperr.NotFound("Contrato comercial no encontrado")
		}
	} else if cust != nil && cust.ContractID != "" {
		cnt, err = queryContractTx(ctx, tx, cust.ContractID, false)
		if err != nil {
			return domain.CommercialTerms{}, err
		}
	}

	var discountPct float64
	tariffID := ""
	if cnt != nil && cnt.TariffID != "" {
		tariffID = cnt.TariffID
	} else if cust != nil && cust.TariffID != "" {
		tariffID = cust.TariffID
	}
	if tariffID != "" {
		trf, err := queryTariffTx(ctx, tx, tariffID)
		if err != nil {
			return domain.CommercialTerms{}, err
		}
		if trf != nil {
			discountPct = trf.DiscountPct
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.CommercialTerms{}, err
	}

	var out domain.CommercialTerms
	if cust != nil {
		out.CustomerID = cust.ID
		out.CustomerName = cust.Name
		out.CustomerNit = cust.Nit
		out.CustomerPhone = cust.Phone
		out.CustomerAddress = cust.Address
	} else if cnt != nil {
		out.CustomerName = cnt.Name
		out.CustomerNit = cnt.EntityNit
	}
	if cnt != nil {
		out.ContractID = cnt.ID
		out.ContractCode = cnt.Code
	}
	out.DiscountPct = discountPct
	return out, nil
}

func (r *Repository) ApplyReceivableDelta(ctx context.Context, dbName string, in domain.ReceivableDeltaInput, enforceCreditLimit bool) (domain.ReceivableDeltaResult, error) {
	pool, err := r.ensureSeeded(ctx, dbName)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}

	validated, err := domain.ValidateReceivableDelta(in)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var scopedIdem string
	if validated.IdempotencyKey != "" {
		scopedIdem = "delta:" + validated.IdempotencyKey
		if cached, found, err := loadIdempotentPayload[domain.ReceivableDeltaResult](ctx, tx, scopedIdem); err != nil {
			return domain.ReceivableDeltaResult{}, err
		} else if found {
			_ = tx.Commit(ctx)
			return cached, nil
		}
	}

	var cust *domain.Customer
	if validated.CustomerID != "" {
		cust, err = queryCustomerTx(ctx, tx, validated.CustomerID, true)
		if err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
		if cust == nil {
			return domain.ReceivableDeltaResult{}, apperr.NotFound("Cliente no encontrado")
		}
		if err := domain.EvaluateCreditLimit(*cust, validated.DebtDelta, enforceCreditLimit); err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
	}

	effectiveContractID := validated.ContractID
	if effectiveContractID == "" && validated.ContractConsumedDelta != 0 && cust != nil {
		effectiveContractID = cust.ContractID
	}

	var cnt *domain.Contract
	if effectiveContractID != "" {
		cnt, err = queryContractTx(ctx, tx, effectiveContractID, true)
		if err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
		if cnt == nil && validated.ContractID != "" {
			return domain.ReceivableDeltaResult{}, apperr.NotFound("Contrato comercial no encontrado")
		}
		if cnt != nil {
			if err := domain.EvaluateContractCeiling(*cnt, validated.ContractConsumedDelta); err != nil {
				return domain.ReceivableDeltaResult{}, err
			}
		}
	}

	var res domain.ReceivableDeltaResult
	res.Ok = true

	if cust != nil {
		cust.CurrentDebt = domain.ComputeUpdatedDebt(cust.CurrentDebt, validated.DebtDelta)
		if _, err := tx.Exec(ctx, `
			UPDATE customers.customers
			SET current_debt = $2
			WHERE id = $1
		`, cust.ID, cust.CurrentDebt); err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
		res.CustomerName = cust.Name
		res.CustomerNit = cust.Nit
		res.UpdatedDebt = cust.CurrentDebt

		if validated.DebtDelta != 0 {
			lookupInvID := validated.InvoiceID
			if lookupInvID == "" {
				lookupInvID = validated.InvoiceNumber
			}
			var existingRec *domain.Receivable
			if lookupInvID != "" {
				existingRec, err = queryReceivableTx(ctx, tx, lookupInvID, true)
				if err != nil {
					return domain.ReceivableDeltaResult{}, err
				}
			}
			nextRec := domain.BuildOrUpdateReceivable(existingRec, *cust, validated, time.Now())
			if nextRec != nil {
				if existingRec != nil {
					if _, err := tx.Exec(ctx, `
						UPDATE customers.receivables
						SET invoice_total = $2, pending_balance = $3
						WHERE invoice_id = $1
					`, nextRec.InvoiceID, nextRec.InvoiceTotal, nextRec.PendingBalance); err != nil {
						return domain.ReceivableDeltaResult{}, err
					}
				} else {
					if _, err := tx.Exec(ctx, `
						INSERT INTO customers.receivables (
							invoice_id, invoice_number, issue_date, customer_id,
							customer_name, customer_nit, invoice_total, pending_balance
						)
						VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8)
					`,
						nextRec.InvoiceID, nextRec.InvoiceNumber, nextRec.IssueDate, nextRec.CustomerID,
						nextRec.CustomerName, nextRec.CustomerNit, nextRec.InvoiceTotal, nextRec.PendingBalance,
					); err != nil {
						return domain.ReceivableDeltaResult{}, err
					}
				}
			}
		}
	} else if cnt != nil {
		res.CustomerName = cnt.Name
		res.CustomerNit = cnt.EntityNit
	}

	if cnt != nil && validated.ContractConsumedDelta != 0 {
		consumed, avail := domain.ComputeUpdatedContractBalances(
			cnt.BudgetCeiling,
			cnt.ConsumedAmount,
			validated.ContractConsumedDelta,
		)
		if _, err := tx.Exec(ctx, `
			UPDATE customers.contracts
			SET consumed_amount = $2, available_balance = $3
			WHERE id = $1
		`, cnt.ID, consumed, avail); err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
	}

	if err := saveIdempotentPayload(ctx, tx, scopedIdem, res); err != nil {
		return domain.ReceivableDeltaResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.ReceivableDeltaResult{}, err
	}
	return res, nil
}
