package memory

import (
	"context"
	"sort"
	"strings"
	"sync"

	"ms-admin/internal/domain"
	"ms-admin/internal/platform/apperr"
)

type Repository struct {
	mu            sync.RWMutex
	audits        []*domain.AuditLog
	metadata      map[string]*domain.TenantMetadata
	flags         map[string]*domain.FeatureFlag
	announcements map[string]*domain.Announcement
	annOrder      []string
	exports       map[string]*domain.ExportJob
	exportOrder   []string
}

func NewRepository() *Repository {
	return &Repository{
		metadata:      make(map[string]*domain.TenantMetadata),
		flags:         make(map[string]*domain.FeatureFlag),
		announcements: make(map[string]*domain.Announcement),
		exports:       make(map[string]*domain.ExportJob),
	}
}

func (r *Repository) RecordAudit(_ context.Context, entry *domain.AuditLog) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *entry
	r.audits = append([]*domain.AuditLog{&cp}, r.audits...)
	if len(r.audits) > 2000 {
		r.audits = r.audits[:2000]
	}
	return nil
}

func (r *Repository) ListAudit(_ context.Context, filter domain.AuditFilter) ([]*domain.AuditLog, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	tID := strings.TrimSpace(filter.TenantID)
	actor := strings.ToLower(strings.TrimSpace(filter.ActorEmail))
	act := strings.ToLower(strings.TrimSpace(filter.Action))
	out := make([]*domain.AuditLog, 0)
	for _, item := range r.audits {
		if tID != "" && item.TenantID != tID {
			continue
		}
		if actor != "" && !strings.Contains(strings.ToLower(item.ActorEmail), actor) {
			continue
		}
		if act != "" && !strings.Contains(strings.ToLower(item.Action), act) {
			continue
		}
		cp := *item
		out = append(out, &cp)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (r *Repository) GetTenantMetadata(_ context.Context, tenantID string) (*domain.TenantMetadata, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if m, ok := r.metadata[tenantID]; ok {
		cp := *m
		cp.InternalTags = append([]string{}, m.InternalTags...)
		return &cp, nil
	}
	return &domain.TenantMetadata{
		TenantID:     tenantID,
		SupportTier:  "STANDARD",
		InternalTags: []string{},
	}, nil
}

func (r *Repository) UpsertTenantMetadata(_ context.Context, meta *domain.TenantMetadata) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *meta
	cp.InternalTags = append([]string{}, meta.InternalTags...)
	r.metadata[meta.TenantID] = &cp
	return nil
}

func (r *Repository) ListFeatureFlags(_ context.Context) ([]*domain.FeatureFlag, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.FeatureFlag, 0, len(r.flags))
	for _, f := range r.flags {
		cp := *f
		cp.EnabledTenants = append([]string{}, f.EnabledTenants...)
		cp.DisabledTenants = append([]string{}, f.DisabledTenants...)
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].FlagKey < out[j].FlagKey })
	return out, nil
}

func (r *Repository) UpsertFeatureFlag(_ context.Context, flag *domain.FeatureFlag) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *flag
	cp.EnabledTenants = append([]string{}, flag.EnabledTenants...)
	cp.DisabledTenants = append([]string{}, flag.DisabledTenants...)
	r.flags[flag.FlagKey] = &cp
	return nil
}

func (r *Repository) DeleteFeatureFlag(_ context.Context, flagKey string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.flags, flagKey)
	return nil
}

func (r *Repository) ListAnnouncements(_ context.Context, activeOnly bool) ([]*domain.Announcement, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.Announcement, 0, len(r.annOrder))
	for _, id := range r.annOrder {
		a, ok := r.announcements[id]
		if !ok {
			continue
		}
		if activeOnly && !a.Active {
			continue
		}
		cp := *a
		cp.TargetTenants = append([]string{}, a.TargetTenants...)
		out = append(out, &cp)
	}
	return out, nil
}

func (r *Repository) CreateAnnouncement(_ context.Context, ann *domain.Announcement) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *ann
	cp.TargetTenants = append([]string{}, ann.TargetTenants...)
	r.announcements[ann.AnnouncementID] = &cp
	r.annOrder = append([]string{ann.AnnouncementID}, r.annOrder...)
	return nil
}

func (r *Repository) UpdateAnnouncement(_ context.Context, ann *domain.Announcement) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.announcements[ann.AnnouncementID]; !ok {
		return apperr.NotFound("Anuncio no encontrado")
	}
	cp := *ann
	cp.TargetTenants = append([]string{}, ann.TargetTenants...)
	r.announcements[ann.AnnouncementID] = &cp
	return nil
}

func (r *Repository) DeleteAnnouncement(_ context.Context, announcementID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.announcements, announcementID)
	return nil
}

func (r *Repository) SaveExportJob(_ context.Context, job *domain.ExportJob) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *job
	cp.ServicesIncluded = append([]string{}, job.ServicesIncluded...)
	cp.ZipBytes = append([]byte{}, job.ZipBytes...)
	if _, exists := r.exports[job.JobID]; !exists {
		r.exportOrder = append([]string{job.JobID}, r.exportOrder...)
	}
	r.exports[job.JobID] = &cp
	return nil
}

func (r *Repository) GetExportJob(_ context.Context, jobID string) (*domain.ExportJob, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	job, ok := r.exports[jobID]
	if !ok {
		return nil, apperr.NotFound("Paquete de exportación no encontrado")
	}
	cp := *job
	cp.ServicesIncluded = append([]string{}, job.ServicesIncluded...)
	cp.ZipBytes = append([]byte{}, job.ZipBytes...)
	return &cp, nil
}

func (r *Repository) ListExportJobs(_ context.Context, tenantID string) ([]*domain.ExportJob, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*domain.ExportJob, 0)
	for _, id := range r.exportOrder {
		job := r.exports[id]
		if job == nil {
			continue
		}
		if tenantID != "" && job.TenantID != tenantID {
			continue
		}
		cp := *job
		cp.ZipBytes = nil
		cp.ServicesIncluded = append([]string{}, job.ServicesIncluded...)
		out = append(out, &cp)
	}
	return out, nil
}
