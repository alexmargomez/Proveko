package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}

func (r *TenantRepository) GetUserByUsername(ctx context.Context, username string) (*domain.TenantUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	return r.fetchOneUser(ctx, p, `WHERE LOWER(username) = $1`, strings.ToLower(strings.TrimSpace(username)))
}

func (r *TenantRepository) GetUserByID(ctx context.Context, tenantID, userID string) (*domain.TenantUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	if tenantID == "" {
		return r.fetchOneUser(ctx, p, `WHERE user_id = $1`, userID)
	}
	var u domain.TenantUser
	var svcRaw, modRaw []byte
	err = p.QueryRow(ctx, `
		SELECT user_id, tenant_id, username, email, full_name, password_hash,
		       internal_role, is_company_admin, allowed_services::text, allowed_modules::text, status, created_at
		FROM core_control.tenant_users
		WHERE tenant_id = $1 AND user_id = $2
	`, tenantID, userID).Scan(
		&u.UserID, &u.TenantID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash,
		&u.InternalRole, &u.IsCompanyAdmin, &svcRaw, &modRaw, &u.Status, &u.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Usuario de empresa no encontrado")
	}
	if err != nil {
		return nil, err
	}
	if len(svcRaw) > 0 {
		if err := json.Unmarshal(svcRaw, &u.AllowedServices); err != nil {
			return nil, apperr.Internal("Error decodificando servicios del usuario")
		}
	}
	if len(modRaw) > 0 {
		if err := json.Unmarshal(modRaw, &u.AllowedModules); err != nil {
			return nil, apperr.Internal("Error decodificando módulos del usuario")
		}
	}
	return &u, nil
}

func (r *TenantRepository) fetchOneUser(ctx context.Context, p interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, whereClause string, arg any) (*domain.TenantUser, error) {
	var u domain.TenantUser
	var svcRaw, modRaw []byte
	err := p.QueryRow(ctx, `
		SELECT user_id, tenant_id, username, email, full_name, password_hash,
		       internal_role, is_company_admin, allowed_services::text, allowed_modules::text, status, created_at
		FROM core_control.tenant_users
		`+whereClause, arg).Scan(
		&u.UserID, &u.TenantID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash,
		&u.InternalRole, &u.IsCompanyAdmin, &svcRaw, &modRaw, &u.Status, &u.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Usuario no registrado")
	}
	if err != nil {
		return nil, err
	}
	if len(svcRaw) > 0 {
		if err := json.Unmarshal(svcRaw, &u.AllowedServices); err != nil {
			return nil, apperr.Internal("Error decodificando servicios del usuario")
		}
	}
	if len(modRaw) > 0 {
		if err := json.Unmarshal(modRaw, &u.AllowedModules); err != nil {
			return nil, apperr.Internal("Error decodificando módulos del usuario")
		}
	}
	return &u, nil
}

