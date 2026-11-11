package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-compras/internal/application"
	"ms-compras/internal/domain"
	httpadapter "ms-compras/internal/infrastructure/http"
	"ms-compras/internal/infrastructure/persistence/memory"
	"ms-compras/internal/infrastructure/persistence/postgres"
	"ms-compras/internal/infrastructure/s2s"
	"ms-compras/internal/platform/config"
	"ms-compras/internal/platform/dbpool"
	"ms-compras/internal/platform/gateway"
	"ms-compras/internal/platform/security"
)

type Option func(*serviceOpts)

type serviceOpts struct {
	invPort domain.InventoryRestockPort
}

func WithInventoryPort(p domain.InventoryRestockPort) Option {
	return func(o *serviceOpts) { o.invPort = p }
}

type Service struct {
	handler http.Handler
}

func NewService(
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
	dbMgr *dbpool.Manager,
	opts ...Option,
) (*Service, error) {
	if replay == nil {
		replay = security.NewReplayGuard(16384)
	}
	var o serviceOpts
	for _, fn := range opts {
		if fn != nil {
			fn(&o)
		}
	}
	if o.invPort == nil && cfg.GatewayURL != "" {
		o.invPort = s2s.NewInventoryAdapter(gateway.NewClient(cfg.GatewayURL, cfg.S2SSharedKey))
	}

	var repo domain.Repository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}
	app := application.NewService(repo, o.invPort)
	h := httpadapter.NewHandler(app, pub, cfg.S2SSharedKey, replay, cfg.AllowedOrigins)
	return &Service{handler: h}, nil
}

func (s *Service) Handler() http.Handler { return s.handler }
func (s *Service) Router() http.Handler  { return s.handler }
func (s *Service) Close()                {}
