package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/dbpool"
	"ms-core/internal/platform/licensegate"
	"ms-core/migrations"
)

type TenantRepository struct {
	dbMgr   *dbpool.Manager
	catalog domain.CatalogProvider
}

func NewTenantRepository(dbMgr *dbpool.Manager, catalog domain.CatalogProvider) *TenantRepository {
	return &TenantRepository{dbMgr: dbMgr, catalog: catalog}
}

func (r *TenantRepository) ProvisionTenantDatabase(ctx context.Context, dbName string, requireNew bool) (string, error) {
	return r.dbMgr.CreateDatabaseIfAllowed(ctx, dbName, requireNew)
}

func (r *TenantRepository) pool(ctx context.Context) (*pgxpool.Pool, error) {
	return r.dbMgr.OpenControlPool(ctx, migrations.SchemaSQL())
}

func (r *TenantRepository) GetByID(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	return r.fetchOne(ctx, p, `WHERE tenant_id = $1`, tenantID)
}

func (r *TenantRepository) GetByUsername(ctx context.Context, username string) (*domain.Tenant, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	return r.fetchOne(ctx, p, `WHERE admin_username = $1`, strings.ToLower(strings.TrimSpace(username)))
}

func (r *TenantRepository) fetchOne(ctx context.Context, p *pgxpool.Pool, whereClause string, arg any) (*domain.Tenant, error) {
	var t domain.Tenant
	var envRaw []byte
	err := p.QueryRow(ctx, `
		SELECT tenant_id, company_name, nit, admin_username, password_hash, role,
		       db_name, encrypted_dsn_envelope, business_preset, status, created_at
		FROM core_control.tenants
		`+whereClause, arg).Scan(
		&t.TenantID, &t.CompanyName, &t.Nit, &t.AdminUsername, &t.PasswordHash, &t.Role,
		&t.DBName, &envRaw, &t.BusinessPreset, &t.Status, &t.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Empresa o usuario no encontrado")
	}
	if err != nil {
		return nil, err
	}
	t.ID = t.TenantID
	if len(envRaw) > 0 {
		if err := json.Unmarshal(envRaw, &t.SealedDSN); err != nil {
			return nil, apperr.Internal("Error al decodificar sobre criptográfico de la empresa")
		}
	}
	if err := r.loadSubscriptions(ctx, p, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TenantRepository) List(ctx context.Context) ([]*domain.Tenant, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := p.Query(ctx, `
		SELECT tenant_id, company_name, nit, admin_username, password_hash, role,
		       db_name, encrypted_dsn_envelope, business_preset, status, created_at
		FROM core_control.tenants
		ORDER BY created_at ASC, tenant_id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*domain.Tenant
	for rows.Next() {
		var t domain.Tenant
		var envRaw []byte
		if err := rows.Scan(
			&t.TenantID, &t.CompanyName, &t.Nit, &t.AdminUsername, &t.PasswordHash, &t.Role,
			&t.DBName, &envRaw, &t.BusinessPreset, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		t.ID = t.TenantID
		if len(envRaw) > 0 {
			if err := json.Unmarshal(envRaw, &t.SealedDSN); err != nil {
				return nil, apperr.Internal("Error al decodificar sobre criptográfico de la empresa")
			}
		}
		list = append(list, &t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, t := range list {
		if err := r.loadSubscriptions(ctx, p, t); err != nil {
			return nil, err
		}
	}
	return list, nil
}

func (r *TenantRepository) loadSubscriptions(ctx context.Context, p *pgxpool.Pool, t *domain.Tenant) error {
	var err error
	if t.ActiveServices, err = scanStringColumn(ctx, p, `SELECT service_key FROM core_control.tenant_microservices WHERE tenant_id = $1 AND active = TRUE ORDER BY service_key`, t.TenantID); err != nil {
		return err
	}
	if t.ActiveModules, err = scanStringColumn(ctx, p, `SELECT module_key FROM core_control.tenant_modules WHERE tenant_id = $1 AND active = TRUE ORDER BY module_key`, t.TenantID); err != nil {
		return err
	}
	if t.ActiveSubmodules, err = scanStringColumn(ctx, p, `SELECT submodule_key FROM core_control.tenant_submodules WHERE tenant_id = $1 AND active = TRUE ORDER BY submodule_key`, t.TenantID); err != nil {
		return err
	}
	if t.ActiveFeatures, err = scanStringColumn(ctx, p, `SELECT feature_key FROM core_control.tenant_features WHERE tenant_id = $1 AND active = TRUE ORDER BY feature_key`, t.TenantID); err != nil {
		return err
	}
	return nil
}

func scanStringColumn(ctx context.Context, p *pgxpool.Pool, query string, arg any) ([]string, error) {
	rows, err := p.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]string, 0)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *TenantRepository) Create(ctx context.Context, tenant *domain.Tenant) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	envRaw, err := json.Marshal(tenant.SealedDSN)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO core_control.tenants (
			tenant_id, company_name, nit, admin_username, password_hash, role,
			db_name, encrypted_dsn_envelope, business_preset, status, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
	`,
		tenant.TenantID, tenant.CompanyName, tenant.Nit, tenant.AdminUsername, tenant.PasswordHash, tenant.Role,
		tenant.DBName, envRaw, tenant.BusinessPreset, tenant.Status, tenant.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return apperr.Conflict("La empresa o el correo administrador ya existe")
		}
		return err
	}
	if err := r.writeSubscriptionsTx(ctx, tx, tenant); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TenantRepository) UpdateSubscriptions(ctx context.Context, tenant *domain.Tenant) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `UPDATE core_control.tenants SET status = $1 WHERE tenant_id = $2`, tenant.Status, tenant.TenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Empresa no encontrada")
	}
	if err := r.writeSubscriptionsTx(ctx, tx, tenant); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *TenantRepository) UpdateStatus(ctx context.Context, tenantID, status string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tag, err := p.Exec(ctx, `UPDATE core_control.tenants SET status = $1 WHERE tenant_id = $2`, status, tenantID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Empresa no encontrada")
	}
	return nil
}