func (r *TenantRepository) ListUsersByTenant(ctx context.Context, tenantID string) ([]*domain.TenantUser, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := p.Query(ctx, `
		SELECT user_id, tenant_id, username, email, full_name, password_hash,
		       internal_role, is_company_admin, allowed_services::text, allowed_modules::text, status, created_at
		FROM core_control.tenant_users
		WHERE tenant_id = $1
		ORDER BY is_company_admin DESC, created_at ASC, username ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.TenantUser, 0)
	for rows.Next() {
		var u domain.TenantUser
		var svcRaw, modRaw []byte
		if err := rows.Scan(
			&u.UserID, &u.TenantID, &u.Username, &u.Email, &u.FullName, &u.PasswordHash,
			&u.InternalRole, &u.IsCompanyAdmin, &svcRaw, &modRaw, &u.Status, &u.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(svcRaw) > 0 {
			if err := json.Unmarshal(svcRaw, &u.AllowedServices); err != nil {
				return nil, apperr.Internal("Error decodificando servicios del usuario")
			}
		}
		if len(modRaw) > 0 {
			if err := json.Unmarshal(modRaw, &u.AllowedModules); err != nil {
				return nil, apperr.Internal("Error decodificando módulos del usuario")
			}
		}
		out = append(out, &u)
	}
	return out, rows.Err()
}

func (r *TenantRepository) CreateUser(ctx context.Context, user *domain.TenantUser) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	svcRaw, err := json.Marshal(nonNilSlice(user.AllowedServices))
	if err != nil {
		return err
	}
	modRaw, err := json.Marshal(nonNilSlice(user.AllowedModules))
	if err != nil {
		return err
	}
	uLow := strings.ToLower(strings.TrimSpace(user.Username))
	emailLow := strings.ToLower(strings.TrimSpace(user.Email))

	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var maxAllowed int
	err = tx.QueryRow(ctx, `
		SELECT max_users_allowed
		FROM core_control.tenants
		WHERE tenant_id = $1
		FOR UPDATE
	`, user.TenantID).Scan(&maxAllowed)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.NotFound("Empresa no encontrada")
	}
	if err != nil {
		return err
	}
	if maxAllowed <= 0 {
		maxAllowed = 15
	}

	var activeCount int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM core_control.tenant_users
		WHERE tenant_id = $1 AND UPPER(status) <> 'SUSPENDED'
	`, user.TenantID).Scan(&activeCount); err != nil {
		return err
	}
	if activeCount >= maxAllowed {
		return apperr.Validation("Has alcanzado el cupo máximo de usuarios permitidos en tu plan actual")
	}

	var rootAdminCollision int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM core_control.tenants
		WHERE LOWER(admin_username) = $1
	`, uLow).Scan(&rootAdminCollision); err != nil {
		return err
	}
	if rootAdminCollision > 0 {
		return apperr.Conflict("El nombre de usuario o correo ya se encuentra registrado")
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO core_control.tenant_users (
			user_id, tenant_id, username, email, full_name, password_hash,
			internal_role, is_company_admin, allowed_services, allowed_modules, status, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
	`,
		user.UserID, user.TenantID, uLow, emailLow, user.FullName, user.PasswordHash,
		user.InternalRole, user.IsCompanyAdmin, string(svcRaw), string(modRaw), user.Status, user.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return apperr.Conflict("El nombre de usuario o correo ya se encuentra registrado")
		}
		return err
	}
	return tx.Commit(ctx)
}

