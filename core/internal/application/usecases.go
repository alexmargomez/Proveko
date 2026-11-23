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
	gen       uint64
	expiresAt time.Time
}

type cachedUser struct {
	user      *domain.TenantUser
	expiresAt time.Time
}

type UserProfileDTO struct {
	UserID         string `json:"userId"`
	Username       string `json:"username"`
	FullName       string `json:"fullName"`
	InternalRole   string `json:"internalRole"`
	IsCompanyAdmin bool   `json:"isCompanyAdmin"`
	IsDemo         bool   `json:"isDemo"`
}

type PublicCatalogOutput struct {
	Catalog       []licensegate.ServiceManifest `json:"catalog"`
	Presets       []domain.BusinessPresetSpec   `json:"presets"`
	Pricing       domain.PricingMatrixCOP       `json:"pricing"`
	RoleTemplates []domain.RoleTemplateSpec     `json:"roleTemplates"`
}

type BootstrapOutput struct {
	Catalog       []licensegate.ServiceManifest `json:"catalog"`
	Tenant        *domain.Tenant                `json:"tenant"`
	CompanyTenant *domain.Tenant                `json:"companyTenant,omitempty"`
	Tenants       []*domain.Tenant              `json:"tenants"`
	UserRole      string                        `json:"userRole"`
	UserProfile   UserProfileDTO                `json:"userProfile"`
	Presets       []domain.BusinessPresetSpec   `json:"presets"`
	Pricing       domain.PricingMatrixCOP       `json:"pricing"`
	RoleTemplates []domain.RoleTemplateSpec     `json:"roleTemplates"`
}

type AuthOutput struct {
	Tenant         *domain.Tenant
	CompanyTenant  *domain.Tenant
	UserID         string
	Role           string
	InternalRole   string
	Username       string
	FullName       string
	IsCompanyAdmin bool
	IsDemo         bool
}

type CoreService struct {
	repo          domain.TenantRepository
	provisioner   domain.DatabaseProvisioner
	catalog       domain.CatalogProvider
	vault         domain.SecretVault
	superEmail    string
	superPassHash string
	demoSeedMu    sync.Mutex
	cacheMu       sync.RWMutex
	cacheGen      uint64
	tenantCache   map[string]cachedTenant
	userCache     map[string]cachedUser
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
		userCache:     make(map[string]cachedUser),
	}, nil
}

func (s *CoreService) invalidateTenantCache(tenantID string) {
	clean := strings.TrimSpace(tenantID)
	s.cacheMu.Lock()
	s.cacheGen++
	delete(s.tenantCache, clean)
	for k := range s.userCache {
		if strings.HasPrefix(k, clean+":") {
			delete(s.userCache, k)
		}
	}
	s.cacheMu.Unlock()
}

func (s *CoreService) invalidateUserCache(tenantID, userID string) {
	key := strings.TrimSpace(tenantID) + ":" + strings.TrimSpace(userID)
	s.cacheMu.Lock()
	s.cacheGen++
	delete(s.userCache, key)
	s.cacheMu.Unlock()
}

func (s *CoreService) getCachedUser(ctx context.Context, tenantID, userID string) (*domain.TenantUser, error) {
	cleanTen := strings.TrimSpace(tenantID)
	cleanUsr := strings.TrimSpace(userID)
	cacheKey := cleanTen + ":" + cleanUsr
	now := time.Now()

	s.cacheMu.RLock()
	genBefore := s.cacheGen
	if hit, ok := s.userCache[cacheKey]; ok && now.Before(hit.expiresAt) {
		cp := hit.user.Clone()
		s.cacheMu.RUnlock()
		return cp, nil
	}
	s.cacheMu.RUnlock()

	usr, err := s.repo.GetUserByID(ctx, cleanTen, cleanUsr)
	if err != nil {
		return nil, err
	}
	s.cacheMu.Lock()
	if s.cacheGen == genBefore {
		s.userCache[cacheKey] = cachedUser{
			user:      usr.Clone(),
			expiresAt: now.Add(tenantCacheTTL),
		}
	}
	s.cacheMu.Unlock()
	return usr.Clone(), nil
}

