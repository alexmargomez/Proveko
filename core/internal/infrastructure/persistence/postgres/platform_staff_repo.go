package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
)

func (r *TenantRepository) UpdateCustomMonthlyCop(ctx context.Context, tenantID string, customMonthlyCop int64) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `UPDATE core_control.tenants SET custom_monthly_cop = $1 WHERE tenant_id = $2`, customMonthlyCop, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Empresa no encontrada")
	}
	return nil
}

func (r *TenantRepository) UpdateMaintenance(ctx context.Context, tenantID string, enabled bool, message string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `
		UPDATE core_control.tenants
		SET maintenance_mode = $1, maintenance_message = $2
		WHERE tenant_id = $3
	`, enabled, strings.TrimSpace(message), tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Empresa no encontrada")
	}
	return nil
}

func (r *TenantRepository) BumpTenantSessionVersion(ctx context.Context, tenantID string) (int, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return 0, err
	}
	var next int
	err = p.QueryRow(ctx, `
		UPDATE core_control.tenants
		SET session_version = COALESCE(session_version, 1) + 1
		WHERE tenant_id = $1
		RETURNING session_version
	`, tenantID).Scan(&next)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, apperr.NotFound("Empresa no encontrada")
	}
	return next, err
}

func (r *TenantRepository) BumpUserSessionVersion(ctx context.Context, tenantID, userID string) (int, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return 0, err
	}
	var next int
	err = p.QueryRow(ctx, `
		UPDATE core_control.tenant_users
		SET session_version = COALESCE(session_version, 1) + 1
		WHERE tenant_id = $1 AND user_id = $2
		RETURNING session_version
	`, tenantID, userID).Scan(&next)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, apperr.NotFound("Usuario de empresa no encontrado")
	}
	return next, err
}