func (r *TenantRepository) UpdateUser(ctx context.Context, user *domain.TenantUser) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	svcRaw, err := json.Marshal(nonNilSlice(user.AllowedServices))
	if err != nil {
		return err
	}
	modRaw, err := json.Marshal(nonNilSlice(user.AllowedModules))
	if err != nil {
		return err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var storedUsername, storedPassHash, storedStatus string
	err = tx.QueryRow(ctx, `
		SELECT username, password_hash, status
		FROM core_control.tenant_users
		WHERE tenant_id = $1 AND user_id = $2
		FOR UPDATE
	`, user.TenantID, user.UserID).Scan(&storedUsername, &storedPassHash, &storedStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.NotFound("Usuario de empresa no encontrado")
	}
	if err != nil {
		return err
	}

	if strings.EqualFold(storedStatus, "SUSPENDED") && !strings.EqualFold(user.Status, "SUSPENDED") {
		var maxAllowed int
		err = tx.QueryRow(ctx, `
			SELECT max_users_allowed
			FROM core_control.tenants
			WHERE tenant_id = $1
			FOR UPDATE
		`, user.TenantID).Scan(&maxAllowed)
		if err != nil {
			return err
		}
		if maxAllowed <= 0 {
			maxAllowed = 15
		}
		var activeCount int
		if err := tx.QueryRow(ctx, `
			SELECT COUNT(1)
			FROM core_control.tenant_users
			WHERE tenant_id = $1 AND UPPER(status) <> 'SUSPENDED'
		`, user.TenantID).Scan(&activeCount); err != nil {
			return err
		}
		if activeCount >= maxAllowed {
			return apperr.Validation("Tu empresa alcanzó el cupo máximo de usuarios activos contratados")
		}
	}

	effectiveHash := user.PasswordHash
	if effectiveHash == "" {
		effectiveHash = storedPassHash
	}

	_, err = tx.Exec(ctx, `
		UPDATE core_control.tenant_users
		SET email = $1, full_name = $2, password_hash = $3,
		    internal_role = $4, is_company_admin = $5,
		    allowed_services = $6::jsonb, allowed_modules = $7::jsonb,
		    status = $8
		WHERE tenant_id = $9 AND user_id = $10
	`,
		strings.ToLower(strings.TrimSpace(user.Email)), user.FullName, effectiveHash,
		user.InternalRole, user.IsCompanyAdmin,
		string(svcRaw), string(modRaw),
		user.Status, user.TenantID, user.UserID,
	)
	if err != nil {
		return err
	}

	if effectiveHash != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE core_control.tenants
			SET password_hash = $1
			WHERE tenant_id = $2 AND LOWER(admin_username) = $3
		`, effectiveHash, user.TenantID, strings.ToLower(strings.TrimSpace(storedUsername))); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *TenantRepository) DeleteUser(ctx context.Context, tenantID, userID string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `DELETE FROM core_control.tenant_users WHERE tenant_id = $1 AND user_id = $2`, tenantID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Usuario de empresa no encontrado")
	}
	return nil
}

func (r *TenantRepository) RecordActivationRequest(ctx context.Context, req *domain.ModuleActivationRequest) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	svcs, err := json.Marshal(nonNilSlice(req.AddedServices))
	if err != nil {
		return err
	}
	mods, err := json.Marshal(nonNilSlice(req.AddedModules))
	if err != nil {
		return err
	}
	subs, err := json.Marshal(nonNilSlice(req.AddedSubmodules))
	if err != nil {
		return err
	}
	feats, err := json.Marshal(nonNilSlice(req.AddedFeatures))
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `
		INSERT INTO core_control.module_activation_requests (
			request_id, tenant_id, company_name, requested_by,
			added_services, added_modules, added_submodules, added_features,
			monthly_cop_after, status, created_at
		) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)
	`,
		req.RequestID, req.TenantID, req.CompanyName, req.RequestedBy,
		string(svcs), string(mods), string(subs), string(feats),
		req.MonthlyCopAfter, req.Status, req.CreatedAt,
	)
	return err
}

func (r *TenantRepository) ListActivationRequests(ctx context.Context, tenantID string) ([]*domain.ModuleActivationRequest, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	query := `
		SELECT request_id, tenant_id, company_name, requested_by,
		       added_services::text, added_modules::text, added_submodules::text, added_features::text,
		       monthly_cop_after, status, created_at
		FROM core_control.module_activation_requests
	`
	var args []any
	if tenantID != "" {
		query += ` WHERE tenant_id = $1`
		args = append(args, tenantID)
	}
	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := p.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.ModuleActivationRequest, 0)
	for rows.Next() {
		var item domain.ModuleActivationRequest
		var sRaw, mRaw, sbRaw, fRaw []byte
		if err := rows.Scan(
			&item.RequestID, &item.TenantID, &item.CompanyName, &item.RequestedBy,
			&sRaw, &mRaw, &sbRaw, &fRaw,
			&item.MonthlyCopAfter, &item.Status, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(sRaw) > 0 {
			if err := json.Unmarshal(sRaw, &item.AddedServices); err != nil {
				return nil, apperr.Internal("Error decodificando historial de servicios")
			}
		}
		if len(mRaw) > 0 {
			if err := json.Unmarshal(mRaw, &item.AddedModules); err != nil {
				return nil, apperr.Internal("Error decodificando historial de módulos")
			}
		}
		if len(sbRaw) > 0 {
			if err := json.Unmarshal(sbRaw, &item.AddedSubmodules); err != nil {
				return nil, apperr.Internal("Error decodificando historial de submódulos")
			}
		}
		if len(fRaw) > 0 {
			if err := json.Unmarshal(fRaw, &item.AddedFeatures); err != nil {
				return nil, apperr.Internal("Error decodificando historial de funcionalidades")
			}
		}
		out = append(out, &item)
	}
	return out, rows.Err()
}

func nonNilSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
