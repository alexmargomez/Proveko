package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-comandas/internal/domain"
	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/dbpool"
	"ms-comandas/internal/platform/sequences"
	"ms-comandas/migrations"
)

const (
	schemaName = "gastro"
	serviceKey = "ms-comandas"
	demoDBName = "db_demo_empresa"
)

func isDemo(dbName string) bool {
	return strings.TrimSpace(dbName) == demoDBName
}

func tableSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseTableSeq
	}
	return domain.BaseTableSeq
}

func menuSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseMenuSeq
	}
	return domain.BaseMenuSeq
}

func orderSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseOrderSeq
	}
	return domain.BaseOrderSeq
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

	if isDemo(dbName) {
		var hasLiveCodes bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM gastro.dining_tables WHERE order_code <> '')
		`).Scan(&hasLiveCodes); err != nil {
			return nil, err
		}

		if !hasLiveCodes {
			for _, m := range domain.DemoMenuItems() {
				if _, err := tx.Exec(ctx, `
					INSERT INTO gastro.menu_items (id, code, name, category, sale_price, tax_pct)
					VALUES ($1, $2, $3, $4, $5, $6)
					ON CONFLICT (id) DO NOTHING
				`, m.ID, m.Code, m.Name, m.Category, m.SalePrice, m.TaxPct); err != nil {
					return nil, err
				}
			}

			for _, tbl := range domain.DemoDiningTables() {
				if _, err := tx.Exec(ctx, `
					INSERT INTO gastro.dining_tables (
						id, name, zone, waiter, status, total,
						order_code, channel, order_stage, customer_name, customer_phone,
						delivery_address, guests, payment_hint, opened_at
					)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
					ON CONFLICT (id) DO UPDATE SET
						status = EXCLUDED.status,
						total = EXCLUDED.total,
						order_code = EXCLUDED.order_code,
						channel = EXCLUDED.channel,
						order_stage = EXCLUDED.order_stage,
						customer_name = EXCLUDED.customer_name,
						customer_phone = EXCLUDED.customer_phone,
						delivery_address = EXCLUDED.delivery_address,
						guests = EXCLUDED.guests,
						payment_hint = EXCLUDED.payment_hint,
						opened_at = EXCLUDED.opened_at
					WHERE gastro.dining_tables.order_code = ''
				`,
					tbl.ID, tbl.Name, tbl.Zone, tbl.Waiter, tbl.Status, tbl.Total,
					tbl.OrderCode, tbl.Channel, tbl.OrderStage, tbl.CustomerName, tbl.CustomerPhone,
					tbl.DeliveryAddress, tbl.Guests, tbl.PaymentHint, tbl.OpenedAt,
				); err != nil {
					return nil, err
				}

				for _, it := range tbl.Items {
					if _, err := tx.Exec(ctx, `
						INSERT INTO gastro.table_items (item_id, table_id, product_id, name, qty, price, note)
						VALUES ($1, $2, $3, $4, $5, $6, $7)
						ON CONFLICT (item_id) DO NOTHING
					`, it.ItemID, tbl.ID, it.ProductID, it.Name, it.Qty, it.Price, it.Note); err != nil {
						return nil, err
					}
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

func (r *Repository) GetState(ctx context.Context, dbName string) (domain.GastroState, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.GastroState{}, err
	}

	nextMenu, err := sequences.PeekSQL(ctx, pool, schemaName, "MNU", menuSeqBase(dbName))
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
		SELECT
			id, name, zone, waiter, status, total::float8,
			order_code, channel, order_stage, customer_name, customer_phone,
			delivery_address, guests, payment_hint, opened_at
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
		if err := tRows.Scan(
			&t.ID, &t.Name, &t.Zone, &t.Waiter, &t.Status, &t.Total,
			&t.OrderCode, &t.Channel, &t.OrderStage, &t.CustomerName, &t.CustomerPhone,
			&t.DeliveryAddress, &t.Guests, &t.PaymentHint, &t.OpenedAt,
		); err != nil {
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

	for i := range tables {
		tables[i].NormalizeState()
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
		SELECT
			id, name, zone, waiter, status, total::float8,
			order_code, channel, order_stage, customer_name, customer_phone,
			delivery_address, guests, payment_hint, opened_at
		FROM gastro.dining_tables
		WHERE id = $1
		FOR UPDATE
	`, tableID).Scan(
		&t.ID, &t.Name, &t.Zone, &t.Waiter, &t.Status, &t.Total,
		&t.OrderCode, &t.Channel, &t.OrderStage, &t.CustomerName, &t.CustomerPhone,
		&t.DeliveryAddress, &t.Guests, &t.PaymentHint, &t.OpenedAt,
	)
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
	t.NormalizeState()
	return t, nil
}

