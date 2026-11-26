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
	"ms-core/internal/platform/totp"
)

type TOTPSetupOutput struct {
	UserID     string `json:"userId"`
	Secret     string `json:"secret"`
	OTPAuthURI string `json:"otpauthUri"`
}

func (s *CoreService) SeedPlatformDefaults(ctx context.Context) error {
	if s.staffRepo == nil {
		return nil
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, role := range domain.OfficialPlatformRoles(now) {
		if existing, err := s.staffRepo.GetPlatformRole(ctx, role.RoleKey); err == nil && existing != nil {
			continue
		}
		if err := s.staffRepo.UpsertPlatformRole(ctx, role); err != nil {
			return err
		}
	}

	if existing, err := s.staffRepo.GetPlatformUserByEmail(ctx, s.superEmail); err == nil && existing != nil {
		return nil
	}
	superUser := &domain.PlatformUser{
		UserID:         "usr_platform_superadmin",
		Email:          s.superEmail,
		FullName:       "SuperAdministrador Corporativo",
		PasswordHash:   s.superPassHash,
		RoleKey:        domain.PlatformRoleSuperAdmin,
		Status:         "ACTIVE",
		MFAEnabled:     false,
		MFARequired:    false,
		AllowedTenants: []string{"*"},
		SessionVersion: 1,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.staffRepo.CreatePlatformUser(ctx, superUser); err != nil {
		if !apperr.IsKind(err, apperr.KindConflict) {
			return err
		}
	}
	return nil
}

func (s *CoreService) authenticatePlatformUser(ctx context.Context, email, password string) (AuthOutput, bool, error) {
	if s.staffRepo == nil {
		return AuthOutput{}, false, nil
	}
	u, err := s.staffRepo.GetPlatformUserByEmail(ctx, email)
	if err != nil {
		if apperr.IsKind(err, apperr.KindNotFound) {
			return AuthOutput{}, false, nil
		}
		return AuthOutput{}, true, err
	}
	if !authguard.VerifyPassword(password, u.PasswordHash) {
		return AuthOutput{}, true, apperr.Unauthorized("Credenciales de acceso inválidas")
	}
	if strings.EqualFold(strings.TrimSpace(u.Status), "SUSPENDED") {
		return AuthOutput{}, true, apperr.Forbidden("Tu cuenta de operador interno se encuentra suspendida")
	}
	role, err := s.staffRepo.GetPlatformRole(ctx, u.RoleKey)
	if err != nil {
		return AuthOutput{}, true, apperr.Forbidden("El rol asignado a tu cuenta de plataforma no existe")
	}

	requireMFA := u.MFAEnabled || u.MFARequired || role.RequireMFA
	if requireMFA {
		var setupSecret, setupURI string
		requiresSetup := false
		if !u.MFAEnabled || strings.TrimSpace(u.MFASecretEncrypted) == "" {
			requiresSetup = true
			if strings.TrimSpace(u.MFASecretEncrypted) != "" && s.vault != nil {
				if plain, openErr := s.vault.OpenSecret("totp:"+u.UserID, u.MFASecretEncrypted); openErr == nil && plain != "" {
					setupSecret = plain
				}
			}
			if setupSecret == "" {
				sec, genErr := totp.GenerateSecret()
				if genErr != nil {
					return AuthOutput{}, true, apperr.Internal("No fue posible generar secreto 2FA")
				}
				setupSecret = sec
				sealed := sec
				if s.vault != nil {
					if enc, sealErr := s.vault.SealSecret("totp:"+u.UserID, sec); sealErr == nil {
						sealed = enc
					}
				}
				u.MFASecretEncrypted = sealed
				u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
				if updErr := s.staffRepo.UpdatePlatformUser(ctx, u); updErr != nil {
					return AuthOutput{}, true, updErr
				}
			}
			setupURI = totp.BuildOTPAuthURI("Proveko Admin", u.Email, setupSecret)
		}
		return AuthOutput{
			Plane:               domain.PlanePlatform,
			UserID:              u.UserID,
			Role:                platformJWTCompatRole(role.RoleKey),
			InternalRole:        role.RoleKey,
			Username:            u.Email,
			FullName:            u.FullName,
			PlatformRole:        role.RoleKey,
			PlatformPermissions: role.Permissions,
			AllowedTenants:      u.AllowedTenants,
			RequireDataReason:   role.RequireDataReason,
			SessionVersion:      u.SessionVersion,
			RequiresTOTP:        true,
			RequiresTOTPSetup:   requiresSetup,
			TOTPSetupSecret:     setupSecret,
			TOTPSetupURI:        setupURI,
		}, true, nil
	}

	return s.buildPlatformAuthOutput(ctx, u, role)
}

func (s *CoreService) buildPlatformAuthOutput(ctx context.Context, u *domain.PlatformUser, role *domain.PlatformRole) (AuthOutput, bool, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	_ = s.staffRepo.TouchPlatformUserLogin(ctx, u.UserID, now)

	ten, _ := s.defaultSuperAdminTenant(ctx)
	var companyCopy *domain.Tenant
	if ten != nil {
		companyCopy = ten.Clone()
	}
	return AuthOutput{
		Plane:               domain.PlanePlatform,
		Tenant:              ten,
		CompanyTenant:       companyCopy,
		UserID:              u.UserID,
		Role:                platformJWTCompatRole(role.RoleKey),
		InternalRole:        role.RoleKey,
		Username:            u.Email,
		FullName:            u.FullName,
		IsCompanyAdmin:      role.RoleKey == domain.PlatformRoleSuperAdmin,
		PlatformRole:        role.RoleKey,
		PlatformPermissions: role.Permissions,
		AllowedTenants:      u.AllowedTenants,
		RequireDataReason:   role.RequireDataReason,
		SessionVersion:      u.SessionVersion,
	}, true, nil
}

func platformJWTCompatRole(roleKey string) string {
	if roleKey == domain.PlatformRoleSuperAdmin {
		return domain.RoleSuperAdmin
	}
	return "platform_staff"
}

func (s *CoreService) VerifyPlatformTOTP(ctx context.Context, userID, code string) (AuthOutput, error) {
	if s.staffRepo == nil {
		return AuthOutput{}, apperr.Internal("Repositorio de personal interno no disponible")
	}
	u, err := s.staffRepo.GetPlatformUserByID(ctx, userID)
	if err != nil {
		return AuthOutput{}, apperr.Unauthorized("Operador no encontrado")
	}
	if strings.EqualFold(strings.TrimSpace(u.Status), "SUSPENDED") {
		return AuthOutput{}, apperr.Forbidden("Tu cuenta de operador interno se encuentra suspendida")
	}
	if strings.TrimSpace(u.MFASecretEncrypted) == "" {
		return AuthOutput{}, apperr.Validation("El operador no tiene un secreto TOTP configurado")
	}
	plainSecret := u.MFASecretEncrypted
	if s.vault != nil {
		if opened, openErr := s.vault.OpenSecret("totp:"+u.UserID, u.MFASecretEncrypted); openErr == nil && opened != "" {
			plainSecret = opened
		}
	}
	if !totp.VerifyCode(plainSecret, code, time.Now()) {
		return AuthOutput{}, apperr.Unauthorized("Código 2FA inválido o expirado")
	}
	if !u.MFAEnabled {
		u.MFAEnabled = true
		u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := s.staffRepo.UpdatePlatformUser(ctx, u); err != nil {
			return AuthOutput{}, err
		}
	}
	role, err := s.staffRepo.GetPlatformRole(ctx, u.RoleKey)
	if err != nil {
		return AuthOutput{}, apperr.Forbidden("Rol de plataforma inválido")
	}
	out, _, err := s.buildPlatformAuthOutput(ctx, u, role)
	return out, err
}

func (s *CoreService) SetupPlatformUserTOTP(ctx context.Context, userID string) (TOTPSetupOutput, error) {
	if s.staffRepo == nil {
		return TOTPSetupOutput{}, apperr.Internal("Repositorio de personal interno no disponible")
	}
	u, err := s.staffRepo.GetPlatformUserByID(ctx, userID)
	if err != nil {
		return TOTPSetupOutput{}, err
	}
	secret, err := totp.GenerateSecret()
	if err != nil {
		return TOTPSetupOutput{}, apperr.Internal("Error generando secreto TOTP")
	}
	sealed := secret
	if s.vault != nil {
		if enc, sealErr := s.vault.SealSecret("totp:"+u.UserID, secret); sealErr == nil {
			sealed = enc
		}
	}
	u.MFASecretEncrypted = sealed
	u.MFAEnabled = true
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.staffRepo.UpdatePlatformUser(ctx, u); err != nil {
		return TOTPSetupOutput{}, err
	}
	return TOTPSetupOutput{
		UserID:     u.UserID,
		Secret:     secret,
		OTPAuthURI: totp.BuildOTPAuthURI("Proveko Admin", u.Email, secret),
	}, nil
}

func (s *CoreService) DisablePlatformUserTOTP(ctx context.Context, userID string) (*domain.PlatformUser, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	u, err := s.staffRepo.GetPlatformUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	u.MFAEnabled = false
	u.MFASecretEncrypted = ""
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.staffRepo.UpdatePlatformUser(ctx, u); err != nil {
		return nil, err
	}
	return u.Clone(), nil
}

func (s *CoreService) ListPlatformRoles(ctx context.Context) ([]*domain.PlatformRole, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	return s.staffRepo.ListPlatformRoles(ctx)
}

func (s *CoreService) CreatePlatformRole(ctx context.Context, in domain.CreatePlatformRoleInput) (*domain.PlatformRole, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	key := sanitizeRoleKey(in.RoleKey)
	name := strings.TrimSpace(in.DisplayName)
	if key == "" || name == "" {
		return nil, apperr.Validation("Clave y nombre visible del rol son obligatorios")
	}
	if _, err := s.staffRepo.GetPlatformRole(ctx, key); err == nil {
		return nil, apperr.Conflict("Ya existe un rol de plataforma con esa clave")
	}
	perms, err := validatePlatformPermissions(in.Permissions)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	role := &domain.PlatformRole{
		RoleKey:           key,
		DisplayName:       name,
		Description:       strings.TrimSpace(in.Description),
		IsSystem:          false,
		RequireMFA:        in.RequireMFA,
		RequireDataReason: in.RequireDataReason,
		Permissions:       perms,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := s.staffRepo.UpsertPlatformRole(ctx, role); err != nil {
		return nil, err
	}
	return role.Clone(), nil
}

func (s *CoreService) UpdatePlatformRole(ctx context.Context, roleKey string, in domain.UpdatePlatformRoleInput) (*domain.PlatformRole, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	existing, err := s.staffRepo.GetPlatformRole(ctx, roleKey)
	if err != nil {
		return nil, err
	}
	if name := strings.TrimSpace(in.DisplayName); name != "" {
		existing.DisplayName = name
	}
	if in.Description != "" {
		existing.Description = strings.TrimSpace(in.Description)
	}
	if in.RequireMFA != nil {
		existing.RequireMFA = *in.RequireMFA
	}
	if in.RequireDataReason != nil {
		existing.RequireDataReason = *in.RequireDataReason
	}
	if existing.RoleKey != domain.PlatformRoleSuperAdmin && in.Permissions != nil {
		perms, pErr := validatePlatformPermissions(in.Permissions)
		if pErr != nil {
			return nil, pErr
		}
		existing.Permissions = perms
	}
	existing.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.staffRepo.UpsertPlatformRole(ctx, existing); err != nil {
		return nil, err
	}
	return existing.Clone(), nil
}

func (s *CoreService) DeletePlatformRole(ctx context.Context, roleKey string) error {
	if s.staffRepo == nil {
		return apperr.Internal("Repositorio de personal interno no disponible")
	}
	return s.staffRepo.DeletePlatformRole(ctx, roleKey)
}

func (s *CoreService) ListPlatformUsers(ctx context.Context) ([]*domain.PlatformUser, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	return s.staffRepo.ListPlatformUsers(ctx)
}

func (s *CoreService) CreatePlatformUser(ctx context.Context, in domain.CreatePlatformUserInput) (*domain.PlatformUser, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	fullName := strings.TrimSpace(in.FullName)
	roleKey := strings.ToLower(strings.TrimSpace(in.RoleKey))
	if email == "" || !strings.Contains(email, "@") || fullName == "" || roleKey == "" {
		return nil, apperr.Validation("Correo válido, nombre completo y rol de plataforma son obligatorios")
	}
	if len(strings.TrimSpace(in.Password)) < 8 {
		return nil, apperr.Validation("La contraseña del operador debe tener al menos 8 caracteres")
	}
	if _, err := s.staffRepo.GetPlatformRole(ctx, roleKey); err != nil {
		return nil, apperr.Validation("El rol de plataforma seleccionado no existe")
	}
	passHash, err := authguard.HashPassword(in.Password)
	if err != nil {
		return nil, apperr.Internal("Error procesando contraseña del operador")
	}
	allowed := dedupeStrings(in.AllowedTenants)
	if len(allowed) == 0 {
		allowed = []string{"*"}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	u := &domain.PlatformUser{
		UserID:         money.NewID("pusr"),
		Email:          email,
		FullName:       fullName,
		PasswordHash:   passHash,
		RoleKey:        roleKey,
		Status:         "ACTIVE",
		MFAEnabled:     false,
		MFARequired:    in.MFARequired,
		AllowedTenants: allowed,
		SessionVersion: 1,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.staffRepo.CreatePlatformUser(ctx, u); err != nil {
		return nil, err
	}
	return u.Clone(), nil
}

func (s *CoreService) UpdatePlatformUser(ctx context.Context, userID string, in domain.UpdatePlatformUserInput) (*domain.PlatformUser, error) {
	if s.staffRepo == nil {
		return nil, apperr.Internal("Repositorio de personal interno no disponible")
	}
	existing, err := s.staffRepo.GetPlatformUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if name := strings.TrimSpace(in.FullName); name != "" {
		existing.FullName = name
	}
	if roleKey := strings.ToLower(strings.TrimSpace(in.RoleKey)); roleKey != "" {
		if existing.UserID == "usr_platform_superadmin" && roleKey != domain.PlatformRoleSuperAdmin {
			return nil, apperr.Validation("No es posible degradar el rol del SuperAdministrador principal")
		}
		if _, err := s.staffRepo.GetPlatformRole(ctx, roleKey); err != nil {
			return nil, apperr.Validation("El rol de plataforma seleccionado no existe")
		}
		existing.RoleKey = roleKey
	}
	if st := strings.ToUpper(strings.TrimSpace(in.Status)); st != "" {
		if st != "ACTIVE" && st != "SUSPENDED" {
			return nil, apperr.Validation("Estado inválido: debe ser ACTIVE o SUSPENDED")
		}
		if existing.UserID == "usr_platform_superadmin" && st == "SUSPENDED" {
			return nil, apperr.Validation("No es posible suspender al SuperAdministrador principal")
		}
		existing.Status = st
	}
	if strings.TrimSpace(in.Password) != "" {
		if len(strings.TrimSpace(in.Password)) < 8 {
			return nil, apperr.Validation("La contraseña debe tener al menos 8 caracteres")
		}
		hash, err := authguard.HashPassword(in.Password)
		if err != nil {
			return nil, apperr.Internal("Error procesando contraseña")
		}
		existing.PasswordHash = hash
		existing.SessionVersion++
	}
	if in.MFARequired != nil {
		existing.MFARequired = *in.MFARequired
	}
	if in.AllowedTenants != nil {
		allowed := dedupeStrings(in.AllowedTenants)
		if len(allowed) == 0 {
			allowed = []string{"*"}
		}
		existing.AllowedTenants = allowed
	}
	existing.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	if err := s.staffRepo.UpdatePlatformUser(ctx, existing); err != nil {
		return nil, err
	}
	return existing.Clone(), nil
}

func (s *CoreService) RevokePlatformUserSessions(ctx context.Context, userID string) (int, error) {
	if s.staffRepo == nil {
		return 0, apperr.Internal("Repositorio de personal interno no disponible")
	}
	return s.staffRepo.BumpPlatformUserSessionVersion(ctx, userID)
}

func (s *CoreService) SetTenantMaintenance(ctx context.Context, tenantID string, enabled bool, message string) (*domain.Tenant, error) {
	cleanID := strings.TrimSpace(tenantID)
	if cleanID == "" {
		return nil, apperr.Validation("Identificador de empresa requerido")
	}
	if err := s.repo.UpdateMaintenance(ctx, cleanID, enabled, message); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
	return s.GetTenant(ctx, cleanID)
}

func (s *CoreService) SetTenantPaymentStatus(ctx context.Context, tenantID, paymentStatus string) (*domain.Tenant, error) {
	cleanID := strings.TrimSpace(tenantID)
	norm := strings.ToUpper(strings.TrimSpace(paymentStatus))
	if cleanID == "" || norm == "" {
		return nil, apperr.Validation("Estado de facturación inválido")
	}
	if err := s.repo.UpdatePaymentStatus(ctx, cleanID, norm); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
	return s.GetTenant(ctx, cleanID)
}

func (s *CoreService) ChangeOwnPlatformPassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	if s.staffRepo == nil {
		return apperr.Internal("Repositorio de personal interno no disponible")
	}
	if len(strings.TrimSpace(newPassword)) < 8 {
		return apperr.Validation("La nueva contraseña debe tener al menos 8 caracteres")
	}
	u, err := s.staffRepo.GetPlatformUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if !authguard.VerifyPassword(currentPassword, u.PasswordHash) {
		return apperr.Unauthorized("La contraseña actual ingresada es incorrecta")
	}
	hash, err := authguard.HashPassword(newPassword)
	if err != nil {
		return apperr.Internal("Error procesando nueva contraseña")
	}
	u.PasswordHash = hash
	u.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return s.staffRepo.UpdatePlatformUser(ctx, u)
}

func (s *CoreService) SetTenantCustomMonthlyCop(ctx context.Context, tenantID string, customCop int64) (*domain.Tenant, error) {
	cleanID := strings.TrimSpace(tenantID)
	if cleanID == "" || customCop < 0 {
		return nil, apperr.Validation("Tarifa mensual personalizada inválida")
	}
	if err := s.repo.UpdateCustomMonthlyCop(ctx, cleanID, customCop); err != nil {
		return nil, err
	}
	s.invalidateTenantCache(cleanID)
	return s.GetTenant(ctx, cleanID)
}

func (s *CoreService) RevokeTenantSessions(ctx context.Context, tenantID string) (int, error) {
	cleanID := strings.TrimSpace(tenantID)
	next, err := s.repo.BumpTenantSessionVersion(ctx, cleanID)
	if err != nil {
		return 0, err
	}
	s.invalidateTenantCache(cleanID)
	return next, nil
}

func (s *CoreService) RevokeTenantUserSessions(ctx context.Context, tenantID, userID string) (int, error) {
	cleanTen := strings.TrimSpace(tenantID)
	cleanUsr := strings.TrimSpace(userID)
	next, err := s.repo.BumpUserSessionVersion(ctx, cleanTen, cleanUsr)
	if err != nil {
		return 0, err
	}
	s.invalidateUserCache(cleanTen, cleanUsr)
	return next, nil
}

func (s *CoreService) AdminResetTenantUserPassword(ctx context.Context, tenantID, userID, newPassword string) (*domain.TenantUser, error) {
	if len(strings.TrimSpace(newPassword)) < 8 {
		return nil, apperr.Validation("La nueva contraseña debe tener al menos 8 caracteres")
	}
	usr, err := s.repo.GetUserByID(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}
	hash, err := authguard.HashPassword(newPassword)
	if err != nil {
		return nil, apperr.Internal("Error procesando contraseña")
	}
	usr.PasswordHash = hash
	if err := s.repo.UpdateUser(ctx, usr); err != nil {
		return nil, err
	}
	_, _ = s.repo.BumpUserSessionVersion(ctx, tenantID, userID)
	s.invalidateUserCache(tenantID, userID)
	return s.repo.GetUserByID(ctx, tenantID, userID)
}

func (s *CoreService) StartSupportImpersonation(ctx context.Context, tc authguard.TenantContext, targetTenantID, mode, reason string, durationMinutes int) (AuthOutput, error) {
	if tc.Plane != domain.PlanePlatform && tc.Role != domain.RoleSuperAdmin {
		return AuthOutput{}, apperr.Forbidden("Solo el personal de plataforma puede iniciar sesiones de soporte")
	}
	cleanTen := strings.TrimSpace(targetTenantID)
	if cleanTen == "" {
		return AuthOutput{}, apperr.Validation("Empresa destino requerida")
	}
	if !domain.CanAccessTenant(tc.AllowedTenants, cleanTen) {
		return AuthOutput{}, apperr.Forbidden("Tu cuenta no tiene alcance asignado sobre esta empresa")
	}
	if !domain.HasPlatformPermission(tc.PlatformPermissions, "datos_negocio.ver") {
		return AuthOutput{}, apperr.Forbidden("Tu rol no tiene habilitado el permiso para ver datos de negocio de clientes")
	}

	normMode := strings.ToLower(strings.TrimSpace(mode))
	if normMode == "" {
		normMode = "readonly"
	}
	if normMode != "readonly" && normMode != "readwrite" {
		return AuthOutput{}, apperr.Validation("Modo de soporte inválido: usa readonly o readwrite")
	}
	if normMode == "readwrite" {
		if !domain.HasPlatformPermission(tc.PlatformPermissions, "soporte.impersonar_escritura") {
			return AuthOutput{}, apperr.Forbidden("Tu rol no tiene permiso para soporte en modo escritura")
		}
	} else {
		if !domain.HasPlatformPermission(tc.PlatformPermissions, "soporte.impersonar_lectura") && !domain.HasPlatformPermission(tc.PlatformPermissions, "soporte.impersonar_escritura") {
			return AuthOutput{}, apperr.Forbidden("Tu rol no tiene permiso para iniciar sesión de soporte")
		}
	}

	cleanReason := strings.TrimSpace(reason)
	if tc.RequireDataReason && len(cleanReason) < 5 {
		return AuthOutput{}, apperr.Validation("Debes registrar un motivo o número de ticket (mínimo 5 caracteres) para acceder a los datos de este cliente")
	}
	if durationMinutes <= 0 {
		durationMinutes = 30
	}
	if durationMinutes > 60 {
		durationMinutes = 60
	}

	ten, err := s.repo.GetByID(ctx, cleanTen)
	if err != nil {
		return AuthOutput{}, err
	}
	if strings.EqualFold(strings.TrimSpace(ten.Status), "SUSPENDED") {
		return AuthOutput{}, apperr.Forbidden("No es posible abrir la estación de una empresa suspendida; reactívala primero")
	}

	return AuthOutput{
		Plane:               domain.PlanePlatform,
		Tenant:              ten.Clone(),
		CompanyTenant:       ten.Clone(),
		UserID:              tc.UserID,
		Role:                tc.Role,
		InternalRole:        tc.PlatformRole,
		Username:            tc.Username,
		FullName:            tc.FullName,
		IsCompanyAdmin:      normMode == "readwrite",
		IsDemo:              ten.IsDemo,
		SessionVersion:      tc.SessionVersion,
		PlatformRole:        tc.PlatformRole,
		PlatformPermissions: tc.PlatformPermissions,
		AllowedTenants:      tc.AllowedTenants,
		RequireDataReason:   tc.RequireDataReason,
		Impersonating:       true,
		ImpersonationMode:   normMode,
		ImpersonationReason: cleanReason,
		SessionTTL:          time.Duration(durationMinutes) * time.Minute,
	}, nil
}

func (s *CoreService) StopSupportImpersonation(ctx context.Context, tc authguard.TenantContext) (AuthOutput, error) {
	if tc.Plane != domain.PlanePlatform && tc.Role != domain.RoleSuperAdmin {
		return AuthOutput{}, apperr.Forbidden("Sesión de plataforma requerida")
	}
	ten, _ := s.defaultSuperAdminTenant(ctx)
	var companyCopy *domain.Tenant
	if ten != nil {
		companyCopy = ten.Clone()
	}
	return AuthOutput{
		Plane:               domain.PlanePlatform,
		Tenant:              ten,
		CompanyTenant:       companyCopy,
		UserID:              tc.UserID,
		Role:                tc.Role,
		InternalRole:        tc.PlatformRole,
		Username:            tc.Username,
		FullName:            tc.FullName,
		IsCompanyAdmin:      tc.PlatformRole == domain.PlatformRoleSuperAdmin,
		SessionVersion:      tc.SessionVersion,
		PlatformRole:        tc.PlatformRole,
		PlatformPermissions: tc.PlatformPermissions,
		AllowedTenants:      tc.AllowedTenants,
		RequireDataReason:   tc.RequireDataReason,
		Impersonating:       false,
	}, nil
}

func (s *CoreService) GetCatalogOverrides(ctx context.Context) (domain.CatalogOverrideConfig, error) {
	if s.staffRepo == nil {
		return domain.DefaultCatalogOverrideConfig(), nil
	}
	return s.staffRepo.GetCatalogOverrides(ctx)
}

func (s *CoreService) SaveCatalogOverrides(ctx context.Context, cfg domain.CatalogOverrideConfig) (domain.CatalogOverrideConfig, error) {
	if s.staffRepo == nil {
		return domain.DefaultCatalogOverrideConfig(), apperr.Internal("Repositorio no disponible")
	}
	if err := s.staffRepo.SaveCatalogOverrides(ctx, cfg); err != nil {
		return domain.DefaultCatalogOverrideConfig(), err
	}
	return s.staffRepo.GetCatalogOverrides(ctx)
}

func (s *CoreService) applyCatalogOverrides(ctx context.Context, baseCat []licensegate.ServiceManifest, basePresets []domain.BusinessPresetSpec, basePricing domain.PricingMatrixCOP) ([]licensegate.ServiceManifest, []domain.BusinessPresetSpec, domain.PricingMatrixCOP) {
	if s.staffRepo == nil {
		return baseCat, basePresets, basePricing
	}
	ov, err := s.staffRepo.GetCatalogOverrides(ctx)
	if err != nil {
		return baseCat, basePresets, basePricing
	}
	pricing := basePricing
	if ov.Pricing != nil {
		if ov.Pricing.ExtraServiceCop > 0 {
			pricing.ExtraServiceCop = ov.Pricing.ExtraServiceCop
		}
		if ov.Pricing.ExtraModuleCop > 0 {
			pricing.ExtraModuleCop = ov.Pricing.ExtraModuleCop
		}
		if ov.Pricing.ExtraSubmoduleCop > 0 {
			pricing.ExtraSubmoduleCop = ov.Pricing.ExtraSubmoduleCop
		}
		if ov.Pricing.ExtraFeatureCop > 0 {
			pricing.ExtraFeatureCop = ov.Pricing.ExtraFeatureCop
		}
	}

	filteredCat := make([]licensegate.ServiceManifest, 0, len(baseCat))
	hiddenServices := make(map[string]bool)
	for _, svc := range baseCat {
		if so, has := ov.Services[svc.ServiceKey]; has {
			if !so.VisibleInStore || !so.PubliclySellable {
				hiddenServices[svc.ServiceKey] = true
				continue
			}
			if strings.TrimSpace(so.CustomDisplayName) != "" {
				svc.DisplayName = strings.TrimSpace(so.CustomDisplayName)
			}
		}
		filteredCat = append(filteredCat, svc)
	}

	filteredPresets := make([]domain.BusinessPresetSpec, 0, len(basePresets))
	for _, pr := range basePresets {
		if po, has := ov.Presets[pr.Key]; has {
			if !po.VisibleInStore {
				continue
			}
			if po.CustomMonthlyCop > 0 {
				pr.BaseMonthlyCop = po.CustomMonthlyCop
			}
		}
		if len(hiddenServices) > 0 {
			cleaned := make([]string, 0, len(pr.IncludedServices))
			for _, sk := range pr.IncludedServices {
				if !hiddenServices[sk] {
					cleaned = append(cleaned, sk)
				}
			}
			pr.IncludedServices = cleaned
		}
		filteredPresets = append(filteredPresets, pr)
	}

	return filteredCat, filteredPresets, pricing
}

func validatePlatformPermissions(raw []string) ([]string, error) {
	clean := dedupeStrings(raw)
	for _, p := range clean {
		if !domain.IsValidPlatformPermission(p) {
			return nil, apperr.Validation("Permiso de plataforma no reconocido: " + p)
		}
	}
	return clean, nil
}

func sanitizeRoleKey(raw string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(raw)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		} else if r == '-' || r == ' ' {
			b.WriteRune('_')
		}
	}
	return strings.Trim(b.String(), "_")
}
