package application

import (
	"context"
	"strings"
	"time"

	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/authguard"
	"ms-core/internal/platform/licensegate"
	"ms-core/internal/platform/money"
)

func (s *CoreService) requireCompanyAdminOrSuper(tc authguard.TenantContext, targetTenantID string) (string, error) {
	if tc.Role == domain.RoleSuperAdmin {
		tid := strings.TrimSpace(targetTenantID)
		if tid == "" {
			tid = strings.TrimSpace(tc.TenantID)
		}
		if tid == "" {
			return "", apperr.Validation("Identificador de empresa requerido")
		}
		return tid, nil
	}
	if !tc.IsCompanyAdmin {
		return "", apperr.Forbidden("Solo el administrador de la empresa puede gestionar usuarios, roles o módulos")
	}
	cleanTarget := strings.TrimSpace(targetTenantID)
	if cleanTarget != "" && cleanTarget != tc.TenantID {
		return "", apperr.Forbidden("No tienes permisos sobre otra empresa")
	}
	return tc.TenantID, nil
}

func rejectIfDemoMutation(tc authguard.TenantContext, ten *domain.Tenant) error {
	if tc.Role == domain.RoleSuperAdmin {
		return nil
	}
	if tc.IsDemo || (ten != nil && ten.IsDemo) || strings.HasPrefix(tc.UserID, "demo_visitor_") {
		return apperr.Forbidden("En el entorno de demostración interactivo no está permitido alterar cuentas permanentes ni suscripciones")
	}
	return nil
}

func (s *CoreService) ListCompanyUsers(ctx context.Context, tc authguard.TenantContext, targetTenantID string) ([]*domain.TenantUser, *domain.Tenant, error) {
	tid, err := s.requireCompanyAdminOrSuper(tc, targetTenantID)
	if err != nil {
		return nil, nil, err
	}
	ten, err := s.GetTenant(ctx, tid)
	if err != nil {
		return nil, nil, err
	}
	users, err := s.repo.ListUsersByTenant(ctx, tid)
	if err != nil {
		return nil, nil, err
	}
	return users, ten, nil
}

func buildCompanyAliasDomain(companyName, nitSuffix string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(companyName) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	slug := b.String()
	if len(slug) > 28 {
		slug = slug[:28]
	}
	if slug == "" {
		slug = "empresa"
	}
	if nitSuffix != "" {
		var nb strings.Builder
		for _, r := range nitSuffix {
			if r >= '0' && r <= '9' {
				nb.WriteRune(r)
			}
		}
		if nb.Len() > 0 {
			d := nb.String()
			if len(d) > 6 {
				d = d[:6]
			}
			slug = slug + d
		}
	}
	return slug + ".co"
}

