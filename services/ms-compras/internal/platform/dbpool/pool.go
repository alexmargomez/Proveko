package dbpool

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/config"
)

const defaultMaxTenantPools = 16

var strictTenantDBRegex = regexp.MustCompile("^db_[a-z0-9_]{3,50}$")

type Manager struct {
	cfg               config.CommonConfig
	allowProvisioning bool
	maxPools          int
	mu                sync.RWMutex
	openMu            sync.Mutex
	pools             map[string]*pgxpool.Pool
	lastUsed          map[string]time.Time
	migrated          map[string]bool
}

func NewManager(cfg config.CommonConfig, allowProvisioning bool) *Manager {
	maxP := cfg.MaxTenantPools
	if maxP <= 0 {
		maxP = defaultMaxTenantPools
	}
	return &Manager{
		cfg:               cfg,
		allowProvisioning: allowProvisioning,
		maxPools:          maxP,
		pools:             make(map[string]*pgxpool.Pool),
		lastUsed:          make(map[string]time.Time),
		migrated:          make(map[string]bool),
	}
}

func BuildUniqueTenantDBName(rawName string, extra ...string) (string, error) {
	combined := rawName
	if len(extra) > 0 && strings.TrimSpace(extra[0]) != "" {
		combined = rawName + "_" + extra[0]
	}
	slug := normalizeSlug(combined)
	if slug == "" {
		slug = "empresa"
	}
	if len(slug) > 34 {
		slug = strings.Trim(slug[:34], "_")
	}
	suffixBytes := make([]byte, 3)
	if _, err := rand.Read(suffixBytes); err != nil {
		return "", err
	}
	candidate := fmt.Sprintf("db_%s_%s", slug, hex.EncodeToString(suffixBytes))
	if !strictTenantDBRegex.MatchString(candidate) {
		return "", apperr.Validation("Nombre de base de datos de empresa inválido")
	}
	return candidate, nil
}

func SanitizeTenantDBName(raw string) (string, error) {
	rawTrim := strings.TrimSpace(raw)
	if strings.ContainsAny(rawTrim, ";'\"\\--/* ") {
		return "", apperr.Validation("Identificador de base de datos rechazado por caracteres no permitidos")
	}
	clean := normalizeSlug(rawTrim)
	if !strings.HasPrefix(clean, "db_") {
		clean = "db_" + clean
	}
	if len(clean) > 50 {
		clean = strings.Trim(clean[:50], "_")
	}
	if !strictTenantDBRegex.MatchString(clean) {
		return "", apperr.Validation(fmt.Sprintf("Identificador de base de datos rechazado: %s", raw))
	}
	return clean, nil
}

func normalizeSlug(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(raw)) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_':
			b.WriteRune(r)
		default:
			b.WriteRune('_')
		}
	}
	clean := b.String()
	for strings.Contains(clean, "__") {
		clean = strings.ReplaceAll(clean, "__", "_")
	}
	return strings.Trim(clean, "_")
}

func ValidateOrderByColumn(requested string, whitelist map[string]string, defaultCol string) string {
	if safe, ok := whitelist[strings.ToLower(strings.TrimSpace(requested))]; ok {
		return safe
	}
	return defaultCol
}

func (m *Manager) HasPostgres() bool {
	return strings.TrimSpace(m.cfg.DBHost) != ""
}

func (m *Manager) CreateDatabaseIfAllowed(ctx context.Context, rawDBName string, requireNew bool) (string, error) {
	cleanDB, err := SanitizeTenantDBName(rawDBName)
	if err != nil {
		return "", err
	}
	if !m.allowProvisioning {
		return "", apperr.Forbidden("Este microservicio no tiene privilegios de aprovisionamiento de bases de datos")
	}
	if !m.HasPostgres() {
		return cleanDB, nil
	}

	ctxT, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	adminPool, err := m.getOrOpenPool(ctxT, m.cfg.ControlDB)
	if err != nil {
		return "", err
	}

	var exists bool
	if err := adminPool.QueryRow(ctxT, `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)`, cleanDB).Scan(&exists); err != nil {
		return "", err
	}
	if exists {
		if requireNew {
			return "", apperr.Conflict("La base de datos asignada ya existe en el clúster")
		}
		return cleanDB, nil
	}
	quoted := pgx.Identifier{cleanDB}.Sanitize()
	if _, err := adminPool.Exec(ctxT, "CREATE DATABASE "+quoted); err != nil {
		return "", err
	}
	return cleanDB, nil
}

