package domain

import (
	"context"

	"ms-core/internal/platform/licensegate"
)

type TenantRepository interface {
	GetByID(ctx context.Context, tenantID string) (*Tenant, error)
	GetByUsername(ctx context.Context, username string) (*Tenant, error)
	List(ctx context.Context) ([]*Tenant, error)
	Create(ctx context.Context, tenant *Tenant) error
	UpdateSubscriptions(ctx context.Context, tenant *Tenant) error
	UpdateStatus(ctx context.Context, tenantID, status string) error
	UpdatePaymentStatus(ctx context.Context, tenantID, paymentStatus string) error
	UpdateQuotas(ctx context.Context, tenantID string, maxUsersAllowed int) error
	UpdateCustomMonthlyCop(ctx context.Context, tenantID string, customMonthlyCop int64) error
	UpdateMaintenance(ctx context.Context, tenantID string, enabled bool, message string) error
	BumpTenantSessionVersion(ctx context.Context, tenantID string) (int, error)

	GetUserByUsername(ctx context.Context, username string) (*TenantUser, error)
	GetUserByID(ctx context.Context, tenantID, userID string) (*TenantUser, error)
	ListUsersByTenant(ctx context.Context, tenantID string) ([]*TenantUser, error)
	CreateUser(ctx context.Context, user *TenantUser) error
	UpdateUser(ctx context.Context, user *TenantUser) error
	DeleteUser(ctx context.Context, tenantID, userID string) error
	BumpUserSessionVersion(ctx context.Context, tenantID, userID string) (int, error)

	RecordActivationRequest(ctx context.Context, req *ModuleActivationRequest) error
	ListActivationRequests(ctx context.Context, tenantID string) ([]*ModuleActivationRequest, error)
}

type PlatformStaffRepository interface {
	ListPlatformRoles(ctx context.Context) ([]*PlatformRole, error)
	GetPlatformRole(ctx context.Context, roleKey string) (*PlatformRole, error)
	UpsertPlatformRole(ctx context.Context, role *PlatformRole) error
	DeletePlatformRole(ctx context.Context, roleKey string) error

	ListPlatformUsers(ctx context.Context) ([]*PlatformUser, error)
	GetPlatformUserByID(ctx context.Context, userID string) (*PlatformUser, error)
	GetPlatformUserByEmail(ctx context.Context, email string) (*PlatformUser, error)
	CreatePlatformUser(ctx context.Context, user *PlatformUser) error
	UpdatePlatformUser(ctx context.Context, user *PlatformUser) error
	BumpPlatformUserSessionVersion(ctx context.Context, userID string) (int, error)
	TouchPlatformUserLogin(ctx context.Context, userID, timestamp string) error

	GetCatalogOverrides(ctx context.Context) (CatalogOverrideConfig, error)
	SaveCatalogOverrides(ctx context.Context, cfg CatalogOverrideConfig) error
}

type DatabaseProvisioner interface {
	ProvisionTenantDatabase(ctx context.Context, rawDBName string, requireNew bool) (string, error)
}

type CatalogProvider interface {
	Catalog() []licensegate.ServiceManifest
}

type SecretVault interface {
	SealTenantDSN(tenantID, plainDSN string) (SealedEnvelope, error)
	SealSecret(scopeID, plaintext string) (string, error)
	OpenSecret(scopeID, encoded string) (string, error)
}
