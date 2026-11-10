package provisioning

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/alexmargomez/proveko/core/backend/licensing"
	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/cryptovault"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
)

type TenantRecord struct {
	TenantID       string               `json:"tenantId"`
	CompanyName    string               `json:"companyName"`
	Nit            string               `json:"nit"`
	AdminUsername  string               `json:"adminUsername"`
	PasswordHash   string               `json:"-"`
	DBName         string               `json:"dbName"`
	SealedDSN      cryptovault.Envelope `json:"sealedDsn"`
	BusinessPreset string               `json:"businessPreset"`
	Status         string               `json:"status"`
	ActiveServices []string             `json:"activeServices"`
	ActiveModules  []string             `json:"activeModules"`
	ActiveFeatures []string             `json:"activeFeatures"`
	CreatedAt      string               `json:"createdAt"`
}

type Registry struct {
	mu      sync.RWMutex
	tenants map[string]*TenantRecord
	order   []string
	catalog []licensegate.ServiceManifest
	dbMgr   *tenantdb.Manager
	vault   *cryptovault.Vault
}

func NewRegistry(dbMgr *tenantdb.Manager, vault *cryptovault.Vault) *Registry {
	cat := licensing.OfficialCatalog()
	r := &Registry{
		tenants: make(map[string]*TenantRecord),
		catalog: cat,
		dbMgr:   dbMgr,
		vault:   vault,
	}
	_, _ = r.CreateTenant(context.Background(), CreateTenantInput{
		TenantID:       "demo-empresa",
		CompanyName:    "Proveko Comercial & Servicios S.A.S.",
		Nit:            "901.482.190-4",
		AdminUsername:  "admin@empresa.co",
		Password:       "admin123",
		BusinessPreset: "full",
	})
	return r
}

type CreateTenantInput struct {
	TenantID       string   `json:"tenantId"`
	CompanyName    string   `json:"companyName"`
	Nit            string   `json:"nit"`
	AdminUsername  string   `json:"adminUsername"`
	Password       string   `json:"password"`
	BusinessPreset string   `json:"businessPreset"`
	Services       []string `json:"activeServices"`
	Modules        []string `json:"activeModules"`
	Features       []string `json:"activeFeatures"`
}

func (r *Registry) Catalog() []licensegate.ServiceManifest {
	return r.catalog
}

func (r *Registry) CreateTenant(ctx context.Context, in CreateTenantInput) (*TenantRecord, error) {
	if strings.TrimSpace(in.CompanyName) == "" {
		return nil, fmt.Errorf("el nombre de la empresa es obligatorio")
	}
	tID := in.TenantID
	if tID == "" {
		tID = fmt.Sprintf("ten-%d", time.Now().UnixNano()%1000000)
	}
	slug := tenantdb.SanitizeDBName("db_" + strings.ToLower(in.CompanyName))
	if in.TenantID == "demo-empresa" {
		slug = "db_demo_empresa"
	}

	svcs, mods, feats := in.Services, in.Modules, in.Features
	if len(svcs) == 0 {
		for _, s := range r.catalog {
			svcs = append(svcs, s.ServiceKey)
			for _, m := range s.Modules {
				if m.DefaultActive {
					mods = append(mods, m.ModuleKey)
				}
			}
			for _, f := range s.Features {
				if f.DefaultActive {
					feats = append(feats, f.FeatureKey)
				}
			}
		}
	}
	if err := licensegate.ValidateSubscriptionState(r.catalog, svcs, mods, feats); err != nil {
		return nil, err
	}

	env, err := r.vault.Seal(tID, "postgres://tenant/"+slug)
	if err != nil {
		return nil, err
	}
	if err := r.dbMgr.ProvisionClientDatabase(ctx, slug, in.CompanyName, svcs); err != nil {
		return nil, err
	}

	user := strings.TrimSpace(strings.ToLower(in.AdminUsername))
	if user == "" {
		user = fmt.Sprintf("admin@%s.co", tID)
	}
	pass := in.Password
	if pass == "" {
		pass = "Proveko2026*"
	}

	rec := &TenantRecord{
		TenantID:       tID,
		CompanyName:    in.CompanyName,
		Nit:            in.Nit,
		AdminUsername:  user,
		PasswordHash:   authguard.HashPassword(pass, tID),
		DBName:         slug,
		SealedDSN:      env,
		BusinessPreset: in.BusinessPreset,
		Status:         "ACTIVE",
		ActiveServices: svcs,
		ActiveModules:  mods,
		ActiveFeatures: feats,
		CreatedAt:      time.Now().Format("2006-01-02 15:04"),
	}

	r.mu.Lock()
	if _, exists := r.tenants[tID]; !exists {
		r.order = append(r.order, tID)
	}
	r.tenants[tID] = rec
	r.mu.Unlock()
	return rec, nil
}

func (r *Registry) UpdateSubscriptions(ctx context.Context, tenantID string, svcs, mods, feats []string) (*TenantRecord, error) {
	if err := licensegate.ValidateSubscriptionState(r.catalog, svcs, mods, feats); err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	rec, ok := r.tenants[tenantID]
	if !ok {
		return nil, fmt.Errorf("empresa no encontrada: %s", tenantID)
	}
	rec.ActiveServices = svcs
	rec.ActiveModules = mods
	rec.ActiveFeatures = feats
	_ = r.dbMgr.ProvisionClientDatabase(ctx, rec.DBName, rec.CompanyName, svcs)
	return rec, nil
}

func (r *Registry) List() []*TenantRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]*TenantRecord, 0, len(r.order))
	for _, id := range r.order {
		out = append(out, r.tenants[id])
	}
	return out
}

func (r *Registry) Get(tenantID string) (*TenantRecord, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	rec, ok := r.tenants[tenantID]
	return rec, ok
}

func (r *Registry) FindByUsername(username string) (*TenantRecord, bool) {
	u := strings.TrimSpace(strings.ToLower(username))
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, id := range r.order {
		if r.tenants[id].AdminUsername == u {
			return r.tenants[id], true
		}
	}
	if len(r.order) > 0 {
		return r.tenants[r.order[len(r.order)-1]], true
	}
	return nil, false
}
