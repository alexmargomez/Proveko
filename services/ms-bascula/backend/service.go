package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-bascula/internal/platform/config"
	"ms-bascula/internal/platform/dbpool"
	"ms-bascula/internal/platform/security"
	"ms-bascula/internal/application"
	"ms-bascula/internal/domain"
	httpadapter "ms-bascula/internal/infrastructure/http"
	"ms-bascula/internal/infrastructure/persistence/memory"
	"ms-bascula/internal/infrastructure/persistence/postgres"
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
