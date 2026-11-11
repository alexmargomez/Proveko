package application

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/authguard"
	"ms-core/internal/platform/licensegate"
	"ms-core/internal/platform/money"
)

const tenantCacheTTL = 2 * time.Second

type cachedTenant struct {
	tenant    *domain.Tenant
	expiresAt time.Time
}

type BootstrapOutput struct {
	Catalog  []licensegate.ServiceManifest `json:"catalog"`
	Tenant   *domain.Tenant                `json:"tenant"`
	Tenants  []*domain.Tenant              `json:"tenants"`
	UserRole string                        `json:"userRole"`
}

type AuthOutput struct {
	Tenant   *domain.Tenant
	Role     string
	Username string
}

type CoreService struct {
	repo          domain.TenantRepository
	provisioner   domain.DatabaseProvisioner
	catalog       domain.CatalogProvider
	vault         domain.SecretVault
	superEmail    string
	superPassHash string
	cacheMu       sync.RWMutex
	tenantCache   map[string]cachedTenant
}

func NewCoreService(
	repo domain.TenantRepository,
	provisioner domain.DatabaseProvisioner,
	catalog domain.CatalogProvider,
	vault domain.SecretVault,
	superEmail string,
	superPassword string,
) (*CoreService, error) {
	normSuper := strings.ToLower(strings.TrimSpace(superEmail))
	if normSuper == "" {
		normSuper = "superadmin@plataforma.local"
	}
	hash, err := authguard.HashPassword(superPassword)
	if err != nil {
		return nil, err
	}
	return &CoreService{
		repo:          repo,
		provisioner:   provisioner,
		catalog:       catalog,
		vault:         vault,
		superEmail:    normSuper,
		superPassHash: hash,
		tenantCache:   make(map[string]cachedTenant),
	}, nil
}

func (s *CoreService) invalidateTenantCache(tenantID string) {
	s.cacheMu.Lock()
	delete(s.tenantCache, strings.TrimSpace(tenantID))
	s.cacheMu.Unlock()
}

func (s *CoreService) SeedDemoTenant(ctx context.Context, demoPassword string) error {
	existing, err := s.repo.GetByID(ctx, "demo-empresa")
	if err == nil && existing != nil {
		return nil
	}
	if strings.TrimSpace(demoPassword) == "" {
		demoPassword = "AdminPlataforma2026*"
	}
	_, err = s.createTenantInternal(ctx, domain.CreateTenantInput{
		TenantID:       "demo-empresa",
		CompanyName:    "Proveko Comercial & Servicios S.A.S.",
		Nit:            "901.482.190-4",
		AdminUsername:  "admin@empresa.co",
		Password:       demoPassword,
		BusinessPreset: "full",
	}, false)
	return err
}

func (s *CoreService) Catalog() []licensegate.ServiceManifest {
	return s.catalog.Catalog()
}

func (s *CoreService) Authenticate(ctx context.Context, rawUsername, password string) (AuthOutput, error) {
	uLow := strings.ToLower(strings.TrimSpace(rawUsername))
	if uLow == "" || password == "" {
		return AuthOutput{}, apperr.Validation("Ingresa usuario y contraseña válidos")
	}

	if uLow == s.superEmail {
		if !authguard.VerifyPassword(password, s.superPassHash) {
			return AuthOutput{}, apperr.Unauthorized("Credenciales de acceso inválidas")
		}
		ten, err := s.defaultSuperAdminTenant(ctx)
		if err != nil {
			return AuthOutput{}, err
		}
		return AuthOutput{
			Tenant:   ten,
			Role:     domain.RoleSuperAdmin,
			Username: uLow,
		}, nil
	}

	ten, err := s.repo.GetByUsername(ctx, uLow)
	if err != nil {
		return AuthOutput{}, apperr.Unauthorized("Credenciales de acceso inválidas")
	}
	if !authguard.VerifyPassword(password, ten.PasswordHash) {
		return AuthOutput{}, apperr.Unauthorized("Credenciales de acceso inválidas")
	}
	if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return AuthOutput{}, apperr.Forbidden("La suscripción de esta empresa se encuentra suspendida")
	}
	role := ten.Role
	if role != domain.RoleSuperAdmin {
		role = domain.RoleCliente
	}
	return AuthOutput{
		Tenant:   ten.Clone(),
		Role:     role,
		Username: ten.AdminUsername,
	}, nil
}