func (s *CoreService) SeedDemoTenant(ctx context.Context, demoPassword string) error {
	s.demoSeedMu.Lock()
	defer s.demoSeedMu.Unlock()

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
		AdminFullName:  "Gerencia Demostración",
		AdminUsername:  "admin@empresa.co",
		Password:       demoPassword,
		BusinessPreset: "full",
		IsDemo:         true,
	}, false)
	return err
}

func (s *CoreService) Catalog() []licensegate.ServiceManifest {
	return s.catalog.Catalog()
}

func (s *CoreService) PublicCatalog() PublicCatalogOutput {
	cat := s.catalog.Catalog()
	return PublicCatalogOutput{
		Catalog:       cat,
		Presets:       domain.OfficialBusinessPresets(cat),
		Pricing:       domain.DefaultPricingMatrixCOP(),
		RoleTemplates: domain.OfficialRoleTemplates(),
	}
}

func findRoleTemplate(roleKey string) (domain.RoleTemplateSpec, bool) {
	k := strings.ToLower(strings.TrimSpace(roleKey))
	for _, tpl := range domain.OfficialRoleTemplates() {
		if tpl.RoleKey == k {
			return tpl, true
		}
	}
	return domain.RoleTemplateSpec{}, false
}

func (s *CoreService) StartDemoSession(ctx context.Context, rolePreview string) (AuthOutput, error) {
	ten, err := s.repo.GetByID(ctx, "demo-empresa")
	if err != nil || ten == nil {
		if seedErr := s.SeedDemoTenant(ctx, "AdminPlataforma2026*"); seedErr != nil {
			return AuthOutput{}, seedErr
		}
		ten, err = s.repo.GetByID(ctx, "demo-empresa")
		if err != nil {
			return AuthOutput{}, err
		}
	}
	if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return AuthOutput{}, apperr.Forbidden("El entorno de demostración se encuentra temporalmente deshabilitado")
	}

	selectedRole := strings.ToLower(strings.TrimSpace(rolePreview))
	if selectedRole == "" {
		selectedRole = "admin_empresa"
	}
	tpl, ok := findRoleTemplate(selectedRole)
	if !ok {
		return AuthOutput{}, apperr.Validation("El rol de demostración solicitado no es válido")
	}

	cat := s.catalog.Catalog()
	effectiveTenant := ten.Clone()
	effectiveTenant.IsDemo = true
	isAdmin := tpl.IsCompanyAdmin
	fullName := "Demostración — " + tpl.DisplayName

	if !isAdmin {
		fakeUser := &domain.TenantUser{
			InternalRole:    tpl.RoleKey,
			IsCompanyAdmin:  false,
			AllowedServices: tpl.RecommendedServices,
			AllowedModules:  tpl.RecommendedModules,
		}
		eff := domain.ComputeEffectiveLicense(ten, fakeUser, domain.RoleCliente, cat)
		effectiveTenant.ActiveServices = eff.ActiveServices
		effectiveTenant.ActiveModules = eff.ActiveModules
		effectiveTenant.ActiveSubmodules = eff.ActiveSubmodules
		effectiveTenant.ActiveFeatures = eff.ActiveFeatures
		effectiveTenant.MonthlyCop = 0
	}

	var exposedCompany *domain.Tenant
	if isAdmin {
		exposedCompany = ten.Clone()
	}

	return AuthOutput{
		Tenant:         effectiveTenant,
		CompanyTenant:  exposedCompany,
		UserID:         "demo_visitor_" + selectedRole,
		Role:           domain.RoleCliente,
		InternalRole:   selectedRole,
		Username:       "demo." + selectedRole + "@empresa.co",
		FullName:       fullName,
		IsCompanyAdmin: isAdmin,
		IsDemo:         true,
	}, nil
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
			Tenant:         ten,
			CompanyTenant:  ten.Clone(),
			UserID:         "superadmin",
			Role:           domain.RoleSuperAdmin,
			InternalRole:   "superadmin",
			Username:       uLow,
			FullName:       "SuperAdministrador Corporativo",
			IsCompanyAdmin: true,
		}, nil
	}

	cat := s.catalog.Catalog()
	if usr, err := s.repo.GetUserByUsername(ctx, uLow); err == nil && usr != nil {
		if !authguard.VerifyPassword(password, usr.PasswordHash) {
			return AuthOutput{}, apperr.Unauthorized("Credenciales de acceso inválidas")
		}
		if strings.EqualFold(strings.TrimSpace(usr.Status), "SUSPENDED") {
			return AuthOutput{}, apperr.Forbidden("Tu cuenta de usuario ha sido suspendida por el administrador de la empresa")
		}
		ten, err := s.GetTenant(ctx, usr.TenantID)
		if err != nil {
			return AuthOutput{}, apperr.Unauthorized("Credenciales de acceso inválidas")
		}
		if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
			return AuthOutput{}, apperr.Forbidden("La suscripción de esta empresa se encuentra suspendida")
		}
		eff := domain.ComputeEffectiveLicense(ten, usr, domain.RoleCliente, cat)
		effTenant := ten.Clone()
		effTenant.ActiveServices = eff.ActiveServices
		effTenant.ActiveModules = eff.ActiveModules
		effTenant.ActiveSubmodules = eff.ActiveSubmodules
		effTenant.ActiveFeatures = eff.ActiveFeatures
		var exposedCompany *domain.Tenant
		if usr.IsCompanyAdmin {
			exposedCompany = ten.Clone()
		} else {
			effTenant.MonthlyCop = 0
			effTenant.PaymentStatus = ""
		}
		return AuthOutput{
			Tenant:         effTenant,
			CompanyTenant:  exposedCompany,
			UserID:         usr.UserID,
			Role:           domain.RoleCliente,
			InternalRole:   usr.InternalRole,
			Username:       usr.Username,
			FullName:       usr.FullName,
			IsCompanyAdmin: usr.IsCompanyAdmin,
			IsDemo:         ten.IsDemo,
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
		Tenant:         ten.Clone(),
		CompanyTenant:  ten.Clone(),
		UserID:         "usr_" + ten.TenantID,
		Role:           role,
		InternalRole:   "admin_empresa",
		Username:       ten.AdminUsername,
		FullName:       "Administrador " + ten.CompanyName,
		IsCompanyAdmin: true,
		IsDemo:         ten.IsDemo,
	}, nil
}

