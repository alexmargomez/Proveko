package backend

import (
	"crypto/ed25519"
	"net/http"
	"ms-hoteleria/internal/platform/config"
	"ms-hoteleria/internal/platform/dbpool"
	"ms-hoteleria/internal/platform/security"
	"ms-hoteleria/internal/application"
	"ms-hoteleria/internal/domain"
	httpadapter "ms-hoteleria/internal/infrastructure/http"
	"ms-hoteleria/internal/infrastructure/persistence/memory"
	"ms-hoteleria/internal/infrastructure/persistence/postgres"
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

