package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-inventario/internal/platform/apperr"
	"ms-inventario/internal/platform/dbpool"
	"ms-inventario/internal/platform/money"
	"ms-inventario/internal/platform/sequences"
	"ms-inventario/internal/domain"
	"ms-inventario/migrations"
)

type Repository struct {
	dbMgr  *dbpool.Manager
	seedMu sync.RWMutex
	seeded map[string]bool
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func nowDateStr() string {
	return time.Now().Format("2006-01-02 15:04")
}

func (r *Repository) poolFor(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-inventario", migrations.SchemaSQL)
	if err != nil {
		return nil, apperr.Internal("Error conectando al esquema de inventario: " + err.Error())
	}
	if err := r.ensureSeeded(ctx, dbName, pool); err != nil {
		return nil, err
	}
	return pool, nil
}

func (r *Repository) ensureSeeded(ctx context.Context, dbName string, pool *pgxpool.Pool) error {
	r.seedMu.RLock()
	already := r.seeded[dbName]
	r.seedMu.RUnlock()
	if already {
		return nil
	}

	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM inventory.warehouses`).Scan(&count); err == nil && count > 0 {
		r.seedMu.Lock()
		r.seeded[dbName] = true
		r.seedMu.Unlock()
		return nil
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return apperr.Internal("Error iniciando semilla de inventario: " + err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(7103001)`); err != nil {
		return apperr.Internal(err.Error())
	}
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM inventory.warehouses`).Scan(&count); err != nil {
		return apperr.Internal(err.Error())
	}
	if count > 0 {
		if err := tx.Commit(ctx); err != nil {
			return apperr.Internal(err.Error())
		}
		r.seedMu.Lock()
		r.seeded[dbName] = true
		r.seedMu.Unlock()
		return nil
	}

	wh1Code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	wh2Code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	p1Code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	p2Code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	if err != nil {
		return apperr.Internal(err.Error())
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO inventory.warehouses (id, code, name, location, manager) VALUES
		('wh-principal', $1, 'Bodega Central Principal', 'Sede Principal', 'Coordinación Logística'),
		('wh-auxiliar', $2, 'Bodega Punto de Venta', 'Mostrador Comercial', 'Jefatura de Sala')
	`, wh1Code, wh2Code)
	if err != nil {
		return apperr.Internal(err.Error())
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO inventory.products (id, code, name, category, warehouse_id, warehouse_name, cost_price, sale_price, tax_pct, stock, min_stock, lot_code, expiry_date)
		VALUES
		('prd-seed-1', $1, 'Kit Mantenimiento Preventivo', 'Repuestos e Insumos', 'wh-principal', 'Bodega Central Principal', 42000, 68000, 19, 25, 5, 'LT-2026-A', '2028-12-31'),
		('prd-seed-2', $2, 'Lubricante Sintético Multigrado 1L', 'Lubricantes', 'wh-principal', 'Bodega Central Principal', 28000, 45000, 19, 40, 8, 'LT-2026-B', '2028-06-30')
	`, p1Code, p2Code)
	if err != nil {
		return apperr.Internal(err.Error())
	}

	k1, _ := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.KardexSeqPrefix, domain.KardexSeqStart)
	k2, _ := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.KardexSeqPrefix, domain.KardexSeqStart)
	now := nowDateStr()
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory.kardex_movements (id, movement_date, movement_type, product_id, product_code, product_name, warehouse_id, warehouse_name, qty, unit_cost, balance_after, reference_doc, actor)
		VALUES
		($1, $3, $4, 'prd-seed-1', $5, 'Kit Mantenimiento Preventivo', 'wh-principal', 'Bodega Central Principal', 25, 42000, 25, 'APERTURA INVENTARIO', 'sistema'),
		($2, $3, $4, 'prd-seed-2', $6, 'Lubricante Sintético Multigrado 1L', 'wh-principal', 'Bodega Central Principal', 40, 28000, 40, 'APERTURA INVENTARIO', 'sistema')
	`, k1, k2, now, domain.MovementSaldoInicial, p1Code, p2Code)
	if err != nil {
		return apperr.Internal(err.Error())
	}

	if err := tx.Commit(ctx); err != nil {
		return apperr.Internal(err.Error())
	}
	r.seedMu.Lock()
	r.seeded[dbName] = true
	r.seedMu.Unlock()
	return nil
}