func (s *CoreService) RegisterTenant(ctx context.Context, in domain.CreateTenantInput) (*domain.Tenant, error) {
	in.TenantID = ""
	in.IsDemo = false
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
	if existingUsr, err := s.repo.GetUserByUsername(ctx, adminUser); err == nil && existingUsr != nil {
		return nil, apperr.Conflict("El usuario administrador ya se encuentra registrado")
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
	presetKey := strings.TrimSpace(in.BusinessPreset)
	if presetKey == "" {
		presetKey = strings.TrimSpace(in.Industry)
	}
	if presetKey == "" {
		presetKey = "comercio"
	}

	requestedSvcs := in.Services
	if len(requestedSvcs) == 0 {
		requestedSvcs = resolvePresetServices(cat, presetKey)
	}
	svcs, mods, submods, feats := normalizeDefaultSubscriptions(cat, requestedSvcs, in.Modules, in.Submodules, in.Features)
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

	monthlyCop := domain.CalculateSubscriptionCop(cat, presetKey, svcs)
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
		BusinessPreset:   presetKey,
		PaymentStatus:    "ACTIVA_VERIFICADA",
		MonthlyCop:       monthlyCop,
		MaxUsersAllowed:  15,
		IsDemo:           in.IsDemo,
		Status:           "ACTIVE",
		ActiveServices:   svcs,
		ActiveModules:    mods,
		ActiveSubmodules: submods,
		ActiveFeatures:   feats,
		CreatedAt:        time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.Create(ctx, rec); err != nil {
		return nil, err
	}
	if fullName := strings.TrimSpace(in.AdminFullName); fullName != "" {
		if rootUsr, err := s.repo.GetUserByID(ctx, tID, "usr_"+tID); err == nil && rootUsr != nil {
			rootUsr.FullName = fullName
			if uErr := s.repo.UpdateUser(ctx, rootUsr); uErr != nil {
				return nil, uErr
			}
		}
	}
	s.invalidateTenantCache(tID)
	return rec.Clone(), nil
}

func (s *CoreService) ProvisionTenantAsSuperAdmin(ctx context.Context, callerRole string, in domain.CreateTenantInput) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global de plataforma puede aprovisionar empresas desde la consola corporativa")
	}
	in.TenantID = ""
	in.IsDemo = false
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

