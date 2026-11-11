package backend

import (
	"crypto/ed25519"
	"net/http"
	"ms-taller/internal/platform/config"
	"ms-taller/internal/platform/dbpool"
	"ms-taller/internal/platform/security"
	"ms-taller/internal/application"
	"ms-taller/internal/domain"
	httpadapter "ms-taller/internal/infrastructure/http"
	"ms-taller/internal/infrastructure/persistence/memory"
	"ms-taller/internal/infrastructure/persistence/postgres"
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

