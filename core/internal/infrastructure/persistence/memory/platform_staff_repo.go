package memory

import (
	"context"
	"sort"
	"strings"

	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
)

func (r *TenantRepository) UpdatePaymentStatus(_ context.Context, tenantID, paymentStatus string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, exists := r.tenants[tenantID]
	if !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	rec.PaymentStatus = strings.TrimSpace(paymentStatus)
	return nil
}

func (r *TenantRepository) UpdateCustomMonthlyCop(_ context.Context, tenantID string, customMonthlyCop int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, exists := r.tenants[tenantID]
	if !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	rec.CustomMonthlyCop = customMonthlyCop
	return nil
}

func (r *TenantRepository) UpdateMaintenance(_ context.Context, tenantID string, enabled bool, message string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, exists := r.tenants[tenantID]
	if !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	rec.MaintenanceMode = enabled
	rec.MaintenanceMessage = strings.TrimSpace(message)
	return nil
}

func (r *TenantRepository) BumpTenantSessionVersion(_ context.Context, tenantID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, exists := r.tenants[tenantID]
	if !exists {
		return 0, apperr.NotFound("Empresa no encontrada")
	}
	if rec.SessionVersion <= 0 {
		rec.SessionVersion = 1
	}
	rec.SessionVersion++
	return rec.SessionVersion, nil
}

func (r *TenantRepository) BumpUserSessionVersion(_ context.Context, tenantID, userID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, exists := r.users[userID]
	if !exists || (tenantID != "" && u.TenantID != tenantID) {
		return 0, apperr.NotFound("Usuario de empresa no encontrado")
	}
	if u.SessionVersion <= 0 {
		u.SessionVersion = 1
	}
	u.SessionVersion++
	return u.SessionVersion, nil
}

func (r *TenantRepository) ListPlatformRoles(_ context.Context) ([]*domain.PlatformRole, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.PlatformRole, 0, len(r.platformRoleKeys))
	for _, k := range r.platformRoleKeys {
		if role := r.platformRoles[k]; role != nil {
			out = append(out, role.Clone())
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsSystem != out[j].IsSystem {
			return out[i].IsSystem
		}
		return out[i].RoleKey < out[j].RoleKey
	})
	return out, nil
}

func (r *TenantRepository) GetPlatformRole(_ context.Context, roleKey string) (*domain.PlatformRole, error) {
	clean := strings.ToLower(strings.TrimSpace(roleKey))
	r.mu.RLock()
	defer r.mu.RUnlock()
	role, ok := r.platformRoles[clean]
	if !ok {
		return nil, apperr.NotFound("Rol de plataforma no encontrado")
	}
	return role.Clone(), nil
}

func (r *TenantRepository) UpsertPlatformRole(_ context.Context, role *domain.PlatformRole) error {
	clean := strings.ToLower(strings.TrimSpace(role.RoleKey))
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := role.Clone()
	cp.RoleKey = clean
	if _, exists := r.platformRoles[clean]; !exists {
		r.platformRoleKeys = append(r.platformRoleKeys, clean)
	}
	r.platformRoles[clean] = cp
	return nil
}

func (r *TenantRepository) DeletePlatformRole(_ context.Context, roleKey string) error {
	clean := strings.ToLower(strings.TrimSpace(roleKey))
	r.mu.Lock()
	defer r.mu.Unlock()
	role, exists := r.platformRoles[clean]
	if !exists || role.IsSystem {
		return apperr.Validation("El rol no existe o es un rol base protegido del sistema")
	}
	for _, uid := range r.platformUserKeys {
		if u := r.platformUsers[uid]; u != nil && u.RoleKey == clean {
			return apperr.Conflict("No es posible eliminar un rol asignado a personal interno activo")
		}
	}
	delete(r.platformRoles, clean)
	filtered := make([]string, 0, len(r.platformRoleKeys))
	for _, k := range r.platformRoleKeys {
		if k != clean {
			filtered = append(filtered, k)
		}
	}
	r.platformRoleKeys = filtered
	return nil
}