func (s *CoreService) CreateCompanyUser(ctx context.Context, tc authguard.TenantContext, targetTenantID string, in domain.CreateTenantUserInput) (*domain.TenantUser, error) {
	tid, err := s.requireCompanyAdminOrSuper(tc, targetTenantID)
	if err != nil {
		return nil, err
	}
	ten, err := s.GetTenant(ctx, tid)
	if err != nil {
		return nil, err
	}
	if err := rejectIfDemoMutation(tc, ten); err != nil {
		return nil, err
	}

	rawInput := strings.ToLower(strings.TrimSpace(in.Username))
	if rawInput == "" {
		rawInput = strings.ToLower(strings.TrimSpace(in.Email))
	}
	fullName := strings.TrimSpace(in.FullName)
	if rawInput == "" || fullName == "" {
		return nil, apperr.Validation("Nombre completo y usuario o correo de acceso son obligatorios")
	}
	wasShortAlias := !strings.Contains(rawInput, "@")
	uLow := rawInput
	if wasShortAlias {
		uLow = rawInput + "@" + buildCompanyAliasDomain(ten.CompanyName, "")
	}
	if uLow == s.superEmail {
		return nil, apperr.Conflict("El usuario ingresado está reservado por la plataforma")
	}
	if len(strings.TrimSpace(in.Password)) < 8 {
		return nil, apperr.Validation("La contraseña del usuario debe tener al menos 8 caracteres")
	}

	roleKey := strings.ToLower(strings.TrimSpace(in.InternalRole))
	if roleKey == "" {
		roleKey = "vendedor"
	}
	isAdmin := in.IsCompanyAdmin || roleKey == "admin_empresa"

	allowedSvcs, allowedMods := sanitizeUserPermissionsAgainstTenant(ten, isAdmin, in.AllowedServices, in.AllowedModules)
	if !isAdmin && len(allowedSvcs) == 0 {
		return nil, apperr.Validation("Selecciona al menos un área o servicio operativo para este usuario")
	}

	passHash, err := authguard.HashPassword(in.Password)
	if err != nil {
		return nil, apperr.Internal("Error al proteger la contraseña del usuario")
	}

	rawEmail := strings.ToLower(strings.TrimSpace(in.Email))
	email := rawEmail
	if email == "" || !strings.Contains(email, "@") {
		email = uLow
	}

	usr := &domain.TenantUser{
		UserID:          money.NewID("usr"),
		TenantID:        tid,
		Username:        uLow,
		Email:           email,
		FullName:        fullName,
		PasswordHash:    passHash,
		InternalRole:    roleKey,
		IsCompanyAdmin:  isAdmin,
		AllowedServices: allowedSvcs,
		AllowedModules:  allowedMods,
		Status:          "ACTIVE",
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.CreateUser(ctx, usr); err != nil {
		if wasShortAlias && apperr.IsKind(err, apperr.KindConflict) && ten.Nit != "" {
			usr.Username = rawInput + "@" + buildCompanyAliasDomain(ten.CompanyName, ten.Nit)
			if rawEmail == "" || !strings.Contains(rawEmail, "@") {
				usr.Email = usr.Username
			}
			if retryErr := s.repo.CreateUser(ctx, usr); retryErr == nil {
				usr.PasswordHash = ""
				return usr, nil
			}
		}
		return nil, err
	}
	s.invalidateUserCache(tid, usr.UserID)
	return usr.Clone(), nil
}

func (s *CoreService) UpdateCompanyUser(ctx context.Context, tc authguard.TenantContext, targetTenantID, userID string, in domain.UpdateTenantUserInput) (*domain.TenantUser, error) {
	tid, err := s.requireCompanyAdminOrSuper(tc, targetTenantID)
	if err != nil {
		return nil, err
	}
	ten, err := s.GetTenant(ctx, tid)
	if err != nil {
		return nil, err
	}
	if err := rejectIfDemoMutation(tc, ten); err != nil {
		return nil, err
	}

	cleanUID := strings.TrimSpace(userID)
	existing, err := s.repo.GetUserByID(ctx, tid, cleanUID)
	if err != nil {
		return nil, err
	}

	isRootOwner := strings.EqualFold(existing.Username, ten.AdminUsername) || existing.UserID == "usr_"+tid
	if isRootOwner && tc.Role != domain.RoleSuperAdmin && tc.UserID != existing.UserID && !strings.EqualFold(tc.Username, ten.AdminUsername) {
		return nil, apperr.Forbidden("Solo el propietario titular de la empresa puede modificar la cuenta maestra")
	}

	if fullName := strings.TrimSpace(in.FullName); fullName != "" {
		existing.FullName = fullName
	}
	if email := strings.ToLower(strings.TrimSpace(in.Email)); email != "" {
		existing.Email = email
	}
	if rawPass := strings.TrimSpace(in.Password); rawPass != "" {
		if len(rawPass) < 8 {
			return nil, apperr.Validation("La nueva contraseña debe tener al menos 8 caracteres")
		}
		hash, err := authguard.HashPassword(rawPass)
		if err != nil {
			return nil, apperr.Internal("Error al actualizar contraseña")
		}
		existing.PasswordHash = hash
	}

	if isRootOwner {
		existing.InternalRole = "admin_empresa"
		existing.IsCompanyAdmin = true
		existing.AllowedServices = []string{"*"}
		existing.AllowedModules = []string{"*"}
		existing.Status = "ACTIVE"
	} else {
		if rk := strings.ToLower(strings.TrimSpace(in.InternalRole)); rk != "" {
			existing.InternalRole = rk
		}
		if in.IsCompanyAdmin != nil {
			existing.IsCompanyAdmin = *in.IsCompanyAdmin
			if !existing.IsCompanyAdmin && existing.InternalRole == "admin_empresa" {
				existing.InternalRole = "vendedor"
			}
		} else if existing.InternalRole == "admin_empresa" {
			existing.IsCompanyAdmin = true
		}

		if in.AllowedServices != nil || in.AllowedModules != nil {
			svcs, mods := sanitizeUserPermissionsAgainstTenant(ten, existing.IsCompanyAdmin, in.AllowedServices, in.AllowedModules)
			if !existing.IsCompanyAdmin && len(svcs) == 0 {
				return nil, apperr.Validation("El usuario debe conservar al menos un área o servicio asignado")
			}
			existing.AllowedServices = svcs
			existing.AllowedModules = mods
		}
		if st := strings.ToUpper(strings.TrimSpace(in.Status)); st == "ACTIVE" || st == "SUSPENDED" {
			existing.Status = st
		}
	}

	if err := s.repo.UpdateUser(ctx, existing); err != nil {
		return nil, err
	}
	s.invalidateUserCache(tid, existing.UserID)
	return existing.Clone(), nil
}

func (s *CoreService) DeleteCompanyUser(ctx context.Context, tc authguard.TenantContext, targetTenantID, userID string) error {
	tid, err := s.requireCompanyAdminOrSuper(tc, targetTenantID)
	if err != nil {
		return err
	}
	ten, err := s.GetTenant(ctx, tid)
	if err != nil {
		return err
	}
	if err := rejectIfDemoMutation(tc, ten); err != nil {
		return err
	}
	cleanUID := strings.TrimSpace(userID)
	existing, err := s.repo.GetUserByID(ctx, tid, cleanUID)
	if err != nil {
		return err
	}
	if strings.EqualFold(existing.Username, ten.AdminUsername) || existing.UserID == "usr_"+tid {
		return apperr.Validation("No es posible eliminar la cuenta administradora principal de la empresa")
	}
	if err := s.repo.DeleteUser(ctx, tid, existing.UserID); err != nil {
		return err
	}
	s.invalidateUserCache(tid, existing.UserID)
	return nil
}

func (s *CoreService) SelfActivateCompanyModules(ctx context.Context, tc authguard.TenantContext, addSvcs, addMods, addSubs, addFeats []string) (*domain.Tenant, error) {
	tid, err := s.requireCompanyAdminOrSuper(tc, tc.TenantID)
	if err != nil {
		return nil, err
	}
	// Read directly from repo (bypassing short cache) to minimize lost-update window
	ten, err := s.repo.GetByID(ctx, tid)
	if err != nil {
		return nil, err
	}
	if err := rejectIfDemoMutation(tc, ten); err != nil {
		return nil, err
	}
	if len(dedupeStrings(addSvcs)) == 0 && len(dedupeStrings(addMods)) == 0 && len(dedupeStrings(addSubs)) == 0 && len(dedupeStrings(addFeats)) == 0 {
		return nil, apperr.Validation("Selecciona al menos un área o módulo adicional para activar")
	}

	cat := s.catalog.Catalog()
	oldSvcSet := toBoolSet(ten.ActiveServices)
	oldModSet := toBoolSet(ten.ActiveModules)
	oldSubSet := toBoolSet(ten.ActiveSubmodules)
	oldFeatSet := toBoolSet(ten.ActiveFeatures)

	mergedSvcs := dedupeStrings(append(append([]string{}, ten.ActiveServices...), addSvcs...))
	mergedMods := dedupeStrings(append(append([]string{}, ten.ActiveModules...), addMods...))
	mergedSubs := dedupeStrings(append(append([]string{}, ten.ActiveSubmodules...), addSubs...))
	mergedFeats := dedupeStrings(append(append([]string{}, ten.ActiveFeatures...), addFeats...))

	// Auto-include parent service/module/submodule when enabling a child capability
	for _, svc := range cat {
		for _, f := range svc.Features {
			if containsStr(mergedFeats, f.FeatureKey) && !oldFeatSet[f.FeatureKey] {
				mergedSvcs = append(mergedSvcs, svc.ServiceKey)
				if f.DependsOnModule != "" {
					mergedMods = append(mergedMods, f.DependsOnModule)
				}
				if f.DependsOnSubmodule != "" {
					mergedSubs = append(mergedSubs, f.DependsOnSubmodule)
				}
			}
		}
		for _, sm := range svc.Submodules {
			if containsStr(mergedSubs, sm.SubmoduleKey) && !oldSubSet[sm.SubmoduleKey] {
				mergedSvcs = append(mergedSvcs, svc.ServiceKey)
				if sm.DependsOnModule != "" {
					mergedMods = append(mergedMods, sm.DependsOnModule)
				}
			}
		}
		for _, m := range svc.Modules {
			if containsStr(mergedMods, m.ModuleKey) && !oldModSet[m.ModuleKey] {
				mergedSvcs = append(mergedSvcs, svc.ServiceKey)
			}
		}
	}
	mergedSvcs = dedupeStrings(mergedSvcs)
	mergedMods = dedupeStrings(mergedMods)
	mergedSubs = dedupeStrings(mergedSubs)

	for _, svc := range cat {
		isNewSvc := !oldSvcSet[svc.ServiceKey] && containsStr(mergedSvcs, svc.ServiceKey)
		if isNewSvc {
			for _, m := range svc.Modules {
				if m.DefaultActive {
					mergedMods = append(mergedMods, m.ModuleKey)
				}
			}
		}
	}
	mergedMods = dedupeStrings(mergedMods)

	for _, svc := range cat {
		if !containsStr(mergedSvcs, svc.ServiceKey) {
			continue
		}
		for _, sm := range svc.Submodules {
			isParentNew := !oldModSet[sm.DependsOnModule] && containsStr(mergedMods, sm.DependsOnModule)
			if sm.DefaultActive && (isParentNew || !oldSvcSet[svc.ServiceKey]) {
				mergedSubs = append(mergedSubs, sm.SubmoduleKey)
			}
		}
	}
	mergedSubs = dedupeStrings(mergedSubs)

	for _, svc := range cat {
		if !containsStr(mergedSvcs, svc.ServiceKey) {
			continue
		}
		for _, f := range svc.Features {
			isParentNew := !oldModSet[f.DependsOnModule] && containsStr(mergedMods, f.DependsOnModule)
			if f.DefaultActive && isParentNew && (f.DependsOnSubmodule == "" || containsStr(mergedSubs, f.DependsOnSubmodule)) {
				mergedFeats = append(mergedFeats, f.FeatureKey)
			}
		}
	}
	mergedFeats = dedupeStrings(mergedFeats)

	deltaSvcs := diffSlice(mergedSvcs, oldSvcSet)
	deltaMods := diffSlice(mergedMods, oldModSet)
	deltaSubs := diffSlice(mergedSubs, oldSubSet)
	deltaFeats := diffSlice(mergedFeats, oldFeatSet)

	if len(deltaSvcs) == 0 && len(deltaMods) == 0 && len(deltaSubs) == 0 && len(deltaFeats) == 0 {
		return ten.Clone(), nil
	}

	if err := licensegate.ValidateSubscriptionState4(cat, mergedSvcs, mergedMods, mergedSubs, mergedFeats); err != nil {
		return nil, err
	}

	updated := ten.Clone()
	updated.ActiveServices = mergedSvcs
	updated.ActiveModules = mergedMods
	updated.ActiveSubmodules = mergedSubs
	updated.ActiveFeatures = mergedFeats
	updated.MonthlyCop = domain.CalculateSubscriptionCop(cat, updated.BusinessPreset, updated.ActiveServices)

	if err := s.repo.UpdateSubscriptions(ctx, updated); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(tid)

	if err := s.repo.RecordActivationRequest(ctx, &domain.ModuleActivationRequest{
		RequestID:       money.NewID("act"),
		TenantID:        tid,
		CompanyName:     updated.CompanyName,
		RequestedBy:     tc.Username,
		AddedServices:   deltaSvcs,
		AddedModules:    deltaMods,
		AddedSubmodules: deltaSubs,
		AddedFeatures:   deltaFeats,
		MonthlyCopAfter: updated.MonthlyCop,
		Status:          "APLICADA",
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
	}); err != nil {
		return nil, err
	}

	return updated.Clone(), nil
}

func (s *CoreService) UpdateTenantQuotas(ctx context.Context, callerRole, targetTenantID string, maxUsersAllowed int) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global puede ajustar cupos corporativos")
	}
	cleanID := strings.TrimSpace(targetTenantID)
	if maxUsersAllowed < 1 || maxUsersAllowed > 5000 {
		return nil, apperr.Validation("El cupo de usuarios debe estar entre 1 y 5000")
	}
	if err := s.repo.UpdateQuotas(ctx, cleanID, maxUsersAllowed); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
	return s.GetTenant(ctx, cleanID)
}

