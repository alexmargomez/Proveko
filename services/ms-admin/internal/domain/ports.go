package domain

import "context"

type AdminRepository interface {
	RecordAudit(ctx context.Context, entry *AuditLog) error
	ListAudit(ctx context.Context, filter AuditFilter) ([]*AuditLog, error)

	GetTenantMetadata(ctx context.Context, tenantID string) (*TenantMetadata, error)
	UpsertTenantMetadata(ctx context.Context, meta *TenantMetadata) error

	ListFeatureFlags(ctx context.Context) ([]*FeatureFlag, error)
	UpsertFeatureFlag(ctx context.Context, flag *FeatureFlag) error
	DeleteFeatureFlag(ctx context.Context, flagKey string) error

	ListAnnouncements(ctx context.Context, activeOnly bool) ([]*Announcement, error)
	CreateAnnouncement(ctx context.Context, ann *Announcement) error
	UpdateAnnouncement(ctx context.Context, ann *Announcement) error
	DeleteAnnouncement(ctx context.Context, announcementID string) error

	SaveExportJob(ctx context.Context, job *ExportJob) error
	GetExportJob(ctx context.Context, jobID string) (*ExportJob, error)
	ListExportJobs(ctx context.Context, tenantID string) ([]*ExportJob, error)
}

type CoreControlClient interface {
	ProxyJSON(ctx context.Context, method, path string, body any) (int, map[string]any, error)
	IssueExportPassport(ctx context.Context, tenantID, targetService, actorEmail string) (ExportPassportInfo, error)
	FetchBusinessJSON(ctx context.Context, targetURL, fullPath, passport string) (int, []byte, error)
}