func (m *Manager) OpenControlPool(ctx context.Context, schemaDDL string) (*pgxpool.Pool, error) {
	if !m.HasPostgres() {
		return nil, errors.New("postgres host not configured")
	}
	pool, err := m.getOrOpenPool(ctx, m.cfg.ControlDB)
	if err != nil {
		return nil, err
	}
	if err := m.ensureMigrated(ctx, pool, m.cfg.ControlDB+"::ms-core", schemaDDL); err != nil {
		return nil, err
	}
	return pool, nil
}

func (m *Manager) OpenServicePool(ctx context.Context, dbName, serviceKey, schemaDDL string) (*pgxpool.Pool, error) {
	cleanDB, err := SanitizeTenantDBName(dbName)
	if err != nil {
		return nil, err
	}
	if !m.HasPostgres() {
		return nil, errors.New("postgres host not configured")
	}
	pool, err := m.getOrOpenPool(ctx, cleanDB)
	if err != nil {
		return nil, err
	}
	if err := m.ensureMigrated(ctx, pool, cleanDB+"::"+serviceKey, schemaDDL); err != nil {
		return nil, err
	}
	return pool, nil
}

func (m *Manager) ensureMigrated(ctx context.Context, pool *pgxpool.Pool, migKey, schemaDDL string) error {
	if strings.TrimSpace(schemaDDL) == "" {
		return nil
	}
	m.mu.RLock()
	done := m.migrated[migKey]
	m.mu.RUnlock()
	if done {
		return nil
	}

	m.openMu.Lock()
	defer m.openMu.Unlock()

	m.mu.RLock()
	done = m.migrated[migKey]
	m.mu.RUnlock()
	if done {
		return nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, migKey); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, schemaDDL); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	m.mu.Lock()
	m.migrated[migKey] = true
	m.mu.Unlock()
	return nil
}

func (m *Manager) getOrOpenPool(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	now := time.Now()
	m.mu.Lock()
	if existing, ok := m.pools[dbName]; ok {
		m.lastUsed[dbName] = now
		m.mu.Unlock()
		return existing, nil
	}
	m.mu.Unlock()

	m.openMu.Lock()
	defer m.openMu.Unlock()

	m.mu.Lock()
	if existing, ok := m.pools[dbName]; ok {
		m.lastUsed[dbName] = now
		m.mu.Unlock()
		return existing, nil
	}
	m.mu.Unlock()

	dsn := m.cfg.BuildDSN(dbName)
	if dsn == "" {
		return nil, errors.New("empty postgres dsn")
	}
	pCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	pCfg.MaxConns = 2
	pCfg.MinConns = 0
	pCfg.MaxConnIdleTime = 30 * time.Second
	pCfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	pool, err := pgxpool.NewWithConfig(ctx, pCfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	var evicted *pgxpool.Pool
	m.mu.Lock()
	if len(m.pools) >= m.maxPools {
		var oldestKey string
		var oldestTime time.Time
		for k, ts := range m.lastUsed {
			if k == m.cfg.ControlDB {
				continue
			}
			if oldestKey == "" || ts.Before(oldestTime) {
				oldestKey = k
				oldestTime = ts
			}
		}
		if oldestKey != "" {
			evicted = m.pools[oldestKey]
			delete(m.pools, oldestKey)
			delete(m.lastUsed, oldestKey)
		}
	}
	m.pools[dbName] = pool
	m.lastUsed[dbName] = now
	m.mu.Unlock()

	if evicted != nil {
		toClose := evicted
		time.AfterFunc(30*time.Second, func() {
			toClose.Close()
		})
	}
	return pool, nil
}

func (m *Manager) Close() {
	m.openMu.Lock()
	defer m.openMu.Unlock()

	m.mu.Lock()
	pools := make([]*pgxpool.Pool, 0, len(m.pools))
	for k, p := range m.pools {
		pools = append(pools, p)
		delete(m.pools, k)
		delete(m.lastUsed, k)
	}
	m.mu.Unlock()

	for _, p := range pools {
		p.Close()
	}
}
