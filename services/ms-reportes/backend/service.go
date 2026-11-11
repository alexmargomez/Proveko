package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-reportes/internal/platform/config"
	"ms-reportes/internal/platform/dbpool"
	"ms-reportes/internal/platform/security"
	"ms-reportes/internal/application"
	"ms-reportes/internal/domain"
	httpadapter "ms-reportes/internal/infrastructure/http"
	"ms-reportes/internal/infrastructure/persistence/memory"
	"ms-reportes/internal/infrastructure/persistence/postgres"
)

type Service struct {
	handler http.Handler
}

func NewService(
	cfg config.ServiceConfig,
	pubKey ed25519.PublicKey,
	replay *security.ReplayGuard,
	dbMgr *dbpool.Manager,
) (*Service, error) {
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
	h := httpadapter.NewHandler(app, pubKey, cfg.S2SSharedKey, replay, cfg.AllowedOrigins)

	return &Service{handler: h}, nil
}

func (s *Service) Handler() http.Handler {
	return s.handler
}

func (s *Service) Router() http.Handler {
	return s.handler
}

func (s *Service) Close() {}
