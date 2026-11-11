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
	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/apperr"
	"ms-facturacion/internal/platform/dbpool"
	"ms-facturacion/internal/platform/sequences"
	"ms-facturacion/migrations"
)

const (
	schemaName     = "invoicing"
	serviceKey     = "ms-facturacion"
	baseInvoiceSeq = 9012
	baseQuoteSeq   = 3011
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
		SELECT EXISTS(SELECT 1 FROM invoicing.invoices)
		    OR EXISTS(SELECT 1 FROM invoicing.quotes)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		seedInvoices, seedQuotes := domain.DefaultSeedData(time.Now())
		baseNow := time.Now()
		for idx, inv := range seedInvoices {
			createdAt := baseNow.Add(-time.Duration(idx+1) * time.Minute)
			if err := insertInvoiceTx(ctx, tx, inv, "", &createdAt); err != nil {
				return nil, err
			}
		}
		for _, q := range seedQuotes {
			if err := insertQuoteTx(ctx, tx, q); err != nil {
				return nil, err
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

func insertInvoiceTx(ctx context.Context, tx pgx.Tx, inv domain.Invoice, idemKey string, overrideCreatedAt *time.Time) error {
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "idem::invoicing::"+cleanKey); err != nil {
			return err
		}
		var existingID string
		err := tx.QueryRow(ctx, `SELECT invoice_id FROM invoicing.idempotency_keys WHERE idem_key = $1`, cleanKey).Scan(&existingID)
		if err == nil && existingID != "" {
			return nil
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
	}

	metaBytes, err := json.Marshal(inv.WorkshopMeta)
	if err != nil {
		return err
	}
	createdAt := time.Now()
	if overrideCreatedAt != nil {
		createdAt = *overrideCreatedAt
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO invoicing.invoices (
			id, cufe, dian_status, issue_date, customer_id, customer_name, customer_nit,
			customer_phone, customer_address, contract_id, discount_pct,
			vehicle_id, plate, mechanic_id, mechanic_name, workshop_meta,
			linked_room_id, linked_table_id, layout_variant,
			subtotal, discount_total, tax_total, total,
			payment_method, amount_paid, pending_balance, status, notes, actor, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18, $19,
			$20, $21, $22, $23,
			$24, $25, $26, $27, $28, $29, $30
		)
		ON CONFLICT (id) DO NOTHING
	`,
		inv.ID, inv.CUFE, inv.DianStatus, inv.IssueDate, inv.CustomerID, inv.CustomerName, inv.CustomerNIT,
		inv.CustomerPhone, inv.CustomerAddress, inv.ContractID, inv.DiscountPct,
		inv.VehicleID, inv.Plate, inv.MechanicID, inv.MechanicName, metaBytes,
		inv.LinkedRoomID, inv.LinkedTableID, inv.LayoutVariant,
		inv.Subtotal, inv.DiscountTotal, inv.TaxTotal, inv.Total,
		inv.PaymentMethod, inv.AmountPaid, inv.PendingBalance, inv.Status, inv.Notes, inv.Actor, createdAt,
	)
	if err != nil {
		return err
	}

	if tag.RowsAffected() > 0 {
		for _, it := range inv.Items {
			_, err = tx.Exec(ctx, `
				INSERT INTO invoicing.invoice_items (
					invoice_id, product_id, code, description, item_type,
					quantity, unit_price, tax_pct, subtotal, worker_id, worker_name
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`,
				inv.ID, it.ProductID, it.Code, it.Description, it.ItemType,
				it.Quantity, it.UnitPrice, it.TaxPct, it.Subtotal, it.WorkerID, it.WorkerName,
			)
			if err != nil {
				return err
			}
		}
	}

	if cleanKey != "" {
		_, err = tx.Exec(ctx, `
			INSERT INTO invoicing.idempotency_keys (idem_key, invoice_id)
			VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, cleanKey, inv.ID)
		if err != nil {
			return err
		}
	}
	return nil
}

func insertQuoteTx(ctx context.Context, tx pgx.Tx, q domain.Quote) error {
	itemsBytes, err := json.Marshal(q.Items)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO invoicing.quotes (
			id, created_at, customer_id, customer_name, customer_nit,
			valid_until, items_json, subtotal, tax_total, total, status, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO NOTHING
	`,
		q.ID, q.CreatedAt, q.CustomerID, q.CustomerName, q.CustomerNIT,
		q.ValidUntil, itemsBytes, q.Subtotal, q.TaxTotal, q.Total, q.Status, q.Notes,
	)
	return err
}

func (r *Repository) PeekSequences(ctx context.Context, dbName string) (string, string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", "", err
	}
	nextInv, err := sequences.PeekSQL(ctx, pool, schemaName, "FEVP", baseInvoiceSeq)
	if err != nil {
		return "", "", err
	}
	nextQuote, err := sequences.PeekSQL(ctx, pool, schemaName, "COT", baseQuoteSeq)
	if err != nil {
		return "", "", err
	}
	return nextInv, nextQuote, nil
}

func (r *Repository) ReserveInvoiceNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	return sequences.NextSQL(ctx, pool, schemaName, "FEVP", baseInvoiceSeq)
}

func (r *Repository) ReserveQuoteNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	return sequences.NextSQL(ctx, pool, schemaName, "COT", baseQuoteSeq)
}

func (r *Repository) FindInvoiceByIdempotencyKey(ctx context.Context, dbName, idemKey string) (*domain.Invoice, error) {
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey == "" {
		return nil, nil
	}
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}

	var invoiceID string
	err = pool.QueryRow(ctx, `SELECT invoice_id FROM invoicing.idempotency_keys WHERE idem_key = $1`, cleanKey).Scan(&invoiceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	invoices, err := queryInvoices(ctx, pool, invoiceID)
	if err != nil {
		return nil, err
	}
	if len(invoices) == 0 {
		return nil, nil
	}
	found := invoices[0]
	return &found, nil
}

func (r *Repository) SaveInvoice(ctx context.Context, dbName string, inv domain.Invoice, idemKey string) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := insertInvoiceTx(ctx, tx, inv, idemKey, nil); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListInvoices(ctx context.Context, dbName string) ([]domain.Invoice, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	return queryInvoices(ctx, pool, "")
}

func queryInvoices(ctx context.Context, pool *pgxpool.Pool, filterID string) ([]domain.Invoice, error) {
	var (
		rows pgx.Rows
		err  error
	)
	baseSQL := `
		SELECT
			id, cufe, dian_status, issue_date, customer_id, customer_name, customer_nit,
			customer_phone, customer_address, contract_id, discount_pct::float8,
			vehicle_id, plate, mechanic_id, mechanic_name, workshop_meta,
			linked_room_id, linked_table_id, layout_variant,
			subtotal::float8, discount_total::float8, tax_total::float8, total::float8,
			payment_method, amount_paid::float8, pending_balance::float8, status, notes, actor
		FROM invoicing.invoices
	`
	if filterID != "" {
		rows, err = pool.Query(ctx, baseSQL+` WHERE id = $1`, filterID)
	} else {
		rows, err = pool.Query(ctx, baseSQL+` ORDER BY created_at DESC, id DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invoices := make([]domain.Invoice, 0)
	indexByID := make(map[string]int)
	ids := make([]string, 0)

	for rows.Next() {
		var inv domain.Invoice
		var metaRaw []byte
		if err := rows.Scan(
			&inv.ID, &inv.CUFE, &inv.DianStatus, &inv.IssueDate, &inv.CustomerID, &inv.CustomerName, &inv.CustomerNIT,
			&inv.CustomerPhone, &inv.CustomerAddress, &inv.ContractID, &inv.DiscountPct,
			&inv.VehicleID, &inv.Plate, &inv.MechanicID, &inv.MechanicName, &metaRaw,
			&inv.LinkedRoomID, &inv.LinkedTableID, &inv.LayoutVariant,
			&inv.Subtotal, &inv.DiscountTotal, &inv.TaxTotal, &inv.Total,
			&inv.PaymentMethod, &inv.AmountPaid, &inv.PendingBalance, &inv.Status, &inv.Notes, &inv.Actor,
		); err != nil {
			return nil, err
		}
		inv.Number = inv.ID
		inv.Date = inv.IssueDate
		inv.Items = []domain.InvoiceItem{}
		if len(metaRaw) > 0 {
			if err := json.Unmarshal(metaRaw, &inv.WorkshopMeta); err != nil {
				return nil, apperr.Internal("Error al decodificar metadatos operativos de la factura")
			}
		}
		indexByID[inv.ID] = len(invoices)
		ids = append(ids, inv.ID)
		invoices = append(invoices, inv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return invoices, nil
	}

	itemRows, err := pool.Query(ctx, `
		SELECT
			invoice_id, product_id, code, description, item_type,
			quantity::float8, unit_price::float8, tax_pct::float8, subtotal::float8,
			worker_id, worker_name
		FROM invoicing.invoice_items
		WHERE invoice_id = ANY($1)
		ORDER BY id ASC
	`, ids)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var invID string
		var it domain.InvoiceItem
		if err := itemRows.Scan(
			&invID, &it.ProductID, &it.Code, &it.Description, &it.ItemType,
			&it.Quantity, &it.UnitPrice, &it.TaxPct, &it.Subtotal,
			&it.WorkerID, &it.WorkerName,
		); err != nil {
			return nil, err
		}
		if idx, ok := indexByID[invID]; ok {
			invoices[idx].Items = append(invoices[idx].Items, it)
		}
	}
	if err := itemRows.Err(); err != nil {
		return nil, err
	}

	return invoices, nil
}

func (r *Repository) CreateQuote(ctx context.Context, dbName string, quote domain.Quote) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := insertQuoteTx(ctx, tx, quote); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListQuotes(ctx context.Context, dbName string) ([]domain.Quote, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}

	rows, err := pool.Query(ctx, `
		SELECT
			id, created_at, customer_id, customer_name, customer_nit,
			valid_until, items_json, subtotal::float8, tax_total::float8, total::float8,
			status, notes
		FROM invoicing.quotes
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	quotes := make([]domain.Quote, 0)
	for rows.Next() {
		var q domain.Quote
		var itemsRaw []byte
		if err := rows.Scan(
			&q.ID, &q.CreatedAt, &q.CustomerID, &q.CustomerName, &q.CustomerNIT,
			&q.ValidUntil, &itemsRaw, &q.Subtotal, &q.TaxTotal, &q.Total,
			&q.Status, &q.Notes,
		); err != nil {
			return nil, err
		}
		q.Items = []domain.InvoiceItem{}
		if len(itemsRaw) > 0 {
			if err := json.Unmarshal(itemsRaw, &q.Items); err != nil {
				return nil, apperr.Internal("Error al decodificar ítems de cotización")
			}
		}
		quotes = append(quotes, q)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return quotes, nil
}

func (r *Repository) GetSummary(ctx context.Context, dbName string) (domain.SalesSummary, error) {
	invoices, err := r.ListInvoices(ctx, dbName)
	if err != nil {
		return domain.SalesSummary{}, err
	}
	quotes, err := r.ListQuotes(ctx, dbName)
	if err != nil {
		return domain.SalesSummary{}, err
	}
	return domain.ComputeSummary(invoices, len(quotes)), nil
}