func (r *TenantRepository) ListPlatformRoles(ctx context.Context) ([]*domain.PlatformRole, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := p.Query(ctx, `
		SELECT role_key, display_name, description, is_system, require_mfa, require_data_reason,
		       permissions::text, created_at, updated_at
		FROM core_control.platform_roles
		ORDER BY is_system DESC, role_key ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.PlatformRole, 0)
	for rows.Next() {
		var role domain.PlatformRole
		var permsRaw []byte
		if err := rows.Scan(
			&role.RoleKey, &role.DisplayName, &role.Description, &role.IsSystem,
			&role.RequireMFA, &role.RequireDataReason, &permsRaw, &role.CreatedAt, &role.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if len(permsRaw) > 0 {
			if err := json.Unmarshal(permsRaw, &role.Permissions); err != nil {
				return nil, apperr.Internal("Error decodificando permisos de rol de plataforma")
			}
		}
		out = append(out, role.Clone())
	}
	return out, rows.Err()
}

func (r *TenantRepository) GetPlatformRole(ctx context.Context, roleKey string) (*domain.PlatformRole, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	var role domain.PlatformRole
	var permsRaw []byte
	err = p.QueryRow(ctx, `
		SELECT role_key, display_name, description, is_system, require_mfa, require_data_reason,
		       permissions::text, created_at, updated_at
		FROM core_control.platform_roles
		WHERE role_key = $1
	`, strings.ToLower(strings.TrimSpace(roleKey))).Scan(
		&role.RoleKey, &role.DisplayName, &role.Description, &role.IsSystem,
		&role.RequireMFA, &role.RequireDataReason, &permsRaw, &role.CreatedAt, &role.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Rol de plataforma no encontrado")
	}
	if err != nil {
		return nil, err
	}
	if len(permsRaw) > 0 {
		if err := json.Unmarshal(permsRaw, &role.Permissions); err != nil {
			return nil, apperr.Internal("Error decodificando permisos de rol de plataforma")
		}
	}
	return role.Clone(), nil
}

func (r *TenantRepository) UpsertPlatformRole(ctx context.Context, role *domain.PlatformRole) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	permsRaw, err := json.Marshal(nonNilSlice(role.Permissions))
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `
		INSERT INTO core_control.platform_roles (
			role_key, display_name, description, is_system, require_mfa, require_data_reason,
			permissions, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
		ON CONFLICT (role_key) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			description = EXCLUDED.description,
			require_mfa = EXCLUDED.require_mfa,
			require_data_reason = EXCLUDED.require_data_reason,
			permissions = EXCLUDED.permissions,
			updated_at = EXCLUDED.updated_at
	`,
		strings.ToLower(strings.TrimSpace(role.RoleKey)), role.DisplayName, role.Description,
		role.IsSystem, role.RequireMFA, role.RequireDataReason, string(permsRaw),
		role.CreatedAt, role.UpdatedAt,
	)
	return err
}

func (r *TenantRepository) DeletePlatformRole(ctx context.Context, roleKey string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	clean := strings.ToLower(strings.TrimSpace(roleKey))
	var inUse int
	if err := p.QueryRow(ctx, `SELECT COUNT(1) FROM core_control.platform_users WHERE role_key = $1`, clean).Scan(&inUse); err != nil {
		return err
	}
	if inUse > 0 {
		return apperr.Conflict("No es posible eliminar un rol asignado a personal interno activo")
	}
	tag, err := p.Exec(ctx, `DELETE FROM core_control.platform_roles WHERE role_key = $1 AND is_system = FALSE`, clean)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.Validation("El rol no existe o es un rol base protegido del sistema")
	}
	return nil
}

func (r *TenantRepository) ListPlatformUsers(ctx context.Context) ([]*domain.PlatformUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := p.Query(ctx, `
		SELECT user_id, email, full_name, password_hash, role_key, status,
		       mfa_enabled, mfa_required, mfa_secret_encrypted,
		       allowed_tenants::text, COALESCE(session_version, 1),
		       last_login_at, created_at, updated_at
		FROM core_control.platform_users
		ORDER BY created_at ASC, email ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.PlatformUser, 0)
	for rows.Next() {
		u, err := scanPlatformUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *TenantRepository) GetPlatformUserByID(ctx context.Context, userID string) (*domain.PlatformUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	row := p.QueryRow(ctx, `
		SELECT user_id, email, full_name, password_hash, role_key, status,
		       mfa_enabled, mfa_required, mfa_secret_encrypted,
		       allowed_tenants::text, COALESCE(session_version, 1),
		       last_login_at, created_at, updated_at
		FROM core_control.platform_users
		WHERE user_id = $1
	`, strings.TrimSpace(userID))
	return scanPlatformUser(row)
}

func (r *TenantRepository) GetPlatformUserByEmail(ctx context.Context, email string) (*domain.PlatformUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	row := p.QueryRow(ctx, `
		SELECT user_id, email, full_name, password_hash, role_key, status,
		       mfa_enabled, mfa_required, mfa_secret_encrypted,
		       allowed_tenants::text, COALESCE(session_version, 1),
		       last_login_at, created_at, updated_at
		FROM core_control.platform_users
		WHERE LOWER(email) = $1
	`, strings.ToLower(strings.TrimSpace(email)))
	return scanPlatformUser(row)
}

func scanPlatformUser(row pgx.Row) (*domain.PlatformUser, error) {
	var u domain.PlatformUser
	var allowedRaw []byte
	err := row.Scan(
		&u.UserID, &u.Email, &u.FullName, &u.PasswordHash, &u.RoleKey, &u.Status,
		&u.MFAEnabled, &u.MFARequired, &u.MFASecretEncrypted,
		&allowedRaw, &u.SessionVersion,
		&u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Operador de plataforma no encontrado")
	}
	if err != nil {
		return nil, err
	}
	if len(allowedRaw) > 0 {
		if err := json.Unmarshal(allowedRaw, &u.AllowedTenants); err != nil {
			return nil, apperr.Internal("Error decodificando alcance de empresas del operador")
		}
	}
	return u.Clone(), nil
}

func (r *TenantRepository) CreatePlatformUser(ctx context.Context, user *domain.PlatformUser) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	allowed := user.AllowedTenants
	if len(allowed) == 0 {
		allowed = []string{"*"}
	}
	allowedRaw, err := json.Marshal(allowed)
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `
		INSERT INTO core_control.platform_users (
			user_id, email, full_name, password_hash, role_key, status,
			mfa_enabled, mfa_required, mfa_secret_encrypted,
			allowed_tenants, session_version, last_login_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)
	`,
		user.UserID, strings.ToLower(strings.TrimSpace(user.Email)), user.FullName, user.PasswordHash,
		strings.ToLower(strings.TrimSpace(user.RoleKey)), user.Status,
		user.MFAEnabled, user.MFARequired, user.MFASecretEncrypted,
		string(allowedRaw), maxInt(user.SessionVersion, 1), user.LastLoginAt, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return apperr.Conflict("Ya existe un operador interno con ese correo electrónico")
		}
		return err
	}
	return nil
}

