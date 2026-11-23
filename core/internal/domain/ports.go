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
	UpdateQuotas(ctx context.Context, tenantID string, maxUsersAllowed int) error

	GetUserByUsername(ctx context.Context, username string) (*TenantUser, error)
	GetUserByID(ctx context.Context, tenantID, userID string) (*TenantUser, error)
	ListUsersByTenant(ctx context.Context, tenantID string) ([]*TenantUser, error)
	CreateUser(ctx context.Context, user *TenantUser) error
	UpdateUser(ctx context.Context, user *TenantUser) error
	DeleteUser(ctx context.Context, tenantID, userID string) error

	RecordActivationRequest(ctx context.Context, req *ModuleActivationRequest) error
	ListActivationRequests(ctx context.Context, tenantID string) ([]*ModuleActivationRequest, error)
}

type DatabaseProvisioner interface {
	ProvisionTenantDatabase(ctx context.Context, rawDBName string, requireNew bool) (string, error)
}

type CatalogProvider interface {
	Catalog() []licensegate.ServiceManifest
}

type SecretVault interface {
	SealTenantDSN(tenantID, plainDSN string) (SealedEnvelope, error)
}
