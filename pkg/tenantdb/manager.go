package tenantdb

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/sequences"
	"github.com/jackc/pgx/v5/pgxpool"
)

var validIdentifier = regexp.MustCompile(`^[a-z0-9_]+$`)

type TenantData struct {
	Branding       BrandingConfig             `json:"branding"`
	Tariffs        []Tariff                   `json:"tariffs"`
	Contracts      []Contract                 `json:"contracts"`
	Customers      []Customer                 `json:"customers"`
	Vehicles       []Vehicle                  `json:"vehicles"`
	Drivers        []Driver                   `json:"drivers"`
	Carriers       []Carrier                  `json:"carriers"`
	Suppliers      []Supplier                 `json:"suppliers"`
	Warehouses     []Warehouse                `json:"warehouses"`
	Products       []Product                  `json:"products"`
	Kardex         []KardexMovement           `json:"kardex"`
	Invoices       []Invoice                  `json:"invoices"`
	Expenses       []Expense                  `json:"expenses"`
	Workers        []Worker                   `json:"workers"`
	WorkOrders     []WorkOrder                `json:"workOrders"`
	Settlements    []Settlement               `json:"settlements"`
	DiningTables   []DiningTable              `json:"diningTables"`
	HotelRooms     []HotelRoom                `json:"hotelRooms"`
	CargoRoutes    []CargoRoute               `json:"cargoRoutes"`
	ScaleTickets   []ScaleTicket              `json:"scaleTickets"`
	PucAccounts    []PucAccount               `json:"pucAccounts"`
	GenericModules map[string][]GenericRecord `json:"genericModules"`
}

// Manager administra el aislamiento estricto de 1 Base de Datos PostgreSQL por Cliente (db_<cliente>)
// con pools dinámicos pgxpool y sincronización transaccional + motor en memoria resiliente para tests/demo.
type Manager struct {
	cfg           config.Config
	mu            sync.RWMutex
	stores        map[string]*TenantData
	pools         map[string]*pgxpool.Pool
	migrationsSQL map[string]string
	Seq           *sequences.Generator
}

func NewManager(cfg config.Config) *Manager {
	return &Manager{
		cfg:           cfg,
		stores:        make(map[string]*TenantData),
		pools:         make(map[string]*pgxpool.Pool),
		migrationsSQL: make(map[string]string),
		Seq:           sequences.New(),
	}
}

func SanitizeDBName(raw string) string {
	out := make([]rune, 0, len(raw))
	for _, r := range raw {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '_':
			out = append(out, r)
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
		default:
			out = append(out, '_')
		}
	}
	res := string(out)
	if len(res) < 4 {
		res = "db_cliente_default"
	}
	if len(res) > 54 {
		res = res[:54]
	}
	return res
}

func (m *Manager) RegisterServiceMigration(serviceKey, sqlContent string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.migrationsSQL[serviceKey] = sqlContent
}

