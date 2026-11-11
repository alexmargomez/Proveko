package postgres

import (
	"context"
	"errors"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-impresiones/internal/platform/apperr"
	"ms-impresiones/internal/platform/dbpool"
	"ms-impresiones/internal/domain"
	"ms-impresiones/migrations"
)

type Repository struct {
	dbMgr  *dbpool.Manager
	seedMu sync.Mutex
	seeded map[string]bool
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func (r *Repository) openAndSeed(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-impresiones", migrations.SchemaSQL)
	if err != nil {
		return nil, apperr.Wrap(apperr.KindInternal, "No fue posible conectar con el esquema de impresiones", err)
	}
	if err := r.ensureSeeded(ctx, dbName, pool); err != nil {
		return nil, err
	}
	return pool, nil
}

func (r *Repository) ensureSeeded(ctx context.Context, dbName string, pool *pgxpool.Pool) error {
	r.seedMu.Lock()
	if r.seeded[dbName] {
		r.seedMu.Unlock()
		return nil
	}
	r.seedMu.Unlock()

	seed := domain.DefaultSeedBranding()
	_, err := pool.Exec(ctx, `
		INSERT INTO printing.branding_configs (
			id, company_name, nit, tax_regime, address, phone, email, dian_resolution, footer_warranty, primary_color, default_format
		) VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO NOTHING
	`,
		seed.CompanyName,
		seed.Nit,
		seed.TaxRegime,
		seed.Address,
		seed.Phone,
		seed.Email,
		seed.DianResolution,
		seed.FooterWarranty,
		seed.PrimaryColor,
		seed.DefaultFormat,
	)
	if err != nil {
		return apperr.Wrap(apperr.KindInternal, "Error al inicializar membrete base", err)
	}

	r.seedMu.Lock()
	r.seeded[dbName] = true
	r.seedMu.Unlock()
	return nil
}

func (r *Repository) GetBranding(ctx context.Context, dbName string) (domain.BrandingConfig, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.BrandingConfig{}, err
	}
	return scanPrimaryBranding(ctx, pool)
}

func (r *Repository) SaveBranding(ctx context.Context, dbName, idemKey string, cfg domain.BrandingConfig) (domain.BrandingConfig, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.BrandingConfig{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "Error al abrir transacción de membrete", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var lockedID string
	err = tx.QueryRow(ctx, `SELECT id FROM printing.branding_configs WHERE id = 'primary' FOR UPDATE`).Scan(&lockedID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "Error al bloquear configuración de membrete", err)
	}

	if idemKey != "" {
		tag, idemErr := tx.Exec(ctx, `INSERT INTO printing.idempotency_keys (idem_key) VALUES ($1) ON CONFLICT (idem_key) DO NOTHING`, idemKey)
		if idemErr != nil {
			return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "Error al verificar idempotencia", idemErr)
		}
		if tag.RowsAffected() == 0 {
			existing, readErr := scanPrimaryBranding(ctx, tx)
			if readErr != nil {
				return domain.BrandingConfig{}, readErr
			}
			if commitErr := tx.Commit(ctx); commitErr != nil {
				return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "Error al confirmar lectura idempotente", commitErr)
			}
			return existing, nil
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO printing.branding_configs (
			id, company_name, nit, tax_regime, address, phone, email, dian_resolution, footer_warranty, primary_color, default_format, updated_at
		) VALUES ('primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (id) DO UPDATE SET
			company_name = EXCLUDED.company_name,
			nit = EXCLUDED.nit,
			tax_regime = EXCLUDED.tax_regime,
			address = EXCLUDED.address,
			phone = EXCLUDED.phone,
			email = EXCLUDED.email,
			dian_resolution = EXCLUDED.dian_resolution,
			footer_warranty = EXCLUDED.footer_warranty,
			primary_color = EXCLUDED.primary_color,
			default_format = EXCLUDED.default_format,
			updated_at = NOW()
	`,
		cfg.CompanyName,
		cfg.Nit,
		cfg.TaxRegime,
		cfg.Address,
		cfg.Phone,
		cfg.Email,
		cfg.DianResolution,
		cfg.FooterWarranty,
		cfg.PrimaryColor,
		cfg.DefaultFormat,
	)
	if err != nil {
		return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "No fue posible guardar el membrete empresarial", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "No fue posible confirmar el guardado del membrete", err)
	}
	return cfg.Clone(), nil
}

func (r *Repository) RecordRenderLog(ctx context.Context, dbName string, req domain.RenderRequest, formatUsed string) error {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO printing.render_logs (
			document_type, document_number, layout_variant, customer_name, grand_total, rendered_by
		) VALUES ($1, $2, $3, $4, $5, $6)
	`,
		req.DocumentType,
		req.DocumentNumber,
		formatUsed,
		req.CustomerName,
		req.GrandTotal,
		req.Actor,
	)
	if err != nil {
		return apperr.Wrap(apperr.KindInternal, "No fue posible registrar trazabilidad de impresión", err)
	}
	return nil
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func scanPrimaryBranding(ctx context.Context, q rowQuerier) (domain.BrandingConfig, error) {
	var b domain.BrandingConfig
	err := q.QueryRow(ctx, `
		SELECT company_name, nit, tax_regime, address, phone, email, dian_resolution, footer_warranty, primary_color, default_format
		FROM printing.branding_configs
		WHERE id = 'primary'
	`).Scan(
		&b.CompanyName,
		&b.Nit,
		&b.TaxRegime,
		&b.Address,
		&b.Phone,
		&b.Email,
		&b.DianResolution,
		&b.FooterWarranty,
		&b.PrimaryColor,
		&b.DefaultFormat,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DefaultSeedBranding(), nil
	}
	if err != nil {
		return domain.BrandingConfig{}, apperr.Wrap(apperr.KindInternal, "Error al consultar el membrete empresarial", err)
	}
	return b, nil
}