func (s *CoreService) ResolveLiveSession(ctx context.Context, tc authguard.TenantContext) (authguard.TenantContext, *domain.Tenant, error) {
	liveTenant, err := s.GetTenant(ctx, tc.TenantID)
	if err != nil {
		return tc, nil, apperr.Unauthorized("Empresa asociada a la sesión no encontrada")
	}
	if tc.Role != domain.RoleSuperAdmin && strings.EqualFold(strings.TrimSpace(liveTenant.Status), "SUSPENDED") {
		return tc, nil, apperr.Forbidden("La suscripción de esta empresa se encuentra suspendida")
	}
	tc.DBName = liveTenant.DBName
	if liveTenant.IsDemo {
		tc.IsDemo = true
	}

	cat := s.catalog.Catalog()
	if tc.Role == domain.RoleSuperAdmin {
		tc.IsCompanyAdmin = true
		tc.ActiveServices = liveTenant.ActiveServices
		tc.ActiveModules = liveTenant.ActiveModules
		tc.ActiveSubmodules = liveTenant.ActiveSubmodules
		tc.ActiveFeatures = liveTenant.ActiveFeatures
		return tc, liveTenant, nil
	}

	// Demo visitor sessions NEVER touch tenant_users and validate strictly against OfficialRoleTemplates
	if strings.HasPrefix(tc.UserID, "demo_visitor_") || (tc.IsDemo && !strings.EqualFold(tc.Username, liveTenant.AdminUsername)) {
		roleKey := tc.InternalRole
		if roleKey == "" {
			roleKey = "admin_empresa"
		}
		tpl, ok := findRoleTemplate(roleKey)
		if !ok {
			return tc, nil, apperr.Unauthorized("Rol de sesión demo inválido")
		}
		tc.IsDemo = true
		tc.IsCompanyAdmin = tpl.IsCompanyAdmin
		if tpl.IsCompanyAdmin {
			tc.ActiveServices = liveTenant.ActiveServices
			tc.ActiveModules = liveTenant.ActiveModules
			tc.ActiveSubmodules = liveTenant.ActiveSubmodules
			tc.ActiveFeatures = liveTenant.ActiveFeatures
		} else {
			eff := domain.ComputeEffectiveLicense(liveTenant, &domain.TenantUser{
				InternalRole:    tpl.RoleKey,
				IsCompanyAdmin:  false,
				AllowedServices: tpl.RecommendedServices,
				AllowedModules:  tpl.RecommendedModules,
			}, tc.Role, cat)
			tc.ActiveServices = eff.ActiveServices
			tc.ActiveModules = eff.ActiveModules
			tc.ActiveSubmodules = eff.ActiveSubmodules
			tc.ActiveFeatures = eff.ActiveFeatures
		}
		return tc, liveTenant, nil
	}

	// Fail-Closed resolution for real tenant users
	if tc.UserID != "" {
		liveUser, uErr := s.getCachedUser(ctx, tc.TenantID, tc.UserID)
		if uErr != nil && !apperr.IsKind(uErr, apperr.KindNotFound) {
			return tc, nil, apperr.Internal("No fue posible verificar la vigencia de la cuenta de usuario")
		}
		if liveUser != nil {
			if liveUser.TenantID != tc.TenantID {
				return tc, nil, apperr.Unauthorized("Identidad de usuario no corresponde a la empresa activa")
			}
			if strings.EqualFold(strings.TrimSpace(liveUser.Status), "SUSPENDED") {
				return tc, nil, apperr.Forbidden("Tu cuenta de usuario se encuentra suspendida")
			}
			tc.UserID = liveUser.UserID
			tc.FullName = liveUser.FullName
			tc.InternalRole = liveUser.InternalRole
			tc.IsCompanyAdmin = liveUser.IsCompanyAdmin
			eff := domain.ComputeEffectiveLicense(liveTenant, liveUser, tc.Role, cat)
			tc.ActiveServices = eff.ActiveServices
			tc.ActiveModules = eff.ActiveModules
			tc.ActiveSubmodules = eff.ActiveSubmodules
			tc.ActiveFeatures = eff.ActiveFeatures
			return tc, liveTenant, nil
		}
		// UserID was NOT found in tenant_users: ONLY allow if this is the unmigrated root owner row itself
		if tc.UserID == "usr_"+liveTenant.TenantID && strings.EqualFold(tc.Username, liveTenant.AdminUsername) {
			tc.IsCompanyAdmin = true
			tc.InternalRole = "admin_empresa"
			tc.ActiveServices = liveTenant.ActiveServices
			tc.ActiveModules = liveTenant.ActiveModules
			tc.ActiveSubmodules = liveTenant.ActiveSubmodules
			tc.ActiveFeatures = liveTenant.ActiveFeatures
			return tc, liveTenant, nil
		}
		return tc, nil, apperr.Unauthorized("Sesión revocada: la cuenta de usuario ya no se encuentra activa")
	}

	// Legacy token without UserID: must match root AdminUsername or a user belonging strictly to tc.TenantID
	if strings.EqualFold(tc.Username, liveTenant.AdminUsername) {
		tc.UserID = "usr_" + liveTenant.TenantID
		tc.IsCompanyAdmin = true
		tc.InternalRole = "admin_empresa"
		tc.ActiveServices = liveTenant.ActiveServices
		tc.ActiveModules = liveTenant.ActiveModules
		tc.ActiveSubmodules = liveTenant.ActiveSubmodules
		tc.ActiveFeatures = liveTenant.ActiveFeatures
		return tc, liveTenant, nil
	}

	liveUser, uErr := s.repo.GetUserByUsername(ctx, tc.Username)
	if uErr != nil {
		if apperr.IsKind(uErr, apperr.KindNotFound) {
			return tc, nil, apperr.Unauthorized("Sesión revocada: usuario no encontrado")
		}
		return tc, nil, apperr.Internal("Error verificando sesión de usuario")
	}
	if liveUser == nil || liveUser.TenantID != tc.TenantID {
		return tc, nil, apperr.Unauthorized("Sesión inválida para la empresa solicitada")
	}
	if strings.EqualFold(strings.TrimSpace(liveUser.Status), "SUSPENDED") {
		return tc, nil, apperr.Forbidden("Tu cuenta de usuario se encuentra suspendida")
	}
	tc.UserID = liveUser.UserID
	tc.FullName = liveUser.FullName
	tc.InternalRole = liveUser.InternalRole
	tc.IsCompanyAdmin = liveUser.IsCompanyAdmin
	eff := domain.ComputeEffectiveLicense(liveTenant, liveUser, tc.Role, cat)
	tc.ActiveServices = eff.ActiveServices
	tc.ActiveModules = eff.ActiveModules
	tc.ActiveSubmodules = eff.ActiveSubmodules
	tc.ActiveFeatures = eff.ActiveFeatures
	return tc, liveTenant, nil
}