func checkIdemTx[T any](ctx context.Context, tx pgx.Tx, key string) (T, bool, error) {
	var zero T
	k := strings.TrimSpace(key)
	if k == "" || strings.HasSuffix(k, ":") {
		return zero, false, nil
	}
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, k); err != nil {
		return zero, false, apperr.Internal(err.Error())
	}
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT payload FROM inventory.idempotency_keys WHERE idem_key = $1`, k).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return zero, false, nil
	}
	if err != nil {
		return zero, false, apperr.Internal(err.Error())
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		return zero, false, apperr.Internal(err.Error())
	}
	return out, true, nil
}

func saveIdemTx(ctx context.Context, tx pgx.Tx, key string, val any) error {
	k := strings.TrimSpace(key)
	if k == "" || strings.HasSuffix(k, ":") {
		return nil
	}
	b, err := json.Marshal(val)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	_, err = tx.Exec(ctx, `INSERT INTO inventory.idempotency_keys (idem_key, payload) VALUES ($1, $2) ON CONFLICT (idem_key) DO NOTHING`, k, b)
	return err
}

func resolveWarehouseTx(ctx context.Context, tx pgx.Tx, id string) (*domain.Warehouse, error) {
	trimmed := strings.TrimSpace(id)
	var wh domain.Warehouse
	var err error
	if trimmed == "" {
		err = tx.QueryRow(ctx, `SELECT id, code, name, location, manager FROM inventory.warehouses ORDER BY created_at ASC, id ASC LIMIT 1`).
			Scan(&wh.ID, &wh.Code, &wh.Name, &wh.Location, &wh.Manager)
	} else {
		err = tx.QueryRow(ctx, `SELECT id, code, name, location, manager FROM inventory.warehouses WHERE id = $1 OR UPPER(code) = UPPER($1) LIMIT 1`, trimmed).
			Scan(&wh.ID, &wh.Code, &wh.Name, &wh.Location, &wh.Manager)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return &wh, nil
}

func lockProductTx(ctx context.Context, tx pgx.Tx, id string) (*domain.Product, error) {
	var p domain.Product
	err := tx.QueryRow(ctx, `
		SELECT id, code, name, category, warehouse_id, warehouse_name, supplier_id, supplier_name,
		       cost_price::FLOAT8, sale_price::FLOAT8, tax_pct::FLOAT8, stock::FLOAT8, min_stock::FLOAT8, lot_code, expiry_date
		FROM inventory.products
		WHERE id = $1 OR UPPER(code) = UPPER($1)
		FOR UPDATE
	`, strings.TrimSpace(id)).Scan(
		&p.ID, &p.Code, &p.Name, &p.Category, &p.WarehouseID, &p.WarehouseName, &p.SupplierID, &p.SupplierName,
		&p.CostPrice, &p.SalePrice, &p.TaxPct, &p.Stock, &p.MinStock, &p.LotCode, &p.ExpiryDate,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Producto no encontrado")
	}
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return &p, nil
}

func insertKardexTx(ctx context.Context, tx pgx.Tx, m *domain.KardexMovement) error {
	id, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.KardexSeqPrefix, domain.KardexSeqStart)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	m.ID = id
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory.kardex_movements
		(id, movement_date, movement_type, product_id, product_code, product_name, warehouse_id, warehouse_name, qty, unit_cost, balance_after, reference_doc, actor)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, m.ID, m.Date, m.Type, m.ProductID, m.ProductCode, m.ProductName, m.WarehouseID, m.WarehouseName, m.Qty, m.UnitCost, m.BalanceAfter, m.Reference, m.Actor)
	if err != nil {
		return apperr.Internal(err.Error())
	}
	return nil
}

func (r *Repository) GetAll(ctx context.Context, dbName string) (*domain.InventoryState, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}

	nextProd, err := sequences.PeekSQL(ctx, pool, domain.SchemaName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	nextWh, err := sequences.PeekSQL(ctx, pool, domain.SchemaName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	nextReq, err := sequences.PeekSQL(ctx, pool, domain.SchemaName, domain.RequestSeqPrefix, domain.RequestSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}

	whRows, err := pool.Query(ctx, `SELECT id, code, name, location, manager FROM inventory.warehouses ORDER BY created_at ASC, id ASC`)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer whRows.Close()
	warehouses := make([]*domain.Warehouse, 0)
	for whRows.Next() {
		var w domain.Warehouse
		if err := whRows.Scan(&w.ID, &w.Code, &w.Name, &w.Location, &w.Manager); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		warehouses = append(warehouses, &w)
	}

	prodRows, err := pool.Query(ctx, `
		SELECT id, code, name, category, warehouse_id, warehouse_name, supplier_id, supplier_name,
		       cost_price::FLOAT8, sale_price::FLOAT8, tax_pct::FLOAT8, stock::FLOAT8, min_stock::FLOAT8, lot_code, expiry_date
		FROM inventory.products ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer prodRows.Close()
	products := make([]*domain.Product, 0)
	for prodRows.Next() {
		var p domain.Product
		if err := prodRows.Scan(
			&p.ID, &p.Code, &p.Name, &p.Category, &p.WarehouseID, &p.WarehouseName, &p.SupplierID, &p.SupplierName,
			&p.CostPrice, &p.SalePrice, &p.TaxPct, &p.Stock, &p.MinStock, &p.LotCode, &p.ExpiryDate,
		); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		products = append(products, &p)
	}

	kdxRows, err := pool.Query(ctx, `
		SELECT id, movement_date, movement_type, product_id, product_code, product_name, warehouse_id, warehouse_name,
		       qty::FLOAT8, unit_cost::FLOAT8, balance_after::FLOAT8, reference_doc, actor
		FROM inventory.kardex_movements ORDER BY created_at DESC, id DESC LIMIT 250`)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer kdxRows.Close()
	kardex := make([]*domain.KardexMovement, 0)
	for kdxRows.Next() {
		var k domain.KardexMovement
		if err := kdxRows.Scan(&k.ID, &k.Date, &k.Type, &k.ProductID, &k.ProductCode, &k.ProductName, &k.WarehouseID, &k.WarehouseName, &k.Qty, &k.UnitCost, &k.BalanceAfter, &k.Reference, &k.Actor); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		kardex = append(kardex, &k)
	}

	reqRows, err := pool.Query(ctx, `SELECT id, code, req_date, area, product_id, product_name, qty::FLOAT8, status, notes FROM inventory.supply_requests ORDER BY created_at DESC, code DESC`)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer reqRows.Close()
	requests := make([]*domain.SupplyRequest, 0)
	for reqRows.Next() {
		var sr domain.SupplyRequest
		if err := reqRows.Scan(&sr.ID, &sr.Code, &sr.Date, &sr.Area, &sr.ProductID, &sr.ProductName, &sr.Qty, &sr.Status, &sr.Notes); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		requests = append(requests, &sr)
	}

	return &domain.InventoryState{
		NextProductCode:   nextProd,
		NextWarehouseCode: nextWh,
		NextRequestCode:   nextReq,
		Products:          products,
		Warehouses:        warehouses,
		Kardex:            kardex,
		Requests:          requests,
	}, nil
}

