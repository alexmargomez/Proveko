package provisioning

import (
	"context"

	"ms-core/internal/application"
	"ms-core/internal/domain"
	"ms-core/internal/infrastructure/catalog"
	"ms-core/internal/infrastructure/persistence/memory"
	"ms-core/internal/infrastructure/persistence/postgres"
	"ms-core/internal/platform/config"
	"ms-core/internal/platform/cryptovault"
	"ms-core/internal/platform/dbpool"
)

type CreateTenantInput = domain.CreateTenantInput
type TenantRecord = domain.Tenant

type vaultAdapter struct {
	inner *cryptovault.Vault
}

func (v vaultAdapter) SealTenantDSN(tenantID, plainDSN string) (domain.SealedEnvelope, error) {
	env, err := v.inner.Seal(tenantID, plainDSN)
	if err != nil {
		return domain.SealedEnvelope{}, err
	}
	return domain.SealedEnvelope{
		KEKID:      env.KEKID,
		WrappedDEK: env.WrappedDEK,
		Ciphertext: env.Ciphertext,
	}, nil
}

type Registry struct {
	Service *application.CoreService
	Catalog *catalog.Provider
}

func NewRegistry(cfg config.CoreConfig, dbMgr *dbpool.Manager) (*Registry, error) {
	cat := catalog.NewProvider(config.EnvOr("MANIFESTS_DIR", ""))
	vault := vaultAdapter{inner: cryptovault.New(cfg.VaultKEK)}

	var repo domain.TenantRepository
	var prov domain.DatabaseProvisioner
	if dbMgr != nil && dbMgr.HasPostgres() {
		pgRepo := postgres.NewTenantRepository(dbMgr, cat)
		repo = pgRepo
		prov = pgRepo
	} else {
		memRepo := memory.NewTenantRepository()
		repo = memRepo
		prov = memRepo
	}

	svc, err := application.NewCoreService(repo, prov, cat, vault, cfg.SuperAdminEmail, cfg.SuperAdminPassword)
	if err != nil {
		return nil, err
	}
	if err := svc.SeedDemoTenant(context.Background(), config.EnvOr("DEMO_ADMIN_PASSWORD", "AdminPlataforma2026*")); err != nil {
		return nil, err
	}
	return &Registry{
		Service: svc,
		Catalog: cat,
	}, nil
}
