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
	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/dbpool"
	"ms-compras/internal/platform/money"
	"ms-compras/internal/platform/sequences"
	"ms-compras/internal/domain"
	"ms-compras/migrations"
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
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-compras", migrations.SchemaSQL)
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

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-compras::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM procurement.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
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
	code1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	if err != nil {
		return err
	}
	code2, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	if err != nil {
		return err
	}
	ordCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.OrderSeqPrefix, domain.OrderSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO procurement.suppliers (id, code, nit, name, city, phone, email, created_at)
		VALUES
			($1, $2, '860.512.390-1', 'Distribuidora Industrial Andina S.A.S.', 'Bogotá D.C.', '6017428890', 'ventas@industrialandina.co', $5),
			($3, $4, '900.741.228-5', 'Importadora Mayorista del Pacífico Ltda.', 'Cali', '6024851120', 'comercial@mayoristapacifico.co', $5)
		ON CONFLICT DO NOTHING
	`, "sup-demo-1", code1, "sup-demo-2", code2, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO procurement.purchase_orders (
			id, code, supplier_id, supplier_code, supplier_name, supplier_nit,
			product_id, product_code, product_name, warehouse_id, warehouse_name,
			qty, unit_cost, total_cost, inventory_synced, status, created_by, created_at
		) VALUES (
			$1, $1, 'sup-demo-1', $2, 'Distribuidora Industrial Andina S.A.S.', '860.512.390-1',
			'prd-demo-1', 'PRD-101', 'Insumo Corporativo Estándar', 'wh-demo-1', 'Bodega Principal',
			25, 18500, 462500, FALSE, $3, 'admin@empresa.co', $4
		) ON CONFLICT DO NOTHING
	`, ordCode1, code1, domain.DefaultOrderStatus, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO procurement.seq_counters (prefix, current_val) VALUES ($1, 1)
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

	nextSup, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	if err != nil {
		return nil, err
	}
	nextOrd, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.OrderSeqPrefix, domain.OrderSeqStart)
	if err != nil {
		return nil, err
	}

	sRows, err := p.Query(ctx, `
		SELECT id, code, nit, name, city, phone, email, created_at
		FROM procurement.suppliers
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	suppliers := []*domain.Supplier{}
	for sRows.Next() {
		var s domain.Supplier
		if err := sRows.Scan(&s.ID, &s.Code, &s.Nit, &s.Name, &s.City, &s.Phone, &s.Email, &s.CreatedAt); err != nil {
			return nil, err
		}
		suppliers = append(suppliers, &s)
	}
	if err := sRows.Err(); err != nil {
		return nil, err
	}

	oRows, err := p.Query(ctx, `
		SELECT id, code, supplier_id, supplier_code, supplier_name, supplier_nit,
		       product_id, product_code, product_name, warehouse_id, warehouse_name,
		       qty::float8, unit_cost::float8, total_cost::float8, inventory_synced, status, created_by, created_at
		FROM procurement.purchase_orders
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer oRows.Close()

	orders := []*domain.PurchaseOrder{}
	for oRows.Next() {
		var o domain.PurchaseOrder
		if err := oRows.Scan(
			&o.ID, &o.Code, &o.SupplierID, &o.SupplierCode, &o.SupplierName, &o.SupplierNit,
			&o.ProductID, &o.ProductCode, &o.ProductName, &o.WarehouseID, &o.WarehouseName,
			&o.Qty, &o.UnitCost, &o.TotalCost, &o.InventorySynced, &o.Status, &o.CreatedBy, &o.CreatedAt,
		); err != nil {
			return nil, err
		}
		orders = append(orders, &o)
	}
	if err := oRows.Err(); err != nil {
		return nil, err
	}

	return &domain.AllState{
		NextSupplierCode: nextSup,
		NextOrderCode:    nextOrd,
		Suppliers:        suppliers,
		Orders:           orders,
	}, nil
}

