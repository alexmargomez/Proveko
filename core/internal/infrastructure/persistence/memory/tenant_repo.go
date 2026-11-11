package memory

import (
	"context"
	"strings"
	"sync"

	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/dbpool"
)

type TenantRepository struct {
	mu      sync.RWMutex
	tenants map[string]*domain.Tenant
	order   []string
	dbs     map[string]bool
}

func NewTenantRepository() *TenantRepository {
	return &TenantRepository{
		tenants: make(map[string]*domain.Tenant),
		dbs:     make(map[string]bool),
	}
}

func (r *TenantRepository) ProvisionTenantDatabase(_ context.Context, dbName string, requireNew bool) (string, error) {
	clean, err := dbpool.SanitizeTenantDBName(dbName)
	if err != nil {
		return "", err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.dbs[clean] && requireNew {
		return "", apperr.Conflict("La base de datos asignada ya existe en el registro")
	}
	r.dbs[clean] = true
	return clean, nil
}

func (r *TenantRepository) GetByID(_ context.Context, tenantID string) (*domain.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rec, ok := r.tenants[tenantID]
	if !ok {
		return nil, apperr.NotFound("Empresa no encontrada")
	}
	return rec.Clone(), nil
}

func (r *TenantRepository) GetByUsername(_ context.Context, username string) (*domain.Tenant, error) {
	uLow := strings.ToLower(strings.TrimSpace(username))
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, id := range r.order {
		if r.tenants[id].AdminUsername == uLow {
			return r.tenants[id].Clone(), nil
		}
	}
	return nil, apperr.NotFound("Usuario no registrado")
}

func (r *TenantRepository) List(_ context.Context) ([]*domain.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.Tenant, 0, len(r.order))
	for _, id := range r.order {
		out = append(out, r.tenants[id].Clone())
	}
	return out, nil
}

func (r *TenantRepository) Create(_ context.Context, tenant *domain.Tenant) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tenants[tenant.TenantID]; exists {
		return apperr.Conflict("El identificador de la empresa ya existe")
	}
	for _, id := range r.order {
		ex := r.tenants[id]
		if ex.AdminUsername == tenant.AdminUsername {
			return apperr.Conflict("El correo administrador ya se encuentra registrado")
		}
		if ex.DBName == tenant.DBName {
			return apperr.Conflict("El nombre de base de datos ya está asignado a otra empresa")
		}
	}
	r.tenants[tenant.TenantID] = tenant.Clone()
	r.order = append(r.order, tenant.TenantID)
	r.dbs[tenant.DBName] = true
	return nil
}

func (r *TenantRepository) UpdateSubscriptions(_ context.Context, tenant *domain.Tenant) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tenants[tenant.TenantID]; !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	r.tenants[tenant.TenantID] = tenant.Clone()
	return nil
}

func (r *TenantRepository) UpdateStatus(_ context.Context, tenantID, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, exists := r.tenants[tenantID]
	if !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	rec.Status = status
	return nil
}