func (s *CoreService) Bootstrap(ctx context.Context, tc authguard.TenantContext) (BootstrapOutput, error) {
	if strings.TrimSpace(tc.TenantID) == "" {
		return BootstrapOutput{}, apperr.Unauthorized("Sesión no autenticada")
	}
	resolvedTC, companyTenant, err := s.ResolveLiveSession(ctx, tc)
	if err != nil {
		return BootstrapOutput{}, err
	}

	effTenant := companyTenant.Clone()
	effTenant.ActiveServices = resolvedTC.ActiveServices
	effTenant.ActiveModules = resolvedTC.ActiveModules
	effTenant.ActiveSubmodules = resolvedTC.ActiveSubmodules
	effTenant.ActiveFeatures = resolvedTC.ActiveFeatures
	if resolvedTC.IsDemo {
		effTenant.IsDemo = true
	}

	var exposedCompanyTenant *domain.Tenant
	if resolvedTC.IsCompanyAdmin || resolvedTC.Role == domain.RoleSuperAdmin {
		exposedCompanyTenant = companyTenant.Clone()
	} else {
		effTenant.MonthlyCop = 0
		effTenant.PaymentStatus = ""
	}

	var tenantsList []*domain.Tenant
	if resolvedTC.Role == domain.RoleSuperAdmin {
		tenantsList, err = s.repo.List(ctx)
		if err != nil {
			return BootstrapOutput{}, err
		}
	} else {
		tenantsList = []*domain.Tenant{effTenant.Clone()}
	}

	cat := s.catalog.Catalog()
	fullName := resolvedTC.FullName
	if fullName == "" {
		fullName = resolvedTC.Username
	}
	internalRole := resolvedTC.InternalRole
	if internalRole == "" {
		internalRole = "admin_empresa"
	}

	return BootstrapOutput{
		Catalog:       cat,
		Tenant:        effTenant,
		CompanyTenant: exposedCompanyTenant,
		Tenants:       tenantsList,
		UserRole:      resolvedTC.Role,
		UserProfile: UserProfileDTO{
			UserID:         resolvedTC.UserID,
			Username:       resolvedTC.Username,
			FullName:       fullName,
			InternalRole:   internalRole,
			IsCompanyAdmin: resolvedTC.IsCompanyAdmin,
			IsDemo:         resolvedTC.IsDemo,
		},
		Presets:       domain.OfficialBusinessPresets(cat),
		Pricing:       domain.DefaultPricingMatrixCOP(),
		RoleTemplates: domain.OfficialRoleTemplates(),
	}, nil
}

