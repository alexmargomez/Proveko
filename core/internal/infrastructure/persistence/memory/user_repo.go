package memory

import (
	"context"
	"sort"
	"strings"

	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
)

func (r *TenantRepository) GetUserByUsername(_ context.Context, username string) (*domain.TenantUser, error) {
	uLow := strings.ToLower(strings.TrimSpace(username))
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, uid := range r.userKeys {
		u := r.users[uid]
		if u != nil && u.Username == uLow {
			return u.Clone(), nil
		}
	}
	return nil, apperr.NotFound("Usuario no registrado")
}

func (r *TenantRepository) GetUserByID(_ context.Context, tenantID, userID string) (*domain.TenantUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[userID]
	if !ok || (tenantID != "" && u.TenantID != tenantID) {
		return nil, apperr.NotFound("Usuario de empresa no encontrado")
	}
	return u.Clone(), nil
}

func (r *TenantRepository) ListUsersByTenant(_ context.Context, tenantID string) ([]*domain.TenantUser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.TenantUser, 0)
	for _, uid := range r.userKeys {
		u := r.users[uid]
		if u != nil && u.TenantID == tenantID {
			out = append(out, u.Clone())
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsCompanyAdmin != out[j].IsCompanyAdmin {
			return out[i].IsCompanyAdmin
		}
		if out[i].CreatedAt != out[j].CreatedAt {
			return out[i].CreatedAt < out[j].CreatedAt
		}
		return out[i].Username < out[j].Username
	})
	return out, nil
}

func (r *TenantRepository) CreateUser(_ context.Context, user *domain.TenantUser) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	ten, exists := r.tenants[user.TenantID]
	if !exists {
		return apperr.NotFound("Empresa no encontrada")
	}
	maxAllowed := ten.MaxUsersAllowed
	if maxAllowed <= 0 {
		maxAllowed = 15
	}
	activeCount := 0
	for _, uid := range r.userKeys {
		u := r.users[uid]
		if u != nil && u.TenantID == user.TenantID && !strings.EqualFold(u.Status, "SUSPENDED") {
			activeCount++
		}
	}
	if activeCount >= maxAllowed {
		return apperr.Validation("Has alcanzado el cupo máximo de usuarios permitidos en tu plan actual")
	}

	uLow := strings.ToLower(strings.TrimSpace(user.Username))
	for _, uid := range r.userKeys {
		if r.users[uid] != nil && r.users[uid].Username == uLow {
			return apperr.Conflict("El nombre de usuario o correo ya se encuentra registrado")
		}
	}
	for _, tid := range r.order {
		if r.tenants[tid].AdminUsername == uLow {
			return apperr.Conflict("El nombre de usuario o correo ya se encuentra registrado")
		}
	}
	cp := user.Clone()
	cp.Username = uLow
	cp.Email = strings.ToLower(strings.TrimSpace(cp.Email))
	r.users[cp.UserID] = cp
	r.userKeys = append(r.userKeys, cp.UserID)
	return nil
}

func (r *TenantRepository) UpdateUser(_ context.Context, user *domain.TenantUser) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing, ok := r.users[user.UserID]
	if !ok || existing.TenantID != user.TenantID {
		return apperr.NotFound("Usuario de empresa no encontrado")
	}
	if strings.EqualFold(existing.Status, "SUSPENDED") && !strings.EqualFold(user.Status, "SUSPENDED") {
		maxAllowed := 15
		if ten, hasTen := r.tenants[user.TenantID]; hasTen && ten.MaxUsersAllowed > 0 {
			maxAllowed = ten.MaxUsersAllowed
		}
		activeCount := 0
		for _, k := range r.userKeys {
			u := r.users[k]
			if u.TenantID == user.TenantID && !strings.EqualFold(u.Status, "SUSPENDED") {
				activeCount++
			}
		}
		if activeCount >= maxAllowed {
			return apperr.Validation("Tu empresa alcanzó el cupo máximo de usuarios activos contratados")
		}
	}
	cp := user.Clone()
	cp.Username = existing.Username
	cp.Email = strings.ToLower(strings.TrimSpace(cp.Email))
	if cp.PasswordHash == "" {
		cp.PasswordHash = existing.PasswordHash
	}
	r.users[cp.UserID] = cp
	if ten, hasTen := r.tenants[existing.TenantID]; hasTen && existing.Username == ten.AdminUsername && cp.PasswordHash != "" {
		ten.PasswordHash = cp.PasswordHash
	}
	return nil
}

func (r *TenantRepository) DeleteUser(_ context.Context, tenantID, userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	existing, ok := r.users[userID]
	if !ok || existing.TenantID != tenantID {
		return apperr.NotFound("Usuario de empresa no encontrado")
	}
	delete(r.users, userID)
	filtered := make([]string, 0, len(r.userKeys))
	for _, k := range r.userKeys {
		if k != userID {
			filtered = append(filtered, k)
		}
	}
	r.userKeys = filtered
	return nil
}

func (r *TenantRepository) RecordActivationRequest(_ context.Context, req *domain.ModuleActivationRequest) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := cloneActivationReq(req)
	r.requests = append([]*domain.ModuleActivationRequest{cp}, r.requests...)
	return nil
}

func (r *TenantRepository) ListActivationRequests(_ context.Context, tenantID string) ([]*domain.ModuleActivationRequest, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.ModuleActivationRequest, 0)
	for _, req := range r.requests {
		if tenantID == "" || req.TenantID == tenantID {
			out = append(out, cloneActivationReq(req))
			if len(out) >= 100 {
				break
			}
		}
	}
	return out, nil
}

func cloneActivationReq(req *domain.ModuleActivationRequest) *domain.ModuleActivationRequest {
	cp := *req
	cp.AddedServices = append([]string{}, req.AddedServices...)
	cp.AddedModules = append([]string{}, req.AddedModules...)
	cp.AddedSubmodules = append([]string{}, req.AddedSubmodules...)
	cp.AddedFeatures = append([]string{}, req.AddedFeatures...)
	return &cp
}
