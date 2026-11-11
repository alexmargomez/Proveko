package backend

import (
	"crypto/ed25519"
	"net/http"
	"ms-clientes/internal/platform/config"
	"ms-clientes/internal/platform/dbpool"
	"ms-clientes/internal/platform/security"
	"ms-clientes/internal/application"
	"ms-clientes/internal/domain"
	httpadapter "ms-clientes/internal/infrastructure/http"
	"ms-clientes/internal/infrastructure/persistence/memory"
	"ms-clientes/internal/infrastructure/persistence/postgres"
)

type Service struct {
	handler http.Handler
}

func NewService(
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
	dbMgr *dbpool.Manager,
) *Service {
	var repo domain.Repository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}

	app := application.NewService(repo)
	httpHandler := httpadapter.NewHandler(app, cfg, pub, replay)
	return &Service{
		handler: httpHandler.Router(),
	}
}

func (s *Service) Handler() http.Handler {
	return s.handler
}

func (s *Service) Router() http.Handler {
	return s.handler
}