func (s *CoreService) RegisterTenant(ctx context.Context, in domain.CreateTenantInput) (*domain.Tenant, error) {
	in.TenantID = ""
	return s.createTenantInternal(ctx, in, true)
}

func (s *CoreService) createTenantInternal(ctx context.Context, in domain.CreateTenantInput, requireNewDB bool) (*domain.Tenant, error) {
	company := strings.TrimSpace(in.CompanyName)
	nit := strings.TrimSpace(in.Nit)
	adminUser := strings.ToLower(strings.TrimSpace(in.AdminUsername))
	if adminUser == "" {
		adminUser = strings.ToLower(strings.TrimSpace(in.AdminEmail))
	}
	if company == "" || nit == "" || adminUser == "" {
		return nil, apperr.Validation("Razón social, NIT y correo administrador son obligatorios")
	}
	if len(strings.TrimSpace(in.Password)) < 8 {
		return nil, apperr.Validation("La contraseña debe tener al menos 8 caracteres")
	}
	if adminUser == s.superEmail {
		return nil, apperr.Conflict("El correo ingresado está reservado por la plataforma")
	}
	if existing, err := s.repo.GetByUsername(ctx, adminUser); err == nil && existing != nil {
		return nil, apperr.Conflict("El correo administrador ya se encuentra registrado")
	}

	tID := strings.TrimSpace(in.TenantID)
	var dbName string
	if tID == "demo-empresa" && !requireNewDB {
		dbName = "db_demo_empresa"
	} else {
		tID = money.NewID("ten")
		dbName = buildCandidateDBName(company)
	}

	cat := s.catalog.Catalog()
	svcs, mods, submods, feats := normalizeDefaultSubscriptions(cat, in.Services, in.Modules, in.Submodules, in.Features)
	if err := licensegate.ValidateSubscriptionState4(cat, svcs, mods, submods, feats); err != nil {
		return nil, err
	}

	if s.provisioner != nil {
		var err error
		dbName, err = s.provisioner.ProvisionTenantDatabase(ctx, dbName, requireNewDB)
		if err != nil {
			return nil, err
		}
	}

	passHash, err := authguard.HashPassword(in.Password)
	if err != nil {
		return nil, apperr.Internal("Error al procesar credenciales de seguridad")
	}
	var sealed domain.SealedEnvelope
	if s.vault != nil {
		sealed, err = s.vault.SealTenantDSN(tID, "postgres://tenant/"+dbName)
		if err != nil {
			return nil, apperr.Internal("Error al sellar bóveda criptográfica de la empresa")
		}
	}
	preset := strings.TrimSpace(in.BusinessPreset)
	if preset == "" {
		preset = strings.TrimSpace(in.Industry)
	}
	if preset == "" {
		preset = "full"
	}

	rec := &domain.Tenant{
		ID:               tID,
		TenantID:         tID,
		CompanyName:      company,
		Nit:              nit,
		AdminUsername:    adminUser,
		PasswordHash:     passHash,
		Role:             domain.RoleCliente,
		DBName:           dbName,
		SealedDSN:        sealed,
		BusinessPreset:   preset,
		Status:           "ACTIVE",
		ActiveServices:   svcs,
		ActiveModules:    mods,
		ActiveSubmodules: submods,
		ActiveFeatures:   feats,
		CreatedAt:        time.Now().UTC().Format("2006-01-02 15:04"),
	}
	if err := s.repo.Create(ctx, rec); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(tID)
	return rec.Clone(), nil
}

func (s *CoreService) ProvisionTenantAsSuperAdmin(ctx context.Context, callerRole string, in domain.CreateTenantInput) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global de plataforma puede aprovisionar empresas desde la consola corporativa")
	}
	in.TenantID = ""
	return s.createTenantInternal(ctx, in, true)
}

