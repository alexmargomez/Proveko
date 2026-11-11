package backend

import (
	"crypto/ed25519"
	"net/http"
	"ms-comandas/internal/platform/config"
	"ms-comandas/internal/platform/dbpool"
	"ms-comandas/internal/platform/security"
	"ms-comandas/internal/application"
	"ms-comandas/internal/domain"
	httpadapter "ms-comandas/internal/infrastructure/http"
	"ms-comandas/internal/infrastructure/persistence/memory"
	"ms-comandas/internal/infrastructure/persistence/postgres"
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

