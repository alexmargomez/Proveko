package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-facturacion/internal/application"
	"ms-facturacion/internal/domain"
	httpadapter "ms-facturacion/internal/infrastructure/http"
	"ms-facturacion/internal/infrastructure/persistence/memory"
	"ms-facturacion/internal/infrastructure/persistence/postgres"
	"ms-facturacion/internal/infrastructure/s2s"
	"ms-facturacion/internal/platform/config"
	"ms-facturacion/internal/platform/dbpool"
	"ms-facturacion/internal/platform/gateway"
	"ms-facturacion/internal/platform/security"
)

type Clients struct {
	Gateway *gateway.Client
}

type Option func(*application.Ports)

func WithPorts(override application.Ports) Option {
	return func(p *application.Ports) {
		if override.Inventory != nil {
			p.Inventory = override.Inventory
		}
		if override.Customers != nil {
			p.Customers = override.Customers
		}
		if override.Workshop != nil {
			p.Workshop = override.Workshop
		}
		if override.Hospitality != nil {
			p.Hospitality = override.Hospitality
		}
		if override.Gastro != nil {
			p.Gastro = override.Gastro
		}
		if override.Print != nil {
			p.Print = override.Print
		}
	}
}

type Service struct {
	handler http.Handler
}

func NewService(
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
	dbMgr *dbpool.Manager,
	clients Clients,
	opts ...Option,
) *Service {
	if replay == nil {
		replay = security.NewReplayGuard(16384)
	}
	var repo domain.Repository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}

	gw := clients.Gateway
	if gw == nil && cfg.GatewayURL != "" {
		gw = gateway.NewClient(cfg.GatewayURL, cfg.S2SSharedKey)
	}

	var ports application.Ports
	if gw != nil {
		ports.Inventory = s2s.NewInventoryAdapter(gw)
		ports.Customers = s2s.NewCustomersAdapter(gw)
		ports.Workshop = s2s.NewWorkshopAdapter(gw)
		ports.Hospitality = s2s.NewHospitalityAdapter(gw)
		ports.Gastro = s2s.NewGastroAdapter(gw)
		ports.Print = s2s.NewPrintAdapter(gw)
	}
	for _, opt := range opts {
		if opt != nil {
			opt(&ports)
		}
	}

	app := application.NewService(repo, ports)
	h := httpadapter.NewHandler(app, cfg, pub, replay)
	return &Service{handler: h.Router()}
}

func (s *Service) Handler() http.Handler { return s.handler }
func (s *Service) Router() http.Handler  { return s.handler }