func (r *Repository) CreateProduct(ctx context.Context, dbName, idemKey string, in domain.CreateProductInput, actor string) (*domain.Product, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.Product](ctx, tx, "prod:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	wh, err := resolveWarehouseTx(ctx, tx, in.WarehouseID)
	if err != nil {
		return nil, err
	}
	if wh == nil {
		return nil, apperr.Validation("Debe asociar el producto a una bodega válida")
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	prod, err := domain.NewProduct(money.NewID("prd"), code, wh, in)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory.products
		(id, code, name, category, warehouse_id, warehouse_name, supplier_id, supplier_name, cost_price, sale_price, tax_pct, stock, min_stock, lot_code, expiry_date)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
	`, prod.ID, prod.Code, prod.Name, prod.Category, prod.WarehouseID, prod.WarehouseName, prod.SupplierID, prod.SupplierName, prod.CostPrice, prod.SalePrice, prod.TaxPct, prod.Stock, prod.MinStock, prod.LotCode, prod.ExpiryDate)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}

	if prod.Stock > 0 {
		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          nowDateStr(),
			Type:          domain.MovementSaldoInicial,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   wh.ID,
			WarehouseName: wh.Name,
			Qty:           prod.Stock,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     "ALTA DE PRODUCTO",
			Actor:         actor,
		}); err != nil {
			return nil, err
		}
	}
	if err := saveIdemTx(ctx, tx, "prod:"+idemKey, prod); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return prod, nil
}

func (r *Repository) DeleteProduct(ctx context.Context, dbName, productID string) error {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return err
	}
	tag, err := pool.Exec(ctx, `DELETE FROM inventory.products WHERE id = $1`, strings.TrimSpace(productID))
	if err != nil {
		return apperr.Internal(err.Error())
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Producto no encontrado")
	}
	return nil
}

func (r *Repository) AdjustProductDelta(ctx context.Context, dbName, idemKey, productID string, in domain.AdjustDeltaInput, actor string) (*domain.Product, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.Product](ctx, tx, "delta:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	prod, err := lockProductTx(ctx, tx, productID)
	if err != nil {
		return nil, err
	}
	movType, cleanDelta, err := domain.ApplyProductDelta(prod, in.Delta)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1 WHERE id = $2`, prod.Stock, prod.ID); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	qty := cleanDelta
	if qty < 0 {
		qty = -qty
	}
	ref := strings.TrimSpace(in.Reference)
	if ref == "" {
		ref = "AJUSTE MANUAL"
	}
	if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
		Date:          nowDateStr(),
		Type:          movType,
		ProductID:     prod.ID,
		ProductCode:   prod.Code,
		ProductName:   prod.Name,
		WarehouseID:   prod.WarehouseID,
		WarehouseName: prod.WarehouseName,
		Qty:           qty,
		UnitCost:      prod.CostPrice,
		BalanceAfter:  prod.Stock,
		Reference:     ref,
		Actor:         actor,
	}); err != nil {
		return nil, err
	}
	if err := saveIdemTx(ctx, tx, "delta:"+idemKey, prod); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return prod, nil
}