func (r *TenantRepository) UpdatePlatformUser(ctx context.Context, user *domain.PlatformUser) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	allowed := user.AllowedTenants
	if len(allowed) == 0 {
		allowed = []string{"*"}
	}
	allowedRaw, err := json.Marshal(allowed)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `
		UPDATE core_control.platform_users
		SET full_name = $1, password_hash = $2, role_key = $3, status = $4,
		    mfa_enabled = $5, mfa_required = $6, mfa_secret_encrypted = $7,
		    allowed_tenants = $8::jsonb, session_version = $9, updated_at = $10
		WHERE user_id = $11
	`,
		user.FullName, user.PasswordHash, strings.ToLower(strings.TrimSpace(user.RoleKey)), user.Status,
		user.MFAEnabled, user.MFARequired, user.MFASecretEncrypted,
		string(allowedRaw), maxInt(user.SessionVersion, 1), user.UpdatedAt, user.UserID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Operador de plataforma no encontrado")
	}
	return nil
}

func (r *TenantRepository) BumpPlatformUserSessionVersion(ctx context.Context, userID string) (int, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return 0, err
	}
	var next int
	err = p.QueryRow(ctx, `
		UPDATE core_control.platform_users
		SET session_version = COALESCE(session_version, 1) + 1, updated_at = $1
		WHERE user_id = $2
		RETURNING session_version
	`, time.Now().UTC().Format(time.RFC3339), userID).Scan(&next)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, apperr.NotFound("Operador de plataforma no encontrado")
	}
	return next, err
}

func (r *TenantRepository) TouchPlatformUserLogin(ctx context.Context, userID, timestamp string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `UPDATE core_control.platform_users SET last_login_at = $1 WHERE user_id = $2`, timestamp, userID)
	return err
}

func (r *TenantRepository) GetCatalogOverrides(ctx context.Context) (domain.CatalogOverrideConfig, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return domain.DefaultCatalogOverrideConfig(), err
	}
	var raw []byte
	err = p.QueryRow(ctx, `SELECT payload::text FROM core_control.catalog_overrides WHERE override_key = 'global'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DefaultCatalogOverrideConfig(), nil
	}
	if err != nil {
		return domain.DefaultCatalogOverrideConfig(), err
	}
	out := domain.DefaultCatalogOverrideConfig()
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &out); err != nil {
			return domain.DefaultCatalogOverrideConfig(), err
		}
	}
	if out.Services == nil {
		out.Services = make(map[string]domain.ServiceCommercialOverride)
	}
	if out.Presets == nil {
		out.Presets = make(map[string]domain.PresetCommercialOverride)
	}
	return out, nil
}

func (r *TenantRepository) SaveCatalogOverrides(ctx context.Context, cfg domain.CatalogOverrideConfig) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	if cfg.Services == nil {
		cfg.Services = make(map[string]domain.ServiceCommercialOverride)
	}
	if cfg.Presets == nil {
		cfg.Presets = make(map[string]domain.PresetCommercialOverride)
	}
	raw, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `
		INSERT INTO core_control.catalog_overrides (override_key, payload, updated_at)
		VALUES ('global', $1::jsonb, $2)
		ON CONFLICT (override_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
	`, string(raw), time.Now().UTC().Format(time.RFC3339))
	return err
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
