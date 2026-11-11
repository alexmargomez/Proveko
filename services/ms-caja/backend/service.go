package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-caja/internal/platform/config"
	"ms-caja/internal/platform/dbpool"
	"ms-caja/internal/platform/security"
	"ms-caja/internal/application"
	"ms-caja/internal/domain"
	httpadapter "ms-caja/internal/infrastructure/http"
	"ms-caja/internal/infrastructure/persistence/memory"
	"ms-caja/internal/infrastructure/persistence/postgres"
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