func (r *Repository) RestockProduct(ctx context.Context, dbName, idemKey, productID string, in domain.RestockProductInput, actor string) (*domain.Product, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.Product](ctx, tx, "restock-one:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	prod, err := lockProductTx(ctx, tx, productID)
	if err != nil {
		return nil, err
	}
	inQty, effCost, err := domain.ApplyProductRestock(prod, in.EffectiveQty(), in.UnitCost, in.LotCode, in.ExpiryDate)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1, cost_price = $2, lot_code = $3, expiry_date = $4 WHERE id = $5`,
		prod.Stock, prod.CostPrice, prod.LotCode, prod.ExpiryDate, prod.ID); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	ref := strings.TrimSpace(in.Reference)
	if ref == "" {
		ref = "SURTIDO DIRECTO"
	}
	if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
		Date:          nowDateStr(),
		Type:          domain.NormalizeRestockMovementType(in.MovementType),
		ProductID:     prod.ID,
		ProductCode:   prod.Code,
		ProductName:   prod.Name,
		WarehouseID:   prod.WarehouseID,
		WarehouseName: prod.WarehouseName,
		Qty:           inQty,
		UnitCost:      effCost,
		BalanceAfter:  prod.Stock,
		Reference:     ref,
		Actor:         actor,
	}); err != nil {
		return nil, err
	}
	if err := saveIdemTx(ctx, tx, "restock-one:"+idemKey, prod); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return prod, nil
}

func (r *Repository) TransferProduct(ctx context.Context, dbName, idemKey, productID string, in domain.TransferProductInput, actor string) (*domain.Product, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.Product](ctx, tx, "transfer:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	prod, err := lockProductTx(ctx, tx, productID)
	if err != nil {
		return nil, err
	}
	targetWh, err := resolveWarehouseTx(ctx, tx, in.EffectiveTargetWarehouseID())
	if err != nil {
		return nil, err
	}
	qty, err := domain.ValidateTransferRequest(prod, targetWh, in.EffectiveQty())
	if err != nil {
		return nil, err
	}
	originID := prod.WarehouseID
	originName := prod.WarehouseName
	note := in.EffectiveNote()
	if note == "" {
		note = originName + " -> " + targetWh.Name
	}

	if money.RoundCents(prod.Stock-qty) == 0 {
		prod.WarehouseID = targetWh.ID
		prod.WarehouseName = targetWh.Name
		if _, err := tx.Exec(ctx, `UPDATE inventory.products SET warehouse_id = $1, warehouse_name = $2 WHERE id = $3`, prod.WarehouseID, prod.WarehouseName, prod.ID); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          nowDateStr(),
			Type:          domain.MovementTrasladoBodega,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   targetWh.ID,
			WarehouseName: targetWh.Name,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     note,
			Actor:         actor,
		}); err != nil {
			return nil, err
		}
	} else {
		prod.Stock = money.RoundCents(prod.Stock - qty)
		if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1 WHERE id = $2`, prod.Stock, prod.ID); err != nil {
			return nil, apperr.Internal(err.Error())
		}
		now := nowDateStr()
		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          now,
			Type:          domain.MovementTrasladoBodega,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   originID,
			WarehouseName: originName,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     note,
			Actor:         actor,
		}); err != nil {
			return nil, err
		}

		var destID string
		var destStock float64
		destErr := tx.QueryRow(ctx, `
			SELECT id, stock::FLOAT8 FROM inventory.products
			WHERE UPPER(code) = UPPER($1) AND warehouse_id = $2
			FOR UPDATE
		`, prod.Code, targetWh.ID).Scan(&destID, &destStock)
		if errors.Is(destErr, pgx.ErrNoRows) {
			destID = money.NewID("prd")
			destStock = qty
			if _, err := tx.Exec(ctx, `
				INSERT INTO inventory.products
				(id, code, name, category, warehouse_id, warehouse_name, supplier_id, supplier_name, cost_price, sale_price, tax_pct, stock, min_stock, lot_code, expiry_date)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
			`, destID, prod.Code, prod.Name, prod.Category, targetWh.ID, targetWh.Name, prod.SupplierID, prod.SupplierName, prod.CostPrice, prod.SalePrice, prod.TaxPct, destStock, prod.MinStock, prod.LotCode, prod.ExpiryDate); err != nil {
				return nil, apperr.Internal(err.Error())
			}
		} else if destErr != nil {
			return nil, apperr.Internal(destErr.Error())
		} else {
			destStock = money.RoundCents(destStock + qty)
			if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1 WHERE id = $2`, destStock, destID); err != nil {
				return nil, apperr.Internal(err.Error())
			}
		}

		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          now,
			Type:          domain.MovementTrasladoBodega,
			ProductID:     destID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   targetWh.ID,
			WarehouseName: targetWh.Name,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  destStock,
			Reference:     note,
			Actor:         actor,
		}); err != nil {
			return nil, err
		}
	}

	if err := saveIdemTx(ctx, tx, "transfer:"+idemKey, prod); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return prod, nil
}

func (r *Repository) CreateWarehouse(ctx context.Context, dbName, idemKey string, in domain.CreateWarehouseInput) (*domain.Warehouse, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.Warehouse](ctx, tx, "wh:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	wh, err := domain.NewWarehouse(money.NewID("wh"), code, in)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO inventory.warehouses (id, code, name, location, manager) VALUES ($1,$2,$3,$4,$5)`,
		wh.ID, wh.Code, wh.Name, wh.Location, wh.Manager); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if err := saveIdemTx(ctx, tx, "wh:"+idemKey, wh); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return wh, nil
}

