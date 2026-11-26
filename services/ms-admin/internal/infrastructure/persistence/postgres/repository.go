package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-admin/internal/domain"
	"ms-admin/internal/platform/apperr"
	"ms-admin/internal/platform/dbpool"
	"ms-admin/migrations"
)

type Repository struct {
	dbMgr *dbpool.Manager
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{dbMgr: dbMgr}
}

func (r *Repository) pool(ctx context.Context) (*pgxpool.Pool, error) {
	return r.dbMgr.OpenControlPool(ctx, migrations.SchemaSQL())
}

func (r *Repository) RecordAudit(ctx context.Context, entry *domain.AuditLog) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	beforeRaw, _ := json.Marshal(nonNilMap(entry.Before))
	afterRaw, _ := json.Marshal(nonNilMap(entry.After))
	_, err = p.Exec(ctx, `
		INSERT INTO platform_admin.audit_logs (
			log_id, actor_user_id, actor_email, actor_role, action, target_type, target_id,
			tenant_id, reason, before_json, after_json, ip_address, user_agent, status, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15)
	`,
		entry.LogID, entry.ActorUserID, entry.ActorEmail, entry.ActorRole, entry.Action,
		entry.TargetType, entry.TargetID, entry.TenantID, entry.Reason,
		string(beforeRaw), string(afterRaw), entry.IPAddress, entry.UserAgent, entry.Status, entry.CreatedAt,
	)
	return err
}

func (r *Repository) ListAudit(ctx context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var conds []string
	var args []any
	idx := 1
	if t := strings.TrimSpace(filter.TenantID); t != "" {
		conds = append(conds, fmt.Sprintf("tenant_id = $%d", idx))
		args = append(args, t)
		idx++
	}
	if a := strings.ToLower(strings.TrimSpace(filter.ActorEmail)); a != "" {
		conds = append(conds, fmt.Sprintf("LOWER(actor_email) LIKE $%d", idx))
		args = append(args, "%"+a+"%")
		idx++
	}
	if act := strings.TrimSpace(filter.Action); act != "" {
		conds = append(conds, fmt.Sprintf("action ILIKE $%d", idx))
		args = append(args, "%"+act+"%")
		idx++
	}
	query := `
		SELECT log_id, actor_user_id, actor_email, actor_role, action, target_type, target_id,
		       tenant_id, reason, before_json::text, after_json::text, ip_address, user_agent, status, created_at
		FROM platform_admin.audit_logs
	`
	if len(conds) > 0 {
		query += " WHERE " + strings.Join(conds, " AND ")
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", idx)
	args = append(args, limit)

	rows, err := p.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*domain.AuditLog, 0)
	for rows.Next() {
		var item domain.AuditLog
		var bRaw, aRaw []byte
		if err := rows.Scan(
			&item.LogID, &item.ActorUserID, &item.ActorEmail, &item.ActorRole, &item.Action,
			&item.TargetType, &item.TargetID, &item.TenantID, &item.Reason,
			&bRaw, &aRaw, &item.IPAddress, &item.UserAgent, &item.Status, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(bRaw) > 0 {
			_ = json.Unmarshal(bRaw, &item.Before)
		}
		if len(aRaw) > 0 {
			_ = json.Unmarshal(aRaw, &item.After)
		}
		out = append(out, &item)
	}
	return out, rows.Err()
}

func (r *Repository) GetTenantMetadata(ctx context.Context, tenantID string) (*domain.TenantMetadata, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	var m domain.TenantMetadata
	var tagsRaw []byte
	err = p.QueryRow(ctx, `
		SELECT tenant_id, billing_notes, support_tier, internal_tags::text, account_manager, updated_at
		FROM platform_admin.tenant_metadata
		WHERE tenant_id = $1
	`, tenantID).Scan(&m.TenantID, &m.BillingNotes, &m.SupportTier, &tagsRaw, &m.AccountManager, &m.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return &domain.TenantMetadata{
			TenantID:     tenantID,
			SupportTier:  "STANDARD",
			InternalTags: []string{},
		}, nil
	}
	if err != nil {
		return nil, err
	}
	if len(tagsRaw) > 0 {
		_ = json.Unmarshal(tagsRaw, &m.InternalTags)
	}
	if m.InternalTags == nil {
		m.InternalTags = []string{}
	}
	return &m, nil
}

func (r *Repository) UpsertTenantMetadata(ctx context.Context, meta *domain.TenantMetadata) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tagsRaw, _ := json.Marshal(nonNilStrings(meta.InternalTags))
	_, err = p.Exec(ctx, `
		INSERT INTO platform_admin.tenant_metadata (
			tenant_id, billing_notes, support_tier, internal_tags, account_manager, updated_at
		) VALUES ($1,$2,$3,$4::jsonb,$5,$6)
		ON CONFLICT (tenant_id) DO UPDATE SET
			billing_notes = EXCLUDED.billing_notes,
			support_tier = EXCLUDED.support_tier,
			internal_tags = EXCLUDED.internal_tags,
			account_manager = EXCLUDED.account_manager,
			updated_at = EXCLUDED.updated_at
	`, meta.TenantID, meta.BillingNotes, meta.SupportTier, string(tagsRaw), meta.AccountManager, meta.UpdatedAt)
	return err
}

