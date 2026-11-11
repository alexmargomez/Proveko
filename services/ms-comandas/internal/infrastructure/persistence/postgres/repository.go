package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/dbpool"
	"ms-comandas/internal/platform/sequences"
	"ms-comandas/internal/domain"
	"ms-comandas/migrations"
)

const (
	schemaName   = "gastro"
	serviceKey   = "ms-comandas"
	baseTableSeq = 104
	baseMenuSeq  = 205
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
		SELECT EXISTS(SELECT 1 FROM gastro.dining_tables)
		    OR EXISTS(SELECT 1 FROM gastro.menu_items)
	`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.menu_items (id, code, name, category, sale_price, tax_pct)
			VALUES
				('mnu-201', 'MNU-201', 'Punta de Anca a la Parrilla 350g', 'Restaurante — Fuertes', 48000, 8),
				('mnu-202', 'MNU-202', 'Salmón Sellado en Mantequilla de Finas Hierbas', 'Restaurante — Fuertes', 52000, 8),
				('mnu-203', 'MNU-203', 'Ceviche Clásico de Camarón', 'Restaurante — Entradas', 32000, 8),
				('mnu-204', 'MNU-204', 'Limonada de Coco Natural', 'Barra y Bebidas', 12000, 8),
				('mnu-205', 'MNU-205', 'Café Espresso Doble Origen', 'Barra y Bebidas', 8500, 8)
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.dining_tables (id, name, zone, waiter, status, total)
			VALUES
				('tbl-101', 'Mesa 1', 'Salón Principal', 'Camila Restrepo', 'En Cocina', 120000),
				('tbl-102', 'Mesa 2', 'Terraza', 'Andrés Mejía', 'Ocupada', 32000),
				('tbl-103', 'Mesa 3', 'Salón Principal', 'Camila Restrepo', 'Libre', 0),
				('tbl-104', 'Barra 1', 'Barra', 'Andrés Mejía', 'Libre', 0)
			ON CONFLICT (id) DO NOTHING
		`); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.table_items (item_id, table_id, product_id, name, qty, price, note)
			VALUES
				('itm-seed-101a', 'tbl-101', 'mnu-201', 'Punta de Anca a la Parrilla 350g', 2, 48000, 'Término 3/4'),
				('itm-seed-101b', 'tbl-101', 'mnu-204', 'Limonada de Coco Natural', 2, 12000, ''),
				('itm-seed-102a', 'tbl-102', 'mnu-203', 'Ceviche Clásico de Camarón', 1, 32000, 'Sin cebolla roja')
			ON CONFLICT (item_id) DO NOTHING
		`); err != nil {
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

func (r *Repository) GetState(ctx context.Context, dbName string) (domain.GastroState, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.GastroState{}, err
	}

	nextMenu, err := sequences.PeekSQL(ctx, pool, schemaName, "MNU", baseMenuSeq)
	if err != nil {
		return domain.GastroState{}, err
	}

	menuRows, err := pool.Query(ctx, `
		SELECT id, code, name, category, sale_price::float8, tax_pct::float8
		FROM gastro.menu_items
		ORDER BY code ASC
	`)
	if err != nil {
		return domain.GastroState{}, err
	}
	defer menuRows.Close()

	menu := []domain.MenuItem{}
	for menuRows.Next() {
		var m domain.MenuItem
		if err := menuRows.Scan(&m.ID, &m.Code, &m.Name, &m.Category, &m.SalePrice, &m.TaxPct); err != nil {
			return domain.GastroState{}, err
		}
		menu = append(menu, m)
	}
	if err := menuRows.Err(); err != nil {
		return domain.GastroState{}, err
	}

	tRows, err := pool.Query(ctx, `
		SELECT id, name, zone, waiter, status, total::float8
		FROM gastro.dining_tables
		ORDER BY id ASC
	`)
	if err != nil {
		return domain.GastroState{}, err
	}
	defer tRows.Close()

	tables := []domain.DiningTable{}
	idxByID := make(map[string]int)
	for tRows.Next() {
		var t domain.DiningTable
		if err := tRows.Scan(&t.ID, &t.Name, &t.Zone, &t.Waiter, &t.Status, &t.Total); err != nil {
			return domain.GastroState{}, err
		}
		t.Items = []domain.OrderItem{}
		idxByID[t.ID] = len(tables)
		tables = append(tables, t)
	}
	if err := tRows.Err(); err != nil {
		return domain.GastroState{}, err
	}

	itRows, err := pool.Query(ctx, `
		SELECT item_id, table_id, product_id, name, qty::float8, price::float8, note
		FROM gastro.table_items
		ORDER BY sort_order ASC, item_id ASC
	`)
	if err != nil {
		return domain.GastroState{}, err
	}
	defer itRows.Close()

	for itRows.Next() {
		var (
			tableID string
			it      domain.OrderItem
		)
		if err := itRows.Scan(&it.ItemID, &tableID, &it.ProductID, &it.Name, &it.Qty, &it.Price, &it.Note); err != nil {
			return domain.GastroState{}, err
		}
		if pos, ok := idxByID[tableID]; ok {
			tables[pos].Items = append(tables[pos].Items, it)
		}
	}
	if err := itRows.Err(); err != nil {
		return domain.GastroState{}, err
	}

	return domain.GastroState{
		NextMenuCode: nextMenu,
		Tables:       tables,
		Products:     menu,
	}, nil
}

func loadTableForUpdate(ctx context.Context, tx pgx.Tx, tableID string) (domain.DiningTable, error) {
	var t domain.DiningTable
	err := tx.QueryRow(ctx, `
		SELECT id, name, zone, waiter, status, total::float8
		FROM gastro.dining_tables
		WHERE id = $1
		FOR UPDATE
	`, tableID).Scan(&t.ID, &t.Name, &t.Zone, &t.Waiter, &t.Status, &t.Total)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
	}
	if err != nil {
		return domain.DiningTable{}, err
	}

	rows, err := tx.Query(ctx, `
		SELECT item_id, product_id, name, qty::float8, price::float8, note
		FROM gastro.table_items
		WHERE table_id = $1
		ORDER BY sort_order ASC, item_id ASC
	`, t.ID)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer rows.Close()

	t.Items = []domain.OrderItem{}
	for rows.Next() {
		var it domain.OrderItem
		if err := rows.Scan(&it.ItemID, &it.ProductID, &it.Name, &it.Qty, &it.Price, &it.Note); err != nil {
			return domain.DiningTable{}, err
		}
		t.Items = append(t.Items, it)
	}
	if err := rows.Err(); err != nil {
		return domain.DiningTable{}, err
	}
	return t, nil
}

func (r *Repository) CreateTable(ctx context.Context, dbName, idemKey string, in domain.CreateTableInput) (domain.DiningTable, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "tbl:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.DiningTable
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "TBL", baseTableSeq)
	if err != nil {
		return domain.DiningTable{}, err
	}
	tbl, err := domain.BuildDiningTable(code, in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO gastro.dining_tables (id, name, zone, waiter, status, total)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, tbl.ID, tbl.Name, tbl.Zone, tbl.Waiter, tbl.Status, tbl.Total); err != nil {
		return domain.DiningTable{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(tbl)
		if err != nil {
			return domain.DiningTable{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "tbl:"+cleanKey, raw); err != nil {
			return domain.DiningTable{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) CreateMenuItem(ctx context.Context, dbName, idemKey string, in domain.CreateMenuItemInput) (domain.MenuItem, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.MenuItem{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.MenuItem{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "mnu:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.MenuItem
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.MenuItem{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "MNU", baseMenuSeq)
	if err != nil {
		return domain.MenuItem{}, err
	}
	item, err := domain.BuildMenuItem(code, in)
	if err != nil {
		return domain.MenuItem{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO gastro.menu_items (id, code, name, category, sale_price, tax_pct)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, item.ID, item.Code, item.Name, item.Category, item.SalePrice, item.TaxPct); err != nil {
		return domain.MenuItem{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(item)
		if err != nil {
			return domain.MenuItem{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "mnu:"+cleanKey, raw); err != nil {
			return domain.MenuItem{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.MenuItem{}, err
	}
	return item, nil
}

func (r *Repository) AddItemToTable(ctx context.Context, dbName, idemKey, tableID string, in domain.AddOrderItemInput) (domain.DiningTable, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "add:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.DiningTable
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	if in.ProductID != "" && (strings.TrimSpace(in.Name) == "" || in.Price <= 0) {
		var mName string
		var mPrice float64
		err := tx.QueryRow(ctx, `
			SELECT name, sale_price::float8
			FROM gastro.menu_items
			WHERE id = $1 OR lower(code) = lower($1)
		`, in.ProductID).Scan(&mName, &mPrice)
		if err == nil {
			if strings.TrimSpace(in.Name) == "" {
				in.Name = mName
			}
			if in.Price <= 0 {
				in.Price = mPrice
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	tbl, err := loadTableForUpdate(ctx, tx, tableID)
	if err != nil {
		return domain.DiningTable{}, err
	}

	changedItem, merged, err := tbl.AddOrMergeItem(in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	if merged {
		if _, err := tx.Exec(ctx, `
			UPDATE gastro.table_items
			SET qty = $1, price = $2
			WHERE item_id = $3 AND table_id = $4
		`, changedItem.Qty, changedItem.Price, changedItem.ItemID, tbl.ID); err != nil {
			return domain.DiningTable{}, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.table_items (item_id, table_id, product_id, name, qty, price, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, changedItem.ItemID, tbl.ID, changedItem.ProductID, changedItem.Name, changedItem.Qty, changedItem.Price, changedItem.Note); err != nil {
			return domain.DiningTable{}, err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, total = $2, updated_at = NOW()
		WHERE id = $3
	`, tbl.Status, tbl.Total, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(tbl)
		if err != nil {
			return domain.DiningTable{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "add:"+cleanKey, raw); err != nil {
			return domain.DiningTable{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) RemoveItemFromTable(ctx context.Context, dbName, tableID, itemID string) (domain.DiningTable, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tbl, err := loadTableForUpdate(ctx, tx, tableID)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := tbl.RemoveItem(itemID); err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM gastro.table_items WHERE table_id = $1 AND item_id = $2`, tbl.ID, itemID); err != nil {
		return domain.DiningTable{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, total = $2, updated_at = NOW()
		WHERE id = $3
	`, tbl.Status, tbl.Total, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) SendToKitchen(ctx context.Context, dbName, tableID string) (domain.DiningTable, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tbl, err := loadTableForUpdate(ctx, tx, tableID)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := tbl.SendToKitchen(); err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`, tbl.Status, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) MarkReady(ctx context.Context, dbName, tableID string) (domain.DiningTable, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tbl, err := loadTableForUpdate(ctx, tx, tableID)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := tbl.MarkReady(); err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, updated_at = NOW()
		WHERE id = $2
	`, tbl.Status, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) ClearInvoicedTable(ctx context.Context, dbName, idemKey, tableID, _ string) (bool, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return false, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "clr:"+cleanKey).Scan(&raw)
		if err == nil {
			return true, nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return false, err
		}
	}

	var matchedID string
	err = tx.QueryRow(ctx, `
		SELECT id FROM gastro.dining_tables
		WHERE id = $1 OR lower(name) = lower($1)
		FOR UPDATE
	`, tableID).Scan(&matchedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, apperr.NotFound("Mesa no encontrada")
	}
	if err != nil {
		return false, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM gastro.table_items WHERE table_id = $1`, matchedID); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, total = 0, updated_at = NOW()
		WHERE id = $2
	`, domain.StatusLibre, matchedID); err != nil {
		return false, err
	}

	if cleanKey != "" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json)
			VALUES ($1, '{"ok":true}'::jsonb)
			ON CONFLICT (idem_key) DO NOTHING
		`, "clr:"+cleanKey); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
