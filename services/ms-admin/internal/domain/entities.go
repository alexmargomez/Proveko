package domain

import "strings"

type ActorContext struct {
	Plane               string
	UserID              string
	Email               string
	Role                string
	PlatformRole        string
	PlatformPermissions []string
	AllowedTenants      []string
	RequireDataReason   bool
	TenantID            string
	IPAddress           string
	UserAgent           string
}

func (a ActorContext) HasPermission(required string) bool {
	req := strings.TrimSpace(required)
	if req == "" {
		return true
	}
	for _, p := range a.PlatformPermissions {
		clean := strings.TrimSpace(p)
		if clean == "*" || clean == req {
			return true
		}
	}
	return false
}

func (a ActorContext) CanAccessTenant(tenantID string) bool {
	if len(a.AllowedTenants) == 0 {
		return true
	}
	target := strings.TrimSpace(tenantID)
	for _, t := range a.AllowedTenants {
		clean := strings.TrimSpace(t)
		if clean == "*" || (target != "" && clean == target) {
			return true
		}
	}
	return false
}

type AuditLog struct {
	LogID       string         `json:"logId"`
	ActorUserID string         `json:"actorUserId"`
	ActorEmail  string         `json:"actorEmail"`
	ActorRole   string         `json:"actorRole"`
	Action      string         `json:"action"`
	TargetType  string         `json:"targetType"`
	TargetID    string         `json:"targetId"`
	TenantID    string         `json:"tenantId"`
	Reason      string         `json:"reason"`
	Before      map[string]any `json:"before,omitempty"`
	After       map[string]any `json:"after,omitempty"`
	IPAddress   string         `json:"ipAddress"`
	UserAgent   string         `json:"userAgent"`
	Status      string         `json:"status"`
	CreatedAt   string         `json:"createdAt"`
}

type AuditFilter struct {
	TenantID   string
	ActorEmail string
	Action     string
	Limit      int
}

type TenantMetadata struct {
	TenantID       string   `json:"tenantId"`
	BillingNotes   string   `json:"billingNotes"`
	SupportTier    string   `json:"supportTier"`
	InternalTags   []string `json:"internalTags"`
	AccountManager string   `json:"accountManager"`
	UpdatedAt      string   `json:"updatedAt"`
}

type FeatureFlag struct {
	FlagKey         string   `json:"flagKey"`
	DisplayName     string   `json:"displayName"`
	Description     string   `json:"description"`
	EnabledGlobal   bool     `json:"enabledGlobal"`
	EnabledTenants  []string `json:"enabledTenants"`
	DisabledTenants []string `json:"disabledTenants"`
	UpdatedBy       string   `json:"updatedBy"`
	UpdatedAt       string   `json:"updatedAt"`
}

type Announcement struct {
	AnnouncementID string   `json:"announcementId"`
	Title          string   `json:"title"`
	Message        string   `json:"message"`
	Severity       string   `json:"severity"`
	TargetScope    string   `json:"targetScope"`
	TargetTenants  []string `json:"targetTenants"`
	StartsAt       string   `json:"startsAt"`
	EndsAt         string   `json:"endsAt"`
	Active         bool     `json:"active"`
	CreatedBy      string   `json:"createdBy"`
	CreatedAt      string   `json:"createdAt"`
}

type ExportJob struct {
	JobID            string   `json:"jobId"`
	TenantID         string   `json:"tenantId"`
	CompanyName      string   `json:"companyName"`
	RequestedBy      string   `json:"requestedBy"`
	Reason           string   `json:"reason"`
	ServicesIncluded []string `json:"servicesIncluded"`
	Status           string   `json:"status"`
	FileSizeBytes    int64    `json:"fileSizeBytes"`
	ZipBytes         []byte   `json:"-"`
	ErrorMessage     string   `json:"errorMessage,omitempty"`
	CreatedAt        string   `json:"createdAt"`
	ExpiresAt        string   `json:"expiresAt"`
}

type ExportPassportInfo struct {
	Passport    string
	TargetURL   string
	APIPrefix   string
	CompanyName string
	ActiveSvcs  []string
}