func (r *Repository) ListFeatureFlags(ctx context.Context) ([]*domain.FeatureFlag, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := p.Query(ctx, `
		SELECT flag_key, display_name, description, enabled_global,
		       enabled_tenants::text, disabled_tenants::text, updated_by, updated_at
		FROM platform_admin.feature_flags
		ORDER BY flag_key ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.FeatureFlag, 0)
	for rows.Next() {
		var f domain.FeatureFlag
		var eRaw, dRaw []byte
		if err := rows.Scan(&f.FlagKey, &f.DisplayName, &f.Description, &f.EnabledGlobal, &eRaw, &dRaw, &f.UpdatedBy, &f.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(eRaw, &f.EnabledTenants)
		_ = json.Unmarshal(dRaw, &f.DisabledTenants)
		f.EnabledTenants = nonNilStrings(f.EnabledTenants)
		f.DisabledTenants = nonNilStrings(f.DisabledTenants)
		out = append(out, &f)
	}
	return out, rows.Err()
}

func (r *Repository) UpsertFeatureFlag(ctx context.Context, flag *domain.FeatureFlag) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	eRaw, _ := json.Marshal(nonNilStrings(flag.EnabledTenants))
	dRaw, _ := json.Marshal(nonNilStrings(flag.DisabledTenants))
	_, err = p.Exec(ctx, `
		INSERT INTO platform_admin.feature_flags (
			flag_key, display_name, description, enabled_global, enabled_tenants, disabled_tenants, updated_by, updated_at
		) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)
		ON CONFLICT (flag_key) DO UPDATE SET
			display_name = EXCLUDED.display_name,
			description = EXCLUDED.description,
			enabled_global = EXCLUDED.enabled_global,
			enabled_tenants = EXCLUDED.enabled_tenants,
			disabled_tenants = EXCLUDED.disabled_tenants,
			updated_by = EXCLUDED.updated_by,
			updated_at = EXCLUDED.updated_at
	`, flag.FlagKey, flag.DisplayName, flag.Description, flag.EnabledGlobal, string(eRaw), string(dRaw), flag.UpdatedBy, flag.UpdatedAt)
	return err
}

func (r *Repository) DeleteFeatureFlag(ctx context.Context, flagKey string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `DELETE FROM platform_admin.feature_flags WHERE flag_key = $1`, flagKey)
	return err
}

func (r *Repository) ListAnnouncements(ctx context.Context, activeOnly bool) ([]*domain.Announcement, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	q := `
		SELECT announcement_id, title, message, severity, target_scope,
		       target_tenants::text, starts_at, ends_at, active, created_by, created_at
		FROM platform_admin.announcements
	`
	if activeOnly {
		q += ` WHERE active = TRUE`
	}
	q += ` ORDER BY created_at DESC LIMIT 100`
	rows, err := p.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.Announcement, 0)
	for rows.Next() {
		var a domain.Announcement
		var tRaw []byte
		if err := rows.Scan(&a.AnnouncementID, &a.Title, &a.Message, &a.Severity, &a.TargetScope, &tRaw, &a.StartsAt, &a.EndsAt, &a.Active, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(tRaw, &a.TargetTenants)
		a.TargetTenants = nonNilStrings(a.TargetTenants)
		out = append(out, &a)
	}
	return out, rows.Err()
}

func (r *Repository) CreateAnnouncement(ctx context.Context, ann *domain.Announcement) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tRaw, _ := json.Marshal(nonNilStrings(ann.TargetTenants))
	_, err = p.Exec(ctx, `
		INSERT INTO platform_admin.announcements (
			announcement_id, title, message, severity, target_scope, target_tenants,
			starts_at, ends_at, active, created_by, created_at
		) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
	`, ann.AnnouncementID, ann.Title, ann.Message, ann.Severity, ann.TargetScope, string(tRaw), ann.StartsAt, ann.EndsAt, ann.Active, ann.CreatedBy, ann.CreatedAt)
	return err
}

func (r *Repository) UpdateAnnouncement(ctx context.Context, ann *domain.Announcement) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	tRaw, _ := json.Marshal(nonNilStrings(ann.TargetTenants))
	tag, err := p.Exec(ctx, `
		UPDATE platform_admin.announcements
		SET title = $1, message = $2, severity = $3, target_scope = $4,
		    target_tenants = $5::jsonb, starts_at = $6, ends_at = $7, active = $8
		WHERE announcement_id = $9
	`, ann.Title, ann.Message, ann.Severity, ann.TargetScope, string(tRaw), ann.StartsAt, ann.EndsAt, ann.Active, ann.AnnouncementID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Anuncio no encontrado")
	}
	return nil
}

func (r *Repository) DeleteAnnouncement(ctx context.Context, announcementID string) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	_, err = p.Exec(ctx, `DELETE FROM platform_admin.announcements WHERE announcement_id = $1`, announcementID)
	return err
}

func (r *Repository) SaveExportJob(ctx context.Context, job *domain.ExportJob) error {
	p, err := r.pool(ctx)
	if err != nil {
		return err
	}
	svcRaw, _ := json.Marshal(nonNilStrings(job.ServicesIncluded))
	_, err = p.Exec(ctx, `
		INSERT INTO platform_admin.export_jobs (
			job_id, tenant_id, company_name, requested_by, reason, services_included,
			status, file_size_bytes, zip_bytes, error_message, created_at, expires_at
		) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (job_id) DO UPDATE SET
			status = EXCLUDED.status,
			file_size_bytes = EXCLUDED.file_size_bytes,
			zip_bytes = EXCLUDED.zip_bytes,
			error_message = EXCLUDED.error_message
	`,
		job.JobID, job.TenantID, job.CompanyName, job.RequestedBy, job.Reason, string(svcRaw),
		job.Status, job.FileSizeBytes, job.ZipBytes, job.ErrorMessage, job.CreatedAt, job.ExpiresAt,
	)
	return err
}

func (r *Repository) GetExportJob(ctx context.Context, jobID string) (*domain.ExportJob, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	var job domain.ExportJob
	var svcRaw []byte
	err = p.QueryRow(ctx, `
		SELECT job_id, tenant_id, company_name, requested_by, reason, services_included::text,
		       status, file_size_bytes, zip_bytes, error_message, created_at, expires_at
		FROM platform_admin.export_jobs
		WHERE job_id = $1
	`, jobID).Scan(
		&job.JobID, &job.TenantID, &job.CompanyName, &job.RequestedBy, &job.Reason, &svcRaw,
		&job.Status, &job.FileSizeBytes, &job.ZipBytes, &job.ErrorMessage, &job.CreatedAt, &job.ExpiresAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("Paquete de exportación no encontrado")
	}
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(svcRaw, &job.ServicesIncluded)
	job.ServicesIncluded = nonNilStrings(job.ServicesIncluded)
	return &job, nil
}

func (r *Repository) ListExportJobs(ctx context.Context, tenantID string) ([]*domain.ExportJob, error) {
	p, err := r.pool(ctx)
	if err != nil {
		return nil, err
	}
	q := `
		SELECT job_id, tenant_id, company_name, requested_by, reason, services_included::text,
		       status, file_size_bytes, error_message, created_at, expires_at
		FROM platform_admin.export_jobs
	`
	var args []any
	if strings.TrimSpace(tenantID) != "" {
		q += ` WHERE tenant_id = $1`
		args = append(args, strings.TrimSpace(tenantID))
	}
	q += ` ORDER BY created_at DESC LIMIT 50`

	rows, err := p.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*domain.ExportJob, 0)
	for rows.Next() {
		var job domain.ExportJob
		var svcRaw []byte
		if err := rows.Scan(
			&job.JobID, &job.TenantID, &job.CompanyName, &job.RequestedBy, &job.Reason, &svcRaw,
			&job.Status, &job.FileSizeBytes, &job.ErrorMessage, &job.CreatedAt, &job.ExpiresAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(svcRaw, &job.ServicesIncluded)
		job.ServicesIncluded = nonNilStrings(job.ServicesIncluded)
		out = append(out, &job)
	}
	return out, rows.Err()
}

func nonNilStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func nonNilMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}