func (s *CoreService) UpdateSubscriptions(ctx context.Context, callerRole, targetTenantID string, svcs, mods, submods, feats []string) (*domain.Tenant, error) {
	if callerRole != domain.RoleSuperAdmin {
		return nil, apperr.Forbidden("Solo el administrador global de plataforma puede modificar licencias maestras")
	}
	cleanID := strings.TrimSpace(targetTenantID)
	cat := s.catalog.Catalog()
	dedupSvcs := dedupeStrings(svcs)
	dedupMods := dedupeStrings(mods)
	resolvedSubmods := dedupeStrings(resolveMissingSubmodulesIfNil(cat, dedupSvcs, dedupMods, submods))
	dedupFeats := dedupeStrings(feats)
	if err := licensegate.ValidateSubscriptionState4(cat, dedupSvcs, dedupMods, resolvedSubmods, dedupFeats); err != nil {
		return nil, err
	}
	ten, err := s.repo.GetByID(ctx, cleanID)
	if err != nil {
		return nil, err
	}
	updated := ten.Clone()
	updated.ActiveServices = dedupSvcs
	updated.ActiveModules = dedupMods
	updated.ActiveSubmodules = resolvedSubmods
	updated.ActiveFeatures = dedupFeats
	updated.MonthlyCop = domain.CalculateSubscriptionCop(cat, updated.BusinessPreset, updated.ActiveServices)
	if err := s.repo.UpdateSubscriptions(ctx, updated); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
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
	cleanID := strings.TrimSpace(targetTenantID)
	ten, err := s.repo.GetByID(ctx, cleanID)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return nil, apperr.Forbidden("No es posible abrir la estación operativa de una empresa suspendida; reactívala primero")
	}
	s.invalidateTenantCache(cleanID)
	return ten.Clone(), nil
}