func (r *Repository) CreateSupplyRequest(ctx context.Context, dbName, idemKey string, in domain.CreateSupplyRequestInput, _ string) (*domain.SupplyRequest, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cached, ok, err := checkIdemTx[*domain.SupplyRequest](ctx, tx, "req:"+idemKey); err != nil {
		return nil, err
	} else if ok && cached != nil {
		return cached, nil
	}

	var resolvedName string
	if strings.TrimSpace(in.ProductID) != "" {
		_ = tx.QueryRow(ctx, `SELECT name FROM inventory.products WHERE id = $1`, strings.TrimSpace(in.ProductID)).Scan(&resolvedName)
	}
	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.RequestSeqPrefix, domain.RequestSeqStart)
	if err != nil {
		return nil, apperr.Internal(err.Error())
	}
	req, err := domain.NewSupplyRequest(money.NewID("req"), code, nowDateStr(), in, resolvedName)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO inventory.supply_requests (id, code, req_date, area, product_id, product_name, qty, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		req.ID, req.Code, req.Date, req.Area, req.ProductID, req.ProductName, req.Qty, req.Status, req.Notes); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	if err := saveIdemTx(ctx, tx, "req:"+idemKey, req); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err.Error())
	}
	return req, nil
}

func (r *Repository) QuoteProducts(ctx context.Context, dbName string, productIDs []string) ([]domain.ProductQuote, error) {
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return nil, err
	}
	quotes := make([]domain.ProductQuote, 0, len(productIDs))
	for _, pid := range productIDs {
		var q domain.ProductQuote
		err := pool.QueryRow(ctx, `
			SELECT id, code, name, sale_price::FLOAT8, tax_pct::FLOAT8, stock::FLOAT8
			FROM inventory.products
			WHERE id = $1 OR UPPER(code) = UPPER($1)
			ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END, stock DESC, created_at ASC
			LIMIT 1
		`, strings.TrimSpace(pid)).Scan(&q.ProductID, &q.Code, &q.Name, &q.SalePrice, &q.TaxPct, &q.AvailableStock)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("Producto no encontrado en inventario: " + pid)
		}
		if err != nil {
			return nil, apperr.Internal(err.Error())
		}
		quotes = append(quotes, q)
	}
	return quotes, nil
}