func buildCandidateDBName(company string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(company)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	slug := strings.Trim(b.String(), "_")
	for strings.Contains(slug, "__") {
		slug = strings.ReplaceAll(slug, "__", "_")
	}
	if slug == "" {
		slug = "empresa"
	}
	if len(slug) > 26 {
		slug = strings.Trim(slug[:26], "_")
	}
	suffix := money.NewID("")
	if len(suffix) > 6 {
		suffix = suffix[:6]
	}
	return "db_" + slug + "_" + suffix
}

func (s *CoreService) Bootstrap(ctx context.Context, callerTenantID, callerRole string) (BootstrapOutput, error) {
	if strings.TrimSpace(callerTenantID) == "" {
		return BootstrapOutput{}, apperr.Unauthorized("Sesión no autenticada")
	}
	ten, err := s.GetTenant(ctx, callerTenantID)
	if err != nil {
		return BootstrapOutput{}, err
	}
	if callerRole != domain.RoleSuperAdmin && strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return BootstrapOutput{}, apperr.Forbidden("La suscripción de esta empresa se encuentra suspendida")
	}
	var tenantsList []*domain.Tenant
	if callerRole == domain.RoleSuperAdmin {
		tenantsList, err = s.repo.List(ctx)
		if err != nil {
			return BootstrapOutput{}, err
		}
	} else {
		tenantsList = []*domain.Tenant{ten.Clone()}
	}
	return BootstrapOutput{
		Catalog:  s.catalog.Catalog(),
		Tenant:   ten,
		Tenants:  tenantsList,
		UserRole: callerRole,
	}, nil
}

func (s *CoreService) UpdateSubscriptions(ctx context.Context, callerRole, targetTenantID string, svcs, mods, submods, feats []string) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global de plataforma puede modificar licencias")
	}
	cat := s.catalog.Catalog()
	resolvedSubmods := submods
	if resolvedSubmods == nil {
		modSet := make(map[string]bool, len(mods))
		for _, mk := range mods {
			modSet[strings.TrimSpace(mk)] = true
		}
		svcSet := make(map[string]bool, len(svcs))
		for _, sk := range svcs {
			svcSet[strings.TrimSpace(sk)] = true
		}
		resolvedSubmods = make([]string, 0)
		for _, svc := range cat {
			if !svcSet[svc.ServiceKey] {
				continue
			}
			for _, sm := range svc.Submodules {
				if sm.DependsOnModule == "" || modSet[sm.DependsOnModule] {
					resolvedSubmods = append(resolvedSubmods, sm.SubmoduleKey)
				}
			}
		}
	}
	if err := licensegate.ValidateSubscriptionState4(cat, svcs, mods, resolvedSubmods, feats); err != nil {
		return nil, err
	}
	ten, err := s.repo.GetByID(ctx, targetTenantID)
	if err != nil {
		return nil, err
	}
	updated := ten.Clone()
	updated.ActiveServices = dedupeStrings(svcs)
	updated.ActiveModules = dedupeStrings(mods)
	updated.ActiveSubmodules = dedupeStrings(resolvedSubmods)
	updated.ActiveFeatures = dedupeStrings(feats)
	if err := s.repo.UpdateSubscriptions(ctx, updated); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(targetTenantID)
	return updated.Clone(), nil
}

func (s *CoreService) SetTenantStatus(ctx context.Context, callerRole, targetTenantID, rawStatus string) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global de plataforma puede suspender o reactivar empresas")
	}
	cleanID := strings.TrimSpace(targetTenantID)
	if cleanID == "" {
		return nil, apperr.Validation("Identificador de empresa requerido")
	}
	normStatus := strings.ToUpper(strings.TrimSpace(rawStatus))
	if normStatus != "ACTIVE" && normStatus != "SUSPENDED" {
		return nil, apperr.Validation("Estado inválido: debe ser ACTIVE o SUSPENDED")
	}
	if err := s.repo.UpdateStatus(ctx, cleanID, normStatus); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
	return s.GetTenant(ctx, cleanID)
}

