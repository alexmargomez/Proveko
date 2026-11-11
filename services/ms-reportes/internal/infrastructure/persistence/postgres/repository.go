package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-reportes/internal/platform/dbpool"
	"ms-reportes/internal/platform/sequences"
	"ms-reportes/internal/domain"
	"ms-reportes/migrations"
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
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-reportes", migrations.SchemaSQL)
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

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-reportes::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM reporting.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
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
	rptCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO reporting.executive_snapshots (
			id, code, total_sales, total_collected, total_pending_receivables,
			total_expenses, net_operating_profit, inventory_cost_value, inventory_sale_value,
			low_stock_count, customers_count, notes, created_by, created_at
		) VALUES (
			$1, $1, 6450000, 5120000, 1330000,
			1480000, 4970000, 8920000, 13450000,
			2, 4, 'Corte ejecutivo inicial de referencia', 'gerencia', $2
		) ON CONFLICT DO NOTHING
	`, rptCode1, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO reporting.seq_counters (prefix, current_val) VALUES ($1, 1)
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

func (r *Repository) ListSnapshots(ctx context.Context, dbName string) (*domain.SnapshotsState, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}

	nextCode, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)
	if err != nil {
		return nil, err
	}

	rows, err := p.Query(ctx, `
		SELECT id, code, total_sales::float8, total_collected::float8, total_pending_receivables::float8,
		       total_expenses::float8, net_operating_profit::float8, inventory_cost_value::float8,
		       inventory_sale_value::float8, low_stock_count, customers_count, notes, created_by, created_at
		FROM reporting.executive_snapshots
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	snapshots := []*domain.ExecutiveSnapshot{}
	for rows.Next() {
		var item domain.ExecutiveSnapshot
		if err := rows.Scan(
			&item.ID, &item.Code, &item.TotalSales, &item.TotalCollected, &item.TotalPendingReceivables,
			&item.TotalExpenses, &item.NetOperatingProfit, &item.InventoryCostValue,
			&item.InventorySaleValue, &item.LowStockCount, &item.CustomersCount,
			&item.Notes, &item.CreatedBy, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		snapshots = append(snapshots, &item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &domain.SnapshotsState{
		NextCode:         nextCode,
		NextSnapshotCode: nextCode,
		Snapshots:        snapshots,
	}, nil
}

func (r *Repository) CreateSnapshot(ctx context.Context, dbName, idemKey, createdBy string, in domain.CreateSnapshotInput) (*domain.ExecutiveSnapshot, error) {
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
			SELECT response_json FROM reporting.idempotency_keys
			WHERE scope = 'snapshot' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.ExecutiveSnapshot
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewExecutiveSnapshot("TMP", createdBy, in, now); err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)
	if err != nil {
		return nil, err
	}
	snap, err := domain.NewExecutiveSnapshot(code, createdBy, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO reporting.executive_snapshots (
			id, code, total_sales, total_collected, total_pending_receivables,
			total_expenses, net_operating_profit, inventory_cost_value, inventory_sale_value,
			low_stock_count, customers_count, notes, created_by, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`,
		snap.ID, snap.Code, snap.TotalSales, snap.TotalCollected, snap.TotalPendingReceivables,
		snap.TotalExpenses, snap.NetOperatingProfit, snap.InventoryCostValue, snap.InventorySaleValue,
		snap.LowStockCount, snap.CustomersCount, snap.Notes, snap.CreatedBy, snap.CreatedAt,
	); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(snap)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO reporting.idempotency_keys (scope, idem_key, response_json)
			VALUES ('snapshot', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return snap, nil
}