func sortedKeys(m map[string]float64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func (r *Repository) DeductStock(ctx context.Context, dbName, idemKey string, items []domain.StockDeltaItem, defaultActor string) (int, error) {
	normalized, required, err := domain.ValidateDeductItems(items)
	if err != nil {
		return 0, err
	}
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return 0, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cnt, ok, err := checkIdemTx[int](ctx, tx, "deduct:"+idemKey); err != nil {
		return 0, err
	} else if ok {
		return cnt, nil
	}

	// Lock products in deterministic sorted order to prevent deadlocks under concurrent POS load
	locked := make(map[string]*domain.Product, len(required))
	for _, pid := range sortedKeys(required) {
		p, lockErr := lockProductTx(ctx, tx, pid)
		if lockErr != nil {
			return 0, lockErr
		}
		if money.RoundCents(p.Stock-required[pid]) < 0 {
			return 0, apperr.Conflict("Stock insuficiente para " + p.Name)
		}
		locked[pid] = p
		locked[p.ID] = p
	}

	now := nowDateStr()
	for _, it := range normalized {
		p := locked[it.ProductID]
		p.Stock = money.RoundCents(p.Stock - it.Quantity)
		if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1 WHERE id = $2`, p.Stock, p.ID); err != nil {
			return 0, apperr.Internal(err.Error())
		}
		actor := it.Actor
		if actor == "" {
			actor = defaultActor
		}
		ref := it.ReferenceDoc
		if ref == "" {
			ref = "VENTA POS"
		}
		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          now,
			Type:          domain.MovementSalidaVenta,
			ProductID:     p.ID,
			ProductCode:   p.Code,
			ProductName:   p.Name,
			WarehouseID:   p.WarehouseID,
			WarehouseName: p.WarehouseName,
			Qty:           it.Quantity,
			UnitCost:      p.CostPrice,
			BalanceAfter:  p.Stock,
			Reference:     ref,
			Actor:         actor,
		}); err != nil {
			return 0, err
		}
	}
	if err := saveIdemTx(ctx, tx, "deduct:"+idemKey, len(normalized)); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, apperr.Internal(err.Error())
	}
	return len(normalized), nil
}

func (r *Repository) RestockItems(ctx context.Context, dbName, idemKey string, items []domain.StockDeltaItem, defaultActor string) (int, error) {
	normalized, err := domain.ValidateRestockItems(items)
	if err != nil {
		return 0, err
	}
	pool, err := r.poolFor(ctx, dbName)
	if err != nil {
		return 0, err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, apperr.Internal(err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if cnt, ok, err := checkIdemTx[int](ctx, tx, "restock-batch:"+idemKey); err != nil {
		return 0, err
	} else if ok {
		return cnt, nil
	}

	unique := make(map[string]float64, len(normalized))
	for _, it := range normalized {
		unique[it.ProductID] = 1
	}
	locked := make(map[string]*domain.Product, len(unique))
	for _, pid := range sortedKeys(unique) {
		p, lockErr := lockProductTx(ctx, tx, pid)
		if lockErr != nil {
			return 0, lockErr
		}
		locked[pid] = p
		locked[p.ID] = p
	}

	now := nowDateStr()
	for _, it := range normalized {
		p := locked[it.ProductID]
		inQty, effCost, applyErr := domain.ApplyProductRestock(p, it.Quantity, it.UnitCost, "", "")
		if applyErr != nil {
			return 0, applyErr
		}
		if _, err := tx.Exec(ctx, `UPDATE inventory.products SET stock = $1, cost_price = $2 WHERE id = $3`, p.Stock, p.CostPrice, p.ID); err != nil {
			return 0, apperr.Internal(err.Error())
		}
		actor := it.Actor
		if actor == "" {
			actor = defaultActor
		}
		ref := it.ReferenceDoc
		if ref == "" {
			ref = "ENTRADA INVENTARIO"
		}
		if err := insertKardexTx(ctx, tx, &domain.KardexMovement{
			Date:          now,
			Type:          it.MovementType,
			ProductID:     p.ID,
			ProductCode:   p.Code,
			ProductName:   p.Name,
			WarehouseID:   p.WarehouseID,
			WarehouseName: p.WarehouseName,
			Qty:           inQty,
			UnitCost:      effCost,
			BalanceAfter:  p.Stock,
			Reference:     ref,
			Actor:         actor,
		}); err != nil {
			return 0, err
		}
	}
	if err := saveIdemTx(ctx, tx, "restock-batch:"+idemKey, len(normalized)); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, apperr.Internal(err.Error())
	}
	return len(normalized), nil
}