func (r *Repository) GetSupplierByID(ctx context.Context, dbName, supplierID string) (*domain.Supplier, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	var s domain.Supplier
	err = p.QueryRow(ctx, `
		SELECT id, code, nit, name, city, phone, email, created_at
		FROM procurement.suppliers
		WHERE id = $1
	`, supplierID).Scan(&s.ID, &s.Code, &s.Nit, &s.Name, &s.City, &s.Phone, &s.Email, &s.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Proveedor no encontrado")
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) CreateSupplier(ctx context.Context, dbName, idemKey string, in domain.CreateSupplierInput) (*domain.Supplier, error) {
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
			SELECT response_json FROM procurement.idempotency_keys
			WHERE scope = 'supplier' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.Supplier
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM procurement.suppliers WHERE LOWER(nit) = LOWER($1))`, strings.TrimSpace(in.Nit)).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, apperr.Conflict("Ya existe un proveedor registrado con ese NIT")
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	sup, err := domain.NewSupplier(money.NewID("sup"), code, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO procurement.suppliers (id, code, nit, name, city, phone, email, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, sup.ID, sup.Code, sup.Nit, sup.Name, sup.City, sup.Phone, sup.Email, sup.CreatedAt); err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("Ya existe un proveedor registrado con ese NIT")
		}
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(sup)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO procurement.idempotency_keys (scope, idem_key, response_json)
			VALUES ('supplier', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return sup, nil
}

func (r *Repository) DeleteSupplier(ctx context.Context, dbName, supplierID string) error {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `DELETE FROM procurement.suppliers WHERE id = $1`, supplierID)
	if err != nil {
		if isForeignKeyViolation(err) {
			return apperr.Conflict("No es posible eliminar el proveedor porque registra órdenes de compra asociadas")
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Proveedor no encontrado")
	}
	return nil
}

func (r *Repository) PeekNextOrderCode(ctx context.Context, dbName string) (string, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return "", err
	}
	return sequences.PeekSQL(ctx, p, domain.SchemaName, domain.OrderSeqPrefix, domain.OrderSeqStart)
}

func (r *Repository) FindIdempotentOrder(ctx context.Context, dbName, idemKey string) (*domain.PurchaseOrder, error) {
	if idemKey == "" {
		return nil, nil
	}
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	var raw []byte
	err = p.QueryRow(ctx, `
		SELECT response_json FROM procurement.idempotency_keys
		WHERE scope = 'order' AND idem_key = $1
	`, idemKey).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var ord domain.PurchaseOrder
	if err := json.Unmarshal(raw, &ord); err != nil {
		return nil, nil
	}
	return &ord, nil
}

func (r *Repository) CreateOrder(
	ctx context.Context,
	dbName, idemKey string,
	in domain.CreateOrderInput,
	inventorySynced bool,
	actor string,
) (*domain.PurchaseOrder, error) {
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
			SELECT response_json FROM procurement.idempotency_keys
			WHERE scope = 'order' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.PurchaseOrder
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	var sup domain.Supplier
	err = tx.QueryRow(ctx, `
		SELECT id, code, nit, name, city, phone, email, created_at
		FROM procurement.suppliers
		WHERE id = $1
	`, strings.TrimSpace(in.SupplierID)).Scan(
		&sup.ID, &sup.Code, &sup.Nit, &sup.Name, &sup.City, &sup.Phone, &sup.Email, &sup.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Proveedor no encontrado")
	}
	if err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.OrderSeqPrefix, domain.OrderSeqStart)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	ord, err := domain.NewPurchaseOrder(code, &sup, in, inventorySynced, actor, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO procurement.purchase_orders (
			id, code, supplier_id, supplier_code, supplier_name, supplier_nit,
			product_id, product_code, product_name, warehouse_id, warehouse_name,
			qty, unit_cost, total_cost, inventory_synced, status, created_by, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16, $17, $18
		)
	`,
		ord.ID, ord.Code, ord.SupplierID, ord.SupplierCode, ord.SupplierName, ord.SupplierNit,
		ord.ProductID, ord.ProductCode, ord.ProductName, ord.WarehouseID, ord.WarehouseName,
		ord.Qty, ord.UnitCost, ord.TotalCost, ord.InventorySynced, ord.Status, ord.CreatedBy, ord.CreatedAt,
	); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(ord)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO procurement.idempotency_keys (scope, idem_key, response_json)
			VALUES ('order', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ord, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return true
	}
	return strings.Contains(strings.ToLower(err.Error()), "foreign key")
}