// ProvisionClientDatabase ejecuta CREATE DATABASE db_<cliente> en PostgreSQL (si está conectado)
// y corre las migraciones SQL de los microservicios activos únicamente en la BD de ese cliente.
func (m *Manager) ProvisionClientDatabase(ctx context.Context, dbName, companyName string, activeServices []string) error {
	cleanDB := SanitizeDBName(dbName)
	if !validIdentifier.MatchString(cleanDB) {
		return fmt.Errorf("invalid db identifier: %s", cleanDB)
	}

	m.mu.Lock()
	if _, exists := m.stores[cleanDB]; !exists {
		m.stores[cleanDB] = newSeededTenantData(companyName)
	}
	m.mu.Unlock()

	if m.cfg.DBHost == "" {
		return nil
	}

	ctxTimeout, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	adminPool, err := m.getOrOpenPool(ctxTimeout, m.cfg.PostgresDB)
	if err != nil {
		return nil // Continúa en modo resiliente si PostgreSQL aún está levantando
	}

	var exists bool
	_ = adminPool.QueryRow(ctxTimeout, `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)`, cleanDB).Scan(&exists)
	if !exists {
		_, _ = adminPool.Exec(ctxTimeout, fmt.Sprintf(`CREATE DATABASE %s`, cleanDB))
	}

	clientPool, err := m.getOrOpenPool(ctxTimeout, cleanDB)
	if err != nil {
		return nil
	}
	_, _ = clientPool.Exec(ctxTimeout, `CREATE TABLE IF NOT EXISTS public.proveko_state_snapshot (
		id TEXT PRIMARY KEY,
		payload JSONB NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)

	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, svc := range activeServices {
		if sqlDDL, ok := m.migrationsSQL[svc]; ok && sqlDDL != "" {
			_, _ = clientPool.Exec(ctxTimeout, sqlDDL)
		}
	}
	return nil
}

// WithRead accede de forma segura en lectura a la base de datos aislada del cliente (db_<cliente>).
func (m *Manager) WithRead(ctx context.Context, dbName string, fn func(d *TenantData)) {
	cleanDB := SanitizeDBName(dbName)
	m.ensureLoaded(ctx, cleanDB)
	m.mu.RLock()
	defer m.mu.RUnlock()
	fn(m.stores[cleanDB])
}

// WithWrite ejecuta una mutación atómica sobre la base de datos aislada del cliente (db_<cliente>) y persiste en PostgreSQL.
func (m *Manager) WithWrite(ctx context.Context, dbName string, fn func(d *TenantData) error) error {
	cleanDB := SanitizeDBName(dbName)
	m.ensureLoaded(ctx, cleanDB)
	m.mu.Lock()
	data := m.stores[cleanDB]
	err := fn(data)
	var rawSnap []byte
	if err == nil && m.cfg.DBHost != "" {
		rawSnap, _ = json.Marshal(data)
	}
	m.mu.Unlock()
	if err != nil {
		return err
	}
	if len(rawSnap) > 0 {
		go m.persistSnapshot(cleanDB, rawSnap)
	}
	return nil
}

func (m *Manager) ensureLoaded(ctx context.Context, cleanDB string) {
	m.mu.RLock()
	_, ok := m.stores[cleanDB]
	m.mu.RUnlock()
	if ok {
		return
	}

	var loaded *TenantData
	if m.cfg.DBHost != "" {
		ctxT, cancel := context.WithTimeout(ctx, 2*time.Second)
		defer cancel()
		if pool, err := m.getOrOpenPool(ctxT, cleanDB); err == nil {
			var raw []byte
			if err := pool.QueryRow(ctxT, `SELECT payload FROM public.proveko_state_snapshot WHERE id = 'primary'`).Scan(&raw); err == nil {
				var parsed TenantData
				if json.Unmarshal(raw, &parsed) == nil {
					if parsed.GenericModules == nil {
						parsed.GenericModules = map[string][]GenericRecord{}
					}
					loaded = &parsed
				}
			}
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.stores[cleanDB]; !exists {
		if loaded != nil {
			m.stores[cleanDB] = loaded
		} else {
			m.stores[cleanDB] = newSeededTenantData("Empresa " + cleanDB)
		}
	}
}

func (m *Manager) persistSnapshot(cleanDB string, raw []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pool, err := m.getOrOpenPool(ctx, cleanDB)
	if err != nil {
		return
	}
	_, _ = pool.Exec(ctx, `INSERT INTO public.proveko_state_snapshot (id, payload, updated_at)
		VALUES ('primary', $1::jsonb, NOW())
		ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`, string(raw))
}

func (m *Manager) getOrOpenPool(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	m.mu.RLock()
	if p, ok := m.pools[dbName]; ok {
		m.mu.RUnlock()
		return p, nil
	}
	m.mu.RUnlock()

	dsn := m.cfg.AdminDSN(dbName)
	if dsn == "" {
		return nil, fmt.Errorf("empty dsn")
	}
	pCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	pCfg.MaxConns = 4
	pCfg.MinConns = 0
	pCfg.MaxConnIdleTime = 30 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, pCfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	m.mu.Lock()
	m.pools[dbName] = pool
	m.mu.Unlock()
	return pool, nil
}