func resolveMenuDefaultsSQL(ctx context.Context, tx pgx.Tx, in domain.AddOrderItemInput) (domain.AddOrderItemInput, error) {
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
			return domain.AddOrderItemInput{}, err
		}
	}
	return in, nil
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
		err := tx.QueryRow(ctx, `SELECT response_json::text FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "tbl:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.DiningTable
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "TBL", tableSeqBase(dbName))
	if err != nil {
		return domain.DiningTable{}, err
	}
	tbl, err := domain.BuildDiningTable(code, in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO gastro.dining_tables (
			id, name, zone, waiter, status, total,
			order_code, channel, order_stage, customer_name, customer_phone,
			delivery_address, guests, payment_hint, opened_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`,
		tbl.ID, tbl.Name, tbl.Zone, tbl.Waiter, tbl.Status, tbl.Total,
		tbl.OrderCode, tbl.Channel, tbl.OrderStage, tbl.CustomerName, tbl.CustomerPhone,
		tbl.DeliveryAddress, tbl.Guests, tbl.PaymentHint, tbl.OpenedAt,
	); err != nil {
		return domain.DiningTable{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(tbl)
		if err != nil {
			return domain.DiningTable{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2::jsonb)
			ON CONFLICT (idem_key) DO NOTHING
		`, "tbl:"+cleanKey, string(raw)); err != nil {
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
		err := tx.QueryRow(ctx, `SELECT response_json::text FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "mnu:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.MenuItem
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.MenuItem{}, err
		}
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "MNU", menuSeqBase(dbName))
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
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2::jsonb)
			ON CONFLICT (idem_key) DO NOTHING
		`, "mnu:"+cleanKey, string(raw)); err != nil {
			return domain.MenuItem{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.MenuItem{}, err
	}
	return item, nil
}

func (r *Repository) CreateOrder(ctx context.Context, dbName, idemKey string, in domain.CreateOrderInput) (domain.DiningTable, error) {
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
		err := tx.QueryRow(ctx, `SELECT response_json::text FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "ord:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.DiningTable
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	norm, err := domain.ValidateCreateOrderInput(in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	var result domain.DiningTable

	if norm.Channel == domain.ChannelMesa {
		tbl, err := loadTableForUpdate(ctx, tx, norm.TableID)
		if err != nil {
			return domain.DiningTable{}, err
		}
		ordSeq := ""
		if strings.TrimSpace(tbl.OrderCode) == "" {
			ordSeq, err = sequences.NextSQL(ctx, tx, schemaName, "ORD", orderSeqBase(dbName))
			if err != nil {
				return domain.DiningTable{}, err
			}
		}
		tbl.ApplyTableOrderMetadata(ordSeq, norm)

		for _, rawIt := range norm.Items {
			resolved, err := resolveMenuDefaultsSQL(ctx, tx, rawIt)
			if err != nil {
				return domain.DiningTable{}, err
			}
			changedItem, merged, err := tbl.AddOrMergeItem(resolved)
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
		}

		tbl.OrderStage = domain.StageNueva
		tbl.Status = domain.StatusOcupada

		if _, err := tx.Exec(ctx, `
			UPDATE gastro.dining_tables
			SET
				waiter = $1,
				status = $2,
				total = $3,
				order_code = $4,
				channel = $5,
				order_stage = $6,
				customer_name = $7,
				customer_phone = $8,
				delivery_address = $9,
				guests = $10,
				payment_hint = $11,
				opened_at = $12,
				updated_at = NOW()
			WHERE id = $13
		`,
			tbl.Waiter, tbl.Status, tbl.Total, tbl.OrderCode, tbl.Channel, tbl.OrderStage,
			tbl.CustomerName, tbl.CustomerPhone, tbl.DeliveryAddress, tbl.Guests, tbl.PaymentHint, tbl.OpenedAt,
			tbl.ID,
		); err != nil {
			return domain.DiningTable{}, err
		}
		result = tbl
	} else {
		ordSeq, err := sequences.NextSQL(ctx, tx, schemaName, "ORD", orderSeqBase(dbName))
		if err != nil {
			return domain.DiningTable{}, err
		}
		ticket := domain.BuildStandaloneOrder(ordSeq, norm)
		for _, rawIt := range norm.Items {
			resolved, err := resolveMenuDefaultsSQL(ctx, tx, rawIt)
			if err != nil {
				return domain.DiningTable{}, err
			}
			if _, _, err := ticket.AddOrMergeItem(resolved); err != nil {
				return domain.DiningTable{}, err
			}
		}
		ticket.OrderStage = domain.StageNueva
		ticket.Status = domain.StatusOcupada

		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.dining_tables (
				id, name, zone, waiter, status, total,
				order_code, channel, order_stage, customer_name, customer_phone,
				delivery_address, guests, payment_hint, opened_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		`,
			ticket.ID, ticket.Name, ticket.Zone, ticket.Waiter, ticket.Status, ticket.Total,
			ticket.OrderCode, ticket.Channel, ticket.OrderStage, ticket.CustomerName, ticket.CustomerPhone,
			ticket.DeliveryAddress, ticket.Guests, ticket.PaymentHint, ticket.OpenedAt,
		); err != nil {
			return domain.DiningTable{}, err
		}

		for _, it := range ticket.Items {
			if _, err := tx.Exec(ctx, `
				INSERT INTO gastro.table_items (item_id, table_id, product_id, name, qty, price, note)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, it.ItemID, ticket.ID, it.ProductID, it.Name, it.Qty, it.Price, it.Note); err != nil {
				return domain.DiningTable{}, err
			}
		}
		result = ticket
	}

	if cleanKey != "" {
		raw, err := json.Marshal(result)
		if err != nil {
			return domain.DiningTable{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2::jsonb)
			ON CONFLICT (idem_key) DO NOTHING
		`, "ord:"+cleanKey, string(raw)); err != nil {
			return domain.DiningTable{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return result, nil
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
		err := tx.QueryRow(ctx, `SELECT response_json::text FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "add:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.DiningTable
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.DiningTable{}, err
		}
	}

	in, err = resolveMenuDefaultsSQL(ctx, tx, in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	tbl, err := loadTableForUpdate(ctx, tx, tableID)
	if err != nil {
		return domain.DiningTable{}, err
	}

	changedItem, merged, err := tbl.AddOrMergeItem(in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	if strings.TrimSpace(tbl.OrderCode) == "" {
		ordSeq, err := sequences.NextSQL(ctx, tx, schemaName, "ORD", orderSeqBase(dbName))
		if err != nil {
			return domain.DiningTable{}, err
		}
		tbl.OrderCode = domain.FormatOrderCode(ordSeq)
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
		SET status = $1, order_stage = $2, order_code = $3, opened_at = $4, total = $5, updated_at = NOW()
		WHERE id = $6
	`, tbl.Status, tbl.OrderStage, tbl.OrderCode, tbl.OpenedAt, tbl.Total, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(tbl)
		if err != nil {
			return domain.DiningTable{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO gastro.idempotency_keys (idem_key, response_json) VALUES ($1, $2::jsonb)
			ON CONFLICT (idem_key) DO NOTHING
		`, "add:"+cleanKey, string(raw)); err != nil {
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
		SET status = $1, order_stage = $2, order_code = $3, opened_at = $4, total = $5, updated_at = NOW()
		WHERE id = $6
	`, tbl.Status, tbl.OrderStage, tbl.OrderCode, tbl.OpenedAt, tbl.Total, tbl.ID); err != nil {
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
		SET status = $1, order_stage = $2, updated_at = NOW()
		WHERE id = $3
	`, tbl.Status, tbl.OrderStage, tbl.ID); err != nil {
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
		SET status = $1, order_stage = $2, updated_at = NOW()
		WHERE id = $3
	`, tbl.Status, tbl.OrderStage, tbl.ID); err != nil {
		return domain.DiningTable{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.DiningTable{}, err
	}
	return tbl, nil
}

func (r *Repository) AdvanceStage(ctx context.Context, dbName, tableID, stage string) (domain.DiningTable, error) {
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
	if err := tbl.SetStage(stage); err != nil {
		return domain.DiningTable{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gastro.dining_tables
		SET status = $1, order_stage = $2, updated_at = NOW()
		WHERE id = $3
	`, tbl.Status, tbl.OrderStage, tbl.ID); err != nil {
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
		err := tx.QueryRow(ctx, `SELECT response_json::text FROM gastro.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "clr:"+cleanKey).Scan(&raw)
		if err == nil {
			return true, nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return false, err
		}
	}

	var matchedID string
	var matchedChannel string
	err = tx.QueryRow(ctx, `
		SELECT id, channel FROM gastro.dining_tables
		WHERE id = $1 OR lower(name) = lower($1) OR (order_code <> '' AND lower(order_code) = lower($1))
		FOR UPDATE
	`, tableID).Scan(&matchedID, &matchedChannel)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, apperr.NotFound("Mesa no encontrada")
	}
	if err != nil {
		return false, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM gastro.table_items WHERE table_id = $1`, matchedID); err != nil {
		return false, err
	}

	upperChannel := strings.ToUpper(strings.TrimSpace(matchedChannel))
	if upperChannel == domain.ChannelDomicilio || upperChannel == domain.ChannelParaLlevar {
		if _, err := tx.Exec(ctx, `DELETE FROM gastro.dining_tables WHERE id = $1`, matchedID); err != nil {
			return false, err
		}
	} else {
		if _, err := tx.Exec(ctx, `
			UPDATE gastro.dining_tables
			SET
				status = $1,
				order_stage = $2,
				order_code = '',
				customer_name = '',
				customer_phone = '',
				delivery_address = '',
				payment_hint = '',
				opened_at = '',
				total = 0,
				updated_at = NOW()
			WHERE id = $3
		`, domain.StatusLibre, domain.StageLibre, matchedID); err != nil {
			return false, err
		}
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
