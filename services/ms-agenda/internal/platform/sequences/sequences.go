package sequences

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	validSchemaIdent = regexp.MustCompile("^[a-z][a-z0-9_]{1,40}$")
	ensuredSchemas   sync.Map
)

type Querier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type txWithConn interface {
	Conn() *pgx.Conn
}

func databaseCacheKey(q Querier, schemaName string) string {
	switch v := q.(type) {
	case *pgxpool.Pool:
		if cfg := v.Config(); cfg != nil && cfg.ConnConfig != nil && cfg.ConnConfig.Database != "" {
			return cfg.ConnConfig.Database + "." + schemaName
		}
	case txWithConn:
		if conn := v.Conn(); conn != nil && conn.Config() != nil && conn.Config().Database != "" {
			return conn.Config().Database + "." + schemaName
		}
	}
	return ""
}

func EnsureTableSQL(ctx context.Context, q Querier, schemaName string) error {
	if q == nil {
		return errors.New("nil sql querier")
	}
	if !validSchemaIdent.MatchString(schemaName) {
		return fmt.Errorf("invalid schema identifier: %s", schemaName)
	}
	cacheKey := databaseCacheKey(q, schemaName)
	if cacheKey != "" {
		if _, ok := ensuredSchemas.Load(cacheKey); ok {
			return nil
		}
	}
	tbl := pgx.Identifier{schemaName, "seq_counters"}.Sanitize()
	if _, err := q.Exec(ctx, fmt.Sprintf("CREATE TABLE IF NOT EXISTS %s (prefix VARCHAR(32) PRIMARY KEY, current_val INTEGER NOT NULL)", tbl)); err != nil {
		return err
	}
	if cacheKey != "" {
		ensuredSchemas.Store(cacheKey, true)
	}
	return nil
}

func NextSQL(ctx context.Context, q Querier, schemaName, prefix string, baseStart int) (string, error) {
	if err := EnsureTableSQL(ctx, q, schemaName); err != nil {
		return "", err
	}
	tbl := pgx.Identifier{schemaName, "seq_counters"}.Sanitize()
	query := fmt.Sprintf(
		"INSERT INTO %s (prefix, current_val) VALUES ($1, $2 + 1) ON CONFLICT (prefix) DO UPDATE SET current_val = GREATEST(%s.current_val, $2) + 1 RETURNING current_val",
		tbl, tbl,
	)
	var val int
	if err := q.QueryRow(ctx, query, prefix, baseStart).Scan(&val); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%d", prefix, val), nil
}

func PeekSQL(ctx context.Context, q Querier, schemaName, prefix string, baseStart int) (string, error) {
	if err := EnsureTableSQL(ctx, q, schemaName); err != nil {
		return "", err
	}
	tbl := pgx.Identifier{schemaName, "seq_counters"}.Sanitize()
	query := fmt.Sprintf("SELECT current_val FROM %s WHERE prefix = $1", tbl)
	var val int
	err := q.QueryRow(ctx, query, prefix).Scan(&val)
	if errors.Is(err, pgx.ErrNoRows) {
		val = baseStart
	} else if err != nil {
		return "", err
	}
	if val < baseStart {
		val = baseStart
	}
	return fmt.Sprintf("%s-%d", prefix, val+1), nil
}

type MemoryGenerator struct {
	mu       sync.Mutex
	counters map[string]int
}

func NewMemory() *MemoryGenerator {
	return &MemoryGenerator{counters: make(map[string]int)}
}

func (g *MemoryGenerator) Next(dbName, prefix string, baseStart int) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := dbName + ":" + prefix
	cur, ok := g.counters[key]
	if !ok || cur < baseStart {
		cur = baseStart
	}
	cur++
	g.counters[key] = cur
	return fmt.Sprintf("%s-%d", prefix, cur)
}

func (g *MemoryGenerator) Peek(dbName, prefix string, baseStart int) string {
	g.mu.Lock()
	defer g.mu.Unlock()
	key := dbName + ":" + prefix
	cur, ok := g.counters[key]
	if !ok || cur < baseStart {
		cur = baseStart
	}
	return fmt.Sprintf("%s-%d", prefix, cur+1)
}