func (s *CoreService) ListActivationRequests(ctx context.Context, tc authguard.TenantContext) ([]*domain.ModuleActivationRequest, error) {
	if tc.Role == domain.RoleSuperAdmin {
		return s.repo.ListActivationRequests(ctx, "")
	}
	if !tc.IsCompanyAdmin {
		return nil, apperr.Forbidden("Acceso restringido al administrador de la empresa")
	}
	return s.repo.ListActivationRequests(ctx, tc.TenantID)
}

func sanitizeUserPermissionsAgainstTenant(ten *domain.Tenant, isAdmin bool, svcs, mods []string) ([]string, []string) {
	if isAdmin {
		return []string{"*"}, []string{"*"}
	}
	tenSvcSet := toBoolSet(ten.ActiveServices)
	tenModSet := toBoolSet(ten.ActiveModules)

	outSvcs := make([]string, 0, len(svcs))
	for _, sk := range dedupeStrings(svcs) {
		if tenSvcSet[sk] {
			outSvcs = append(outSvcs, sk)
		}
	}
	outMods := make([]string, 0, len(mods))
	for _, mk := range dedupeStrings(mods) {
		if tenModSet[mk] {
			outMods = append(outMods, mk)
		}
	}
	return outSvcs, outMods
}

func toBoolSet(list []string) map[string]bool {
	m := make(map[string]bool, len(list))
	for _, v := range list {
		m[v] = true
	}
	return m
}

func diffSlice(merged []string, old map[string]bool) []string {
	out := make([]string, 0)
	for _, v := range merged {
		if !old[v] {
			out = append(out, v)
		}
	}
	return out
}

func containsStr(list []string, target string) bool {
	for _, v := range list {
		if v == target {
			return true
		}
	}
	return false
}
