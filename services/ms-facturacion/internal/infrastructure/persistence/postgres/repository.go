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
	schemaName      = "invoicing"
	serviceKey      = "ms-facturacion"
	demoTenantDB    = "db_demo_empresa"
	baseInvoiceSeq  = 9012
	baseQuoteSeq    = 3011
	baseDraftInvSeq = 1000
	baseCreditSeq   = 1000
	baseDebitSeq    = 2000
	baseDraftNCSeq  = 100
	baseDraftNDSeq  = 200
)

func seqBasesForDB(dbName string) (invBase, quoteBase, draftInvBase, ncBase, ndBase int) {
	if strings.TrimSpace(dbName) == demoTenantDB {
		return baseInvoiceSeq, baseQuoteSeq, 1001, 1001, baseDebitSeq
	}
	return 0, 0, baseDraftInvSeq, baseCreditSeq, baseDebitSeq
}

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
	if strings.TrimSpace(dbName) != demoTenantDB {
		return pool, nil
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
		baseNow := time.Now()
		seedInvoices, seedQuotes := domain.DefaultSeedData(baseNow)
		seedNotes, seedTxs := domain.DefaultSeedFiscalData(baseNow, seedInvoices)

		for idx, inv := range seedInvoices {
			createdAt := baseNow.Add(-time.Duration(idx+1) * time.Minute)
			if err := upsertInvoiceTx(ctx, tx, inv, "", &createdAt); err != nil {
				return nil, err
			}
		}
		for _, q := range seedQuotes {
			if err := insertQuoteTx(ctx, tx, q); err != nil {
				return nil, err
			}
		}
		for idx, n := range seedNotes {
			createdAt := baseNow.Add(-time.Duration(idx+1) * time.Minute)
			if err := upsertAdjustmentNoteTx(ctx, tx, n, &createdAt); err != nil {
				return nil, err
			}
		}
		for _, dt := range seedTxs {
			if err := upsertDianTransmissionTx(ctx, tx, dt); err != nil {
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

func upsertInvoiceTx(ctx context.Context, tx pgx.Tx, inv domain.Invoice, idemKey string, overrideCreatedAt *time.Time) error {
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
	invType := domain.InferInvoiceType(inv)
	docStatus := strings.TrimSpace(inv.DocStatus)
	if docStatus == "" {
		docStatus = domain.DocStatusConfirmada
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO invoicing.invoices (
			id, invoice_type, doc_status, cufe, dian_status, issue_date, due_date, purchase_order_ref,
			customer_id, customer_name, customer_nit, customer_phone, customer_address, contract_id, discount_pct,
			vehicle_id, plate, mechanic_id, mechanic_name, workshop_meta,
			linked_room_id, linked_table_id, layout_variant,
			subtotal, discount_total, tax_total, total, credited_total, debited_total,
			payment_method, amount_paid, pending_balance, status, notes, actor, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20::jsonb,
			$21, $22, $23,
			$24, $25, $26, $27, $28, $29,
			$30, $31, $32, $33, $34, $35, $36
		)
		ON CONFLICT (id) DO UPDATE SET
			invoice_type       = EXCLUDED.invoice_type,
			doc_status         = EXCLUDED.doc_status,
			cufe               = EXCLUDED.cufe,
			dian_status        = EXCLUDED.dian_status,
			issue_date         = EXCLUDED.issue_date,
			due_date           = EXCLUDED.due_date,
			purchase_order_ref = EXCLUDED.purchase_order_ref,
			customer_id        = EXCLUDED.customer_id,
			customer_name      = EXCLUDED.customer_name,
			customer_nit       = EXCLUDED.customer_nit,
			customer_phone     = EXCLUDED.customer_phone,
			customer_address   = EXCLUDED.customer_address,
			contract_id        = EXCLUDED.contract_id,
			discount_pct       = EXCLUDED.discount_pct,
			vehicle_id         = EXCLUDED.vehicle_id,
			plate              = EXCLUDED.plate,
			mechanic_id        = EXCLUDED.mechanic_id,
			mechanic_name      = EXCLUDED.mechanic_name,
			workshop_meta      = EXCLUDED.workshop_meta,
			linked_room_id     = EXCLUDED.linked_room_id,
			linked_table_id    = EXCLUDED.linked_table_id,
			layout_variant     = EXCLUDED.layout_variant,
			subtotal           = EXCLUDED.subtotal,
			discount_total     = EXCLUDED.discount_total,
			tax_total          = EXCLUDED.tax_total,
			total              = EXCLUDED.total,
			credited_total     = EXCLUDED.credited_total,
			debited_total      = EXCLUDED.debited_total,
			payment_method     = EXCLUDED.payment_method,
			amount_paid        = EXCLUDED.amount_paid,
			pending_balance    = EXCLUDED.pending_balance,
			status             = EXCLUDED.status,
			notes              = EXCLUDED.notes,
			actor              = EXCLUDED.actor
	`,
		inv.ID, invType, docStatus, inv.CUFE, inv.DianStatus, inv.IssueDate, inv.DueDate, inv.PurchaseOrderRef,
		inv.CustomerID, inv.CustomerName, inv.CustomerNIT, inv.CustomerPhone, inv.CustomerAddress, inv.ContractID, inv.DiscountPct,
		inv.VehicleID, inv.Plate, inv.MechanicID, inv.MechanicName, string(metaBytes),
		inv.LinkedRoomID, inv.LinkedTableID, inv.LayoutVariant,
		inv.Subtotal, inv.DiscountTotal, inv.TaxTotal, inv.Total, inv.CreditedTotal, inv.DebitedTotal,
		inv.PaymentMethod, inv.AmountPaid, inv.PendingBalance, inv.Status, inv.Notes, inv.Actor, createdAt,
	)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM invoicing.invoice_items WHERE invoice_id = $1`, inv.ID); err != nil {
		return err
	}

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

func upsertAdjustmentNoteTx(ctx context.Context, tx pgx.Tx, note domain.AdjustmentNote, overrideCreatedAt *time.Time) error {
	createdAt := time.Now()
	if overrideCreatedAt != nil {
		createdAt = *overrideCreatedAt
	}
	docStatus := strings.TrimSpace(note.DocStatus)
	if docStatus == "" {
		docStatus = domain.DocStatusConfirmada
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO invoicing.adjustment_notes (
			id, note_kind, invoice_id, referenced_cufe, customer_id, customer_name, customer_nit,
			reason_code, reason_description, restock_inventory, doc_status,
			subtotal, tax_total, total, issue_date, actor, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17
		)
		ON CONFLICT (id) DO UPDATE SET
			note_kind          = EXCLUDED.note_kind,
			invoice_id         = EXCLUDED.invoice_id,
			referenced_cufe    = EXCLUDED.referenced_cufe,
			customer_id        = EXCLUDED.customer_id,
			customer_name      = EXCLUDED.customer_name,
			customer_nit       = EXCLUDED.customer_nit,
			reason_code        = EXCLUDED.reason_code,
			reason_description = EXCLUDED.reason_description,
			restock_inventory  = EXCLUDED.restock_inventory,
			doc_status         = EXCLUDED.doc_status,
			subtotal           = EXCLUDED.subtotal,
			tax_total          = EXCLUDED.tax_total,
			total              = EXCLUDED.total,
			issue_date         = EXCLUDED.issue_date,
			actor              = EXCLUDED.actor
	`,
		note.ID, note.NoteKind, note.InvoiceID, note.ReferencedCUFE, note.CustomerID, note.CustomerName, note.CustomerNIT,
		note.ReasonCode, note.ReasonDescription, note.RestockInventory, docStatus,
		note.Subtotal, note.TaxTotal, note.Total, note.IssueDate, note.Actor, createdAt,
	)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM invoicing.adjustment_note_items WHERE note_id = $1`, note.ID); err != nil {
		return err
	}
	for _, it := range note.Items {
		_, err = tx.Exec(ctx, `
			INSERT INTO invoicing.adjustment_note_items (
				note_id, product_id, code, description, item_type,
				quantity, unit_price, tax_pct, subtotal
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`,
			note.ID, it.ProductID, it.Code, it.Description, it.ItemType,
			it.Quantity, it.UnitPrice, it.TaxPct, it.Subtotal,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func upsertDianTransmissionTx(ctx context.Context, tx pgx.Tx, dt domain.DianTransmission) error {
	docKind := strings.ToUpper(strings.TrimSpace(dt.DocumentKind))
	docID := strings.TrimSpace(dt.DocumentID)
	env := strings.TrimSpace(dt.Environment)
	if env == "" {
		env = "PRODUCCION"
	}
	stage := strings.TrimSpace(dt.DianStage)
	if stage == "" {
		stage = domain.DianStageSinEnviar
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO invoicing.dian_transmissions (
			document_kind, document_id, dian_stage, cufe_or_cude, referenced_cufe,
			track_id, environment, sent_at, responded_at, rejection_code, rejection_message, attempts, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
		ON CONFLICT (document_kind, document_id) DO UPDATE SET
			dian_stage        = EXCLUDED.dian_stage,
			cufe_or_cude      = EXCLUDED.cufe_or_cude,
			referenced_cufe   = EXCLUDED.referenced_cufe,
			track_id          = EXCLUDED.track_id,
			environment       = EXCLUDED.environment,
			sent_at           = EXCLUDED.sent_at,
			responded_at      = EXCLUDED.responded_at,
			rejection_code    = EXCLUDED.rejection_code,
			rejection_message = EXCLUDED.rejection_message,
			attempts          = EXCLUDED.attempts,
			updated_at        = NOW()
	`,
		docKind, docID, stage, dt.CUFEOrCUDE, dt.ReferencedCUFE,
		dt.TrackID, env, dt.SentAt, dt.RespondedAt, dt.RejectionCode, dt.RejectionMessage, dt.Attempts,
	)
	return err
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
		) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
		ON CONFLICT (id) DO NOTHING
	`,
		q.ID, q.CreatedAt, q.CustomerID, q.CustomerName, q.CustomerNIT,
		q.ValidUntil, string(itemsBytes), q.Subtotal, q.TaxTotal, q.Total, q.Status, q.Notes,
	)
	return err
}

func (r *Repository) PeekSequences(ctx context.Context, dbName string) (string, string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", "", err
	}
	invBase, quoteBase, _, _, _ := seqBasesForDB(dbName)
	nextInv, err := sequences.PeekSQL(ctx, pool, schemaName, "FEVP", invBase)
	if err != nil {
		return "", "", err
	}
	nextQuote, err := sequences.PeekSQL(ctx, pool, schemaName, "COT", quoteBase)
	if err != nil {
		return "", "", err
	}
	return nextInv, nextQuote, nil
}

func (r *Repository) PeekNoteSequences(ctx context.Context, dbName string) (string, string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", "", err
	}
	_, _, _, ncBase, ndBase := seqBasesForDB(dbName)
	nextNC, err := sequences.PeekSQL(ctx, pool, schemaName, "NC", ncBase)
	if err != nil {
		return "", "", err
	}
	nextND, err := sequences.PeekSQL(ctx, pool, schemaName, "ND", ndBase)
	if err != nil {
		return "", "", err
	}
	return nextNC, nextND, nil
}

func (r *Repository) ReserveInvoiceNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	invBase, _, _, _, _ := seqBasesForDB(dbName)
	return sequences.NextSQL(ctx, pool, schemaName, "FEVP", invBase)
}

func (r *Repository) ReserveDraftInvoiceNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	_, _, draftInvBase, _, _ := seqBasesForDB(dbName)
	return sequences.NextSQL(ctx, pool, schemaName, "BOR", draftInvBase)
}

func (r *Repository) ReserveQuoteNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	_, quoteBase, _, _, _ := seqBasesForDB(dbName)
	return sequences.NextSQL(ctx, pool, schemaName, "COT", quoteBase)
}

func (r *Repository) ReserveCreditNoteNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	_, _, _, ncBase, _ := seqBasesForDB(dbName)
	return sequences.NextSQL(ctx, pool, schemaName, "NC", ncBase)
}

func (r *Repository) ReserveDebitNoteNumber(ctx context.Context, dbName string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	_, _, _, _, ndBase := seqBasesForDB(dbName)
	return sequences.NextSQL(ctx, pool, schemaName, "ND", ndBase)
}

func (r *Repository) ReserveDraftNoteNumber(ctx context.Context, dbName string, noteKind string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}
	if strings.EqualFold(strings.TrimSpace(noteKind), domain.NoteKindDebit) {
		return sequences.NextSQL(ctx, pool, schemaName, "BND", baseDraftNDSeq)
	}
	return sequences.NextSQL(ctx, pool, schemaName, "BNC", baseDraftNCSeq)
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

	return r.GetInvoiceByID(ctx, dbName, invoiceID)
}

func (r *Repository) GetInvoiceByID(ctx context.Context, dbName, id string) (*domain.Invoice, error) {
	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, nil
	}
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	invoices, err := queryInvoices(ctx, pool, cleanID)
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

	if err := upsertInvoiceTx(ctx, tx, inv, idemKey, nil); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ReplaceInvoice(ctx context.Context, dbName, oldID string, inv domain.Invoice) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanOld := strings.TrimSpace(oldID)
	if cleanOld != "" && cleanOld != inv.ID {
		if _, err := tx.Exec(ctx, `DELETE FROM invoicing.invoices WHERE id = $1`, cleanOld); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM invoicing.dian_transmissions WHERE document_kind = $1 AND document_id = $2`, domain.DocKindInvoice, cleanOld); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE invoicing.idempotency_keys SET invoice_id = $1 WHERE invoice_id = $2`, inv.ID, cleanOld); err != nil {
			return err
		}
	}

	if err := upsertInvoiceTx(ctx, tx, inv, "", nil); err != nil {
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
			id, invoice_type, doc_status, cufe, dian_status, issue_date, due_date, purchase_order_ref,
			customer_id, customer_name, customer_nit, customer_phone, customer_address, contract_id, discount_pct::float8,
			vehicle_id, plate, mechanic_id, mechanic_name, workshop_meta::text,
			linked_room_id, linked_table_id, layout_variant,
			subtotal::float8, discount_total::float8, tax_total::float8, total::float8, credited_total::float8, debited_total::float8,
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
			&inv.ID, &inv.InvoiceType, &inv.DocStatus, &inv.CUFE, &inv.DianStatus, &inv.IssueDate, &inv.DueDate, &inv.PurchaseOrderRef,
			&inv.CustomerID, &inv.CustomerName, &inv.CustomerNIT, &inv.CustomerPhone, &inv.CustomerAddress, &inv.ContractID, &inv.DiscountPct,
			&inv.VehicleID, &inv.Plate, &inv.MechanicID, &inv.MechanicName, &metaRaw,
			&inv.LinkedRoomID, &inv.LinkedTableID, &inv.LayoutVariant,
			&inv.Subtotal, &inv.DiscountTotal, &inv.TaxTotal, &inv.Total, &inv.CreditedTotal, &inv.DebitedTotal,
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

	txRows, err := pool.Query(ctx, `
		SELECT
			document_kind, document_id, dian_stage, cufe_or_cude, referenced_cufe,
			track_id, environment, sent_at, responded_at, rejection_code, rejection_message, attempts
		FROM invoicing.dian_transmissions
		WHERE document_kind = $1 AND document_id = ANY($2)
	`, domain.DocKindInvoice, ids)
	if err != nil {
		return nil, err
	}
	defer txRows.Close()

	txByDocID := make(map[string]domain.DianTransmission)
	for txRows.Next() {
		var dt domain.DianTransmission
		if err := txRows.Scan(
			&dt.DocumentKind, &dt.DocumentID, &dt.DianStage, &dt.CUFEOrCUDE, &dt.ReferencedCUFE,
			&dt.TrackID, &dt.Environment, &dt.SentAt, &dt.RespondedAt, &dt.RejectionCode, &dt.RejectionMessage, &dt.Attempts,
		); err != nil {
			return nil, err
		}
		txByDocID[dt.DocumentID] = dt
	}
	if err := txRows.Err(); err != nil {
		return nil, err
	}

	for i := range invoices {
		var dtPtr *domain.DianTransmission
		if dt, ok := txByDocID[invoices[i].ID]; ok {
			dtCopy := dt
			dtPtr = &dtCopy
		}
		domain.HydrateInvoiceState(&invoices[i], dtPtr)
	}

	return invoices, nil
}