func (r *TenantRepository) writeSubscriptionsTx(ctx context.Context, tx pgx.Tx, tenant *domain.Tenant) error {
	if _, err := tx.Exec(ctx, `DELETE FROM core_control.tenant_features WHERE tenant_id = $1`, tenant.TenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM core_control.tenant_submodules WHERE tenant_id = $1`, tenant.TenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM core_control.tenant_modules WHERE tenant_id = $1`, tenant.TenantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM core_control.tenant_microservices WHERE tenant_id = $1`, tenant.TenantID); err != nil {
		return err
	}

	modOwner := make(map[string]string)
	subMeta := make(map[string]licensegate.SubmoduleManifest)
	subOwner := make(map[string]string)
	featMeta := make(map[string]licensegate.FeatureManifest)
	featOwner := make(map[string]string)
	for _, s := range r.catalog.Catalog() {
		for _, m := range s.Modules {
			modOwner[m.ModuleKey] = s.ServiceKey
		}
		for _, sm := range s.Submodules {
			subMeta[sm.SubmoduleKey] = sm
			subOwner[sm.SubmoduleKey] = s.ServiceKey
		}
		for _, f := range s.Features {
			featMeta[f.FeatureKey] = f
			featOwner[f.FeatureKey] = s.ServiceKey
		}
	}

	for _, sk := range tenant.ActiveServices {
		if _, err := tx.Exec(ctx, `
			INSERT INTO core_control.tenant_microservices (tenant_id, service_key, active)
			VALUES ($1, $2, TRUE)
		`, tenant.TenantID, sk); err != nil {
			return err
		}
	}
	for _, mk := range tenant.ActiveModules {
		if _, err := tx.Exec(ctx, `
			INSERT INTO core_control.tenant_modules (tenant_id, service_key, module_key, active)
			VALUES ($1, $2, $3, TRUE)
		`, tenant.TenantID, modOwner[mk], mk); err != nil {
			return err
		}
	}
	for _, smk := range tenant.ActiveSubmodules {
		meta := subMeta[smk]
		if _, err := tx.Exec(ctx, `
			INSERT INTO core_control.tenant_submodules (tenant_id, service_key, depends_on_module, submodule_key, active)
			VALUES ($1, $2, $3, $4, TRUE)
		`, tenant.TenantID, subOwner[smk], meta.DependsOnModule, smk); err != nil {
			return err
		}
	}
	for _, fk := range tenant.ActiveFeatures {
		meta := featMeta[fk]
		if _, err := tx.Exec(ctx, `
			INSERT INTO core_control.tenant_features (tenant_id, service_key, depends_on_module, depends_on_submodule, feature_key, active)
			VALUES ($1, $2, $3, $4, $5, TRUE)
		`, tenant.TenantID, featOwner[fk], meta.DependsOnModule, meta.DependsOnSubmodule, fk); err != nil {
			return err
		}
	}
	return nil
}