func (s *CoreService) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	cleanID := strings.TrimSpace(tenantID)
	now := time.Now()
	s.cacheMu.RLock()
	genBefore := s.cacheGen
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
	if s.cacheGen == genBefore {
		s.tenantCache[cleanID] = cachedTenant{
			tenant:    ten.Clone(),
			gen:       genBefore,
			expiresAt: time.Now().Add(tenantCacheTTL),
		}
	}
	s.cacheMu.Unlock()
	return ten.Clone(), nil
}

func (s *CoreService) ServiceDisplayName(serviceKey string) string {
	for _, m := range s.catalog.Catalog() {
		if m.ServiceKey == serviceKey {
			return m.DisplayName
		}
	}
	return serviceKey
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

func (s *CoreService) RepairEmptyModuleTenants(ctx context.Context) error {
	tenants, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	cat := s.catalog.Catalog()
	for _, ten := range tenants {
		if len(ten.ActiveServices) > 0 && len(ten.ActiveModules) == 0 {
			svcs, mods, submods, feats := normalizeDefaultSubscriptions(cat, ten.ActiveServices, nil, nil, nil)
			ten.ActiveServices = svcs
			ten.ActiveModules = mods
			ten.ActiveSubmodules = submods
			ten.ActiveFeatures = feats
			ten.MonthlyCop = domain.CalculateSubscriptionCop(cat, ten.BusinessPreset, svcs)
			if err := s.repo.UpdateSubscriptions(ctx, ten); err != nil {
				return err
			}
			s.invalidateTenantCache(ten.TenantID)
		}
	}
	return nil
}

func resolvePresetServices(cat []licensegate.ServiceManifest, preset string) []string {
	if spec, ok := domain.FindPresetSpec(cat, preset); ok {
		return spec.IncludedServices
	}
	return nil
}

func resolveMissingSubmodulesIfNil(cat []licensegate.ServiceManifest, svcs, mods, submods []string) []string {
	if submods != nil {
		return submods
	}
	modSet := make(map[string]bool, len(mods))
	for _, mk := range mods {
		modSet[strings.TrimSpace(mk)] = true
	}
	svcSet := make(map[string]bool, len(svcs))
	for _, sk := range svcs {
		svcSet[strings.TrimSpace(sk)] = true
	}
	out := make([]string, 0)
	for _, svc := range cat {
		if !svcSet[svc.ServiceKey] {
			continue
		}
		for _, sm := range svc.Submodules {
			if sm.DependsOnModule == "" || modSet[sm.DependsOnModule] {
				out = append(out, sm.SubmoduleKey)
			}
		}
	}
	return out
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
	if len(mods) > 0 {
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
	if len(submods) > 0 {
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
	for _, sk := range outSubmods {
		submodSet[sk] = true
	}

	var outFeats []string
	if len(feats) > 0 {
		outFeats = dedupeStrings(feats)
	} else {
		for _, s := range cat {
			if !svcSet[s.ServiceKey] {
				continue
			}
			for _, f := range s.Features {
				if !f.DefaultActive || !modSet[f.DependsOnModule] {
					continue
				}
				if f.DependsOnSubmodule != "" && !submodSet[f.DependsOnSubmodule] {
					continue
				}
				outFeats = append(outFeats, f.FeatureKey)
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
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}