func (r *Repository) GetAdjustmentNoteByID(ctx context.Context, dbName, id string) (*domain.AdjustmentNote, error) {
	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, nil
	}
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	notes, err := queryAdjustmentNotes(ctx, pool, cleanID)
	if err != nil {
		return nil, err
	}
	if len(notes) == 0 {
		return nil, nil
	}
	found := notes[0]
	return &found, nil
}

func (r *Repository) SaveAdjustmentNote(ctx context.Context, dbName, oldID string, note domain.AdjustmentNote) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanOld := strings.TrimSpace(oldID)
	if cleanOld != "" && cleanOld != note.ID {
		if _, err := tx.Exec(ctx, `DELETE FROM invoicing.adjustment_notes WHERE id = $1`, cleanOld); err != nil {
			return err
		}
		docKind := domain.DocumentKindForNoteKind(note.NoteKind)
		if _, err := tx.Exec(ctx, `DELETE FROM invoicing.dian_transmissions WHERE document_kind = $1 AND document_id = $2`, docKind, cleanOld); err != nil {
			return err
		}
	}

	if err := upsertAdjustmentNoteTx(ctx, tx, note, nil); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListAdjustmentNotes(ctx context.Context, dbName string) ([]domain.AdjustmentNote, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	return queryAdjustmentNotes(ctx, pool, "")
}

