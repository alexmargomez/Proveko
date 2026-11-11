package backend

import (
	"crypto/ed25519"
	"net/http"
	"ms-inventario/internal/platform/config"
	"ms-inventario/internal/platform/dbpool"
	"ms-inventario/internal/platform/security"
	"ms-inventario/internal/application"
	"ms-inventario/internal/domain"
	httpadapter "ms-inventario/internal/infrastructure/http"
	"ms-inventario/internal/infrastructure/persistence/memory"
	"ms-inventario/internal/infrastructure/persistence/postgres"
)

type Service struct {
	httpHandler http.Handler
}

func NewService(
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
	dbMgr *dbpool.Manager,
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

	app := application.NewService(repo)
	h := httpadapter.NewHandler(app, cfg, pub, replay)

	return &Service{
		httpHandler: h.Router(),
	}
}

func (s *Service) Handler() http.Handler {
	return s.httpHandler
}

func (s *Service) Router() http.Handler {
	return s.httpHandler
}

