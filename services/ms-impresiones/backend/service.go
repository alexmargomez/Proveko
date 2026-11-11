package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-impresiones/internal/application"
	"ms-impresiones/internal/domain"
	httpadapter "ms-impresiones/internal/infrastructure/http"
	"ms-impresiones/internal/infrastructure/persistence/memory"
	"ms-impresiones/internal/infrastructure/persistence/postgres"
	"ms-impresiones/internal/infrastructure/renderer"
	"ms-impresiones/internal/platform/config"
	"ms-impresiones/internal/platform/dbpool"
	"ms-impresiones/internal/platform/security"
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
	var repo domain.BrandingRepository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}

	uc := application.NewPrintUseCase(repo, renderer.NewDefaultStrategies())
	h := httpadapter.NewHandler(cfg, pub, replay, uc)

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