func queryAdjustmentNotes(ctx context.Context, pool *pgxpool.Pool, filterID string) ([]domain.AdjustmentNote, error) {
	var (
		rows pgx.Rows
		err  error
	)
	baseSQL := `
		SELECT
			id, note_kind, invoice_id, referenced_cufe, customer_id, customer_name, customer_nit,
			reason_code, reason_description, restock_inventory, doc_status,
			subtotal::float8, tax_total::float8, total::float8, issue_date, actor
		FROM invoicing.adjustment_notes
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

	notes := make([]domain.AdjustmentNote, 0)
	indexByID := make(map[string]int)
	ids := make([]string, 0)

	for rows.Next() {
		var n domain.AdjustmentNote
		if err := rows.Scan(
			&n.ID, &n.NoteKind, &n.InvoiceID, &n.ReferencedCUFE, &n.CustomerID, &n.CustomerName, &n.CustomerNIT,
			&n.ReasonCode, &n.ReasonDescription, &n.RestockInventory, &n.DocStatus,
			&n.Subtotal, &n.TaxTotal, &n.Total, &n.IssueDate, &n.Actor,
		); err != nil {
			return nil, err
		}
		n.Number = n.ID
		n.Items = []domain.InvoiceItem{}
		indexByID[n.ID] = len(notes)
		ids = append(ids, n.ID)
		notes = append(notes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return notes, nil
	}

	itemRows, err := pool.Query(ctx, `
		SELECT
			note_id, product_id, code, description, item_type,
			quantity::float8, unit_price::float8, tax_pct::float8, subtotal::float8
		FROM invoicing.adjustment_note_items
		WHERE note_id = ANY($1)
		ORDER BY id ASC
	`, ids)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var noteID string
		var it domain.InvoiceItem
		if err := itemRows.Scan(
			&noteID, &it.ProductID, &it.Code, &it.Description, &it.ItemType,
			&it.Quantity, &it.UnitPrice, &it.TaxPct, &it.Subtotal,
		); err != nil {
			return nil, err
		}
		if idx, ok := indexByID[noteID]; ok {
			notes[idx].Items = append(notes[idx].Items, it)
		}
	}
	if err := itemRows.Err(); err != nil {
		return nil, err
	}

	txRows, err := pool.Query(ctx, `
		SELECT
			document_kind, document_id, dian_stage, cufe_or_cude, referenced_cufe,
			track_id, environment, sent_at, responded_at, rejection_code, rejection_message, attempts
		FROM invoicing.dian_transmissions
		WHERE document_kind IN ($1, $2) AND document_id = ANY($3)
	`, domain.DocKindCreditNote, domain.DocKindDebitNote, ids)
	if err != nil {
		return nil, err
	}
	defer txRows.Close()

	txByKey := make(map[string]domain.DianTransmission)
	for txRows.Next() {
		var dt domain.DianTransmission
		if err := txRows.Scan(
			&dt.DocumentKind, &dt.DocumentID, &dt.DianStage, &dt.CUFEOrCUDE, &dt.ReferencedCUFE,
			&dt.TrackID, &dt.Environment, &dt.SentAt, &dt.RespondedAt, &dt.RejectionCode, &dt.RejectionMessage, &dt.Attempts,
		); err != nil {
			return nil, err
		}
		txByKey[dt.DocumentKind+"::"+dt.DocumentID] = dt
	}
	if err := txRows.Err(); err != nil {
		return nil, err
	}

	for i := range notes {
		docKind := domain.DocumentKindForNoteKind(notes[i].NoteKind)
		var dtPtr *domain.DianTransmission
		if dt, ok := txByKey[docKind+"::"+notes[i].ID]; ok {
			dtCopy := dt
			dtPtr = &dtCopy
		}
		domain.HydrateAdjustmentNoteState(&notes[i], dtPtr)
	}

	return notes, nil
}

func (r *Repository) GetDianTransmission(ctx context.Context, dbName, documentKind, documentID string) (*domain.DianTransmission, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	var dt domain.DianTransmission
	err = pool.QueryRow(ctx, `
		SELECT
			document_kind, document_id, dian_stage, cufe_or_cude, referenced_cufe,
			track_id, environment, sent_at, responded_at, rejection_code, rejection_message, attempts
		FROM invoicing.dian_transmissions
		WHERE document_kind = $1 AND document_id = $2
	`, strings.ToUpper(strings.TrimSpace(documentKind)), strings.TrimSpace(documentID)).Scan(
		&dt.DocumentKind, &dt.DocumentID, &dt.DianStage, &dt.CUFEOrCUDE, &dt.ReferencedCUFE,
		&dt.TrackID, &dt.Environment, &dt.SentAt, &dt.RespondedAt, &dt.RejectionCode, &dt.RejectionMessage, &dt.Attempts,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &dt, nil
}

func (r *Repository) UpsertDianTransmission(ctx context.Context, dbName string, dt domain.DianTransmission) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := upsertDianTransmissionTx(ctx, tx, dt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListDianTransmissions(ctx context.Context, dbName string) ([]domain.DianTransmission, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return nil, err
	}
	rows, err := pool.Query(ctx, `
		SELECT
			document_kind, document_id, dian_stage, cufe_or_cude, referenced_cufe,
			track_id, environment, sent_at, responded_at, rejection_code, rejection_message, attempts
		FROM invoicing.dian_transmissions
		ORDER BY updated_at DESC, document_id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.DianTransmission, 0)
	for rows.Next() {
		var dt domain.DianTransmission
		if err := rows.Scan(
			&dt.DocumentKind, &dt.DocumentID, &dt.DianStage, &dt.CUFEOrCUDE, &dt.ReferencedCUFE,
			&dt.TrackID, &dt.Environment, &dt.SentAt, &dt.RespondedAt, &dt.RejectionCode, &dt.RejectionMessage, &dt.Attempts,
		); err != nil {
			return nil, err
		}
		out = append(out, dt)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
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
			valid_until, items_json::text, subtotal::float8, tax_total::float8, total::float8,
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