func (s *CoreService) Impersonate(ctx context.Context, callerRole, targetTenantID string) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Cambio de empresa permitido únicamente para superadministradores")
	}
	ten, err := s.repo.GetByID(ctx, strings.TrimSpace(targetTenantID))
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return nil, apperr.Forbidden("No es posible abrir la estación operativa de una empresa suspendida; reactívala primero")
	}
	s.invalidateTenantCache(targetTenantID)
	return ten.Clone(), nil
}

func (s *CoreService) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	cleanID := strings.TrimSpace(tenantID)
	now := time.Now()
	s.cacheMu.RLock()
	if hit, ok := s.tenantCache[cleanID]; ok && now.Before(hit.expiresAt) {
		cloned := hit.tenant.Clone()
		s.cacheMu.RUnlock()
		return cloned, nil
	}
	s.cacheMu.RUnlock()

	ten, err := s.repo.GetByID(ctx, cleanID)
	if err != nil {
		return nil, err
	}
	s.cacheMu.Lock()
	s.tenantCache[cleanID] = cachedTenant{
		tenant:    ten.Clone(),
		expiresAt: now.Add(tenantCacheTTL),
	}
	s.cacheMu.Unlock()
	return ten.Clone(), nil
}

func (s *CoreService) defaultSuperAdminTenant(ctx context.Context) (*domain.Tenant, error) {
	if ten, err := s.repo.GetByID(ctx, "demo-empresa"); err == nil && ten != nil {
		return ten.Clone(), nil
	}
	all, err := s.repo.List(ctx)
	if err != nil || len(all) == 0 {
		return nil, apperr.NotFound("No existen empresas registradas en el sistema")
	}
	return all[0].Clone(), nil
}

func normalizeDefaultSubscriptions(cat []licensegate.ServiceManifest, svcs, mods, submods, feats []string) ([]string, []string, []string, []string) {
	var outSvcs []string
	if len(svcs) > 0 {
		outSvcs = dedupeStrings(svcs)
	} else {
		for _, s := range cat {
			outSvcs = append(outSvcs, s.ServiceKey)
		}
	}
	svcSet := make(map[string]bool, len(outSvcs))
	for _, sk := range outSvcs {
		svcSet[sk] = true
	}

	var outMods []string
	if mods != nil {
		outMods = dedupeStrings(mods)
	} else {
		for _, s := range cat {
			if !svcSet[s.ServiceKey] {
				continue
			}
			for _, m := range s.Modules {
				if m.DefaultActive {
					outMods = append(outMods, m.ModuleKey)
				}
			}
		}
	}
	modSet := make(map[string]bool, len(outMods))
	for _, mk := range outMods {
		modSet[mk] = true
	}

	var outSubmods []string
	if submods != nil {
		outSubmods = dedupeStrings(submods)
	} else {
		for _, s := range cat {
			if !svcSet[s.ServiceKey] {
				continue
			}
			for _, sm := range s.Submodules {
				if sm.DefaultActive && (sm.DependsOnModule == "" || modSet[sm.DependsOnModule]) {
					outSubmods = append(outSubmods, sm.SubmoduleKey)
				}
			}
		}
	}
	submodSet := make(map[string]bool, len(outSubmods))
	for _, smk := range outSubmods {
		submodSet[smk] = true
	}

	var outFeats []string
	if feats != nil {
		outFeats = dedupeStrings(feats)
	} else {
		for _, s := range cat {
			if !svcSet[s.ServiceKey] {
				continue
			}
			for _, f := range s.Features {
				modOk := f.DependsOnModule == "" || modSet[f.DependsOnModule]
				subOk := f.DependsOnSubmodule == "" || submodSet[f.DependsOnSubmodule]
				if f.DefaultActive && modOk && subOk {
					outFeats = append(outFeats, f.FeatureKey)
				}
			}
		}
	}
	return outSvcs, outMods, outSubmods, outFeats
}

func dedupeStrings(in []string) []string {
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, raw := range in {
		v := strings.TrimSpace(raw)
		if v != "" && !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	return out
}
