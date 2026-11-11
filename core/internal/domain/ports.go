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
