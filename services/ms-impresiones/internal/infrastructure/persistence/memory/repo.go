package memory

import (
	"context"
	"sync"

	"ms-impresiones/internal/domain"
)

type logEntry struct {
	req    domain.RenderRequest
	format string
}

type tenantStore struct {
	branding domain.BrandingConfig
	idemKeys map[string]domain.BrandingConfig
	logs     []logEntry
}

type Repository struct {
	mu      sync.Mutex
	tenants map[string]*tenantStore
}

func NewRepository() *Repository {
	return &Repository{
		tenants: make(map[string]*tenantStore),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	st := &tenantStore{
		branding: domain.DefaultSeedBranding(),
		idemKeys: make(map[string]domain.BrandingConfig),
		logs:     make([]logEntry, 0, 16),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetBranding(_ context.Context, dbName string) (domain.BrandingConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureSeededLocked(dbName)
	return st.branding.Clone(), nil
}

func (r *Repository) SaveBranding(_ context.Context, dbName, idemKey string, cfg domain.BrandingConfig) (domain.BrandingConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if prev, exists := st.idemKeys[idemKey]; exists {
			return prev.Clone(), nil
		}
	}
	st.branding = cfg.Clone()
	if idemKey != "" {
		st.idemKeys[idemKey] = st.branding.Clone()
	}
	return st.branding.Clone(), nil
}

func (r *Repository) RecordRenderLog(_ context.Context, dbName string, req domain.RenderRequest, formatUsed string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureSeededLocked(dbName)
	st.logs = append(st.logs, logEntry{
		req:    req.Clone(),
		format: formatUsed,
	})
	if len(st.logs) > 500 {
		st.logs = st.logs[len(st.logs)-500:]
	}
	return nil
}