func (r *TenantRepository) ListPlatformUsers(_ context.Context) ([]*domain.PlatformUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.PlatformUser, 0, len(r.platformUserKeys))
	for _, uid := range r.platformUserKeys {
		if u := r.platformUsers[uid]; u != nil {
			out = append(out, u.Clone())
		}
	}
	return out, nil
}

func (r *TenantRepository) GetPlatformUserByID(_ context.Context, userID string) (*domain.PlatformUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.platformUsers[strings.TrimSpace(userID)]
	if !ok {
		return nil, apperr.NotFound("Operador de plataforma no encontrado")
	}
	return u.Clone(), nil
}

func (r *TenantRepository) GetPlatformUserByEmail(_ context.Context, email string) (*domain.PlatformUser, error) {
	low := strings.ToLower(strings.TrimSpace(email))
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, uid := range r.platformUserKeys {
		if u := r.platformUsers[uid]; u != nil && strings.ToLower(u.Email) == low {
			return u.Clone(), nil
		}
	}
	return nil, apperr.NotFound("Operador de plataforma no encontrado")
}

func (r *TenantRepository) CreatePlatformUser(_ context.Context, user *domain.PlatformUser) error {
	low := strings.ToLower(strings.TrimSpace(user.Email))
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, uid := range r.platformUserKeys {
		if u := r.platformUsers[uid]; u != nil && strings.ToLower(u.Email) == low {
			return apperr.Conflict("Ya existe un operador interno con ese correo electrónico")
		}
	}
	cp := user.Clone()
	cp.Email = low
	if len(cp.AllowedTenants) == 0 {
		cp.AllowedTenants = []string{"*"}
	}
	r.platformUsers[cp.UserID] = cp
	r.platformUserKeys = append(r.platformUserKeys, cp.UserID)
	return nil
}

func (r *TenantRepository) UpdatePlatformUser(_ context.Context, user *domain.PlatformUser) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.platformUsers[user.UserID]; !ok {
		return apperr.NotFound("Operador de plataforma no encontrado")
	}
	cp := user.Clone()
	if len(cp.AllowedTenants) == 0 {
		cp.AllowedTenants = []string{"*"}
	}
	r.platformUsers[cp.UserID] = cp
	return nil
}

func (r *TenantRepository) BumpPlatformUserSessionVersion(_ context.Context, userID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.platformUsers[userID]
	if !ok {
		return 0, apperr.NotFound("Operador de plataforma no encontrado")
	}
	if u.SessionVersion <= 0 {
		u.SessionVersion = 1
	}
	u.SessionVersion++
	return u.SessionVersion, nil
}

func (r *TenantRepository) TouchPlatformUserLogin(_ context.Context, userID, timestamp string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if u, ok := r.platformUsers[userID]; ok {
		u.LastLoginAt = timestamp
	}
	return nil
}

func (r *TenantRepository) GetCatalogOverrides(_ context.Context) (domain.CatalogOverrideConfig, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := domain.DefaultCatalogOverrideConfig()
	for k, v := range r.catalogOverrides.Services {
		out.Services[k] = v
	}
	for k, v := range r.catalogOverrides.Presets {
		out.Presets[k] = v
	}
	if r.catalogOverrides.Pricing != nil {
		cp := *r.catalogOverrides.Pricing
		out.Pricing = &cp
	}
	return out, nil
}

func (r *TenantRepository) SaveCatalogOverrides(_ context.Context, cfg domain.CatalogOverrideConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := domain.DefaultCatalogOverrideConfig()
	for k, v := range cfg.Services {
		out.Services[k] = v
	}
	for k, v := range cfg.Presets {
		out.Presets[k] = v
	}
	if cfg.Pricing != nil {
		cp := *cfg.Pricing
		out.Pricing = &cp
	}
	r.catalogOverrides = out
	return nil
}
