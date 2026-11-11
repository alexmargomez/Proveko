package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-contabilidad/internal/platform/config"
	"ms-contabilidad/internal/platform/dbpool"
	"ms-contabilidad/internal/platform/security"
	"ms-contabilidad/internal/application"
	"ms-contabilidad/internal/domain"
	httpadapter "ms-contabilidad/internal/infrastructure/http"
	"ms-contabilidad/internal/infrastructure/persistence/memory"
	"ms-contabilidad/internal/infrastructure/persistence/postgres"
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
