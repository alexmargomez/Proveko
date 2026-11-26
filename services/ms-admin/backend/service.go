package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-admin/internal/application"
	"ms-admin/internal/domain"
	httpadapter "ms-admin/internal/infrastructure/http"
	"ms-admin/internal/infrastructure/persistence/memory"
	"ms-admin/internal/infrastructure/persistence/postgres"
	"ms-admin/internal/infrastructure/s2s"
	"ms-admin/internal/platform/config"
	"ms-admin/internal/platform/dbpool"
	"ms-admin/internal/platform/security"
)

type Service struct {
	handler http.Handler
	dbMgr   *dbpool.Manager
}

func NewService(cfg config.ServiceConfig, pubKey ed25519.PublicKey, replay *security.ReplayGuard) *Service {
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	var repo domain.AdminRepository
	if dbMgr != nil && dbMgr.HasPostgres() {
		repo = postgres.NewRepository(dbMgr)
	} else {
		repo = memory.NewRepository()
	}
	coreClient := s2s.NewCoreAdminClient(cfg.GatewayURL, cfg.S2SSharedKey)
	svc := application.NewAdminService(repo, coreClient)
	h := httpadapter.NewHandler(cfg, pubKey, replay, svc)
	return &Service{
		handler: h.Router(),
		dbMgr:   dbMgr,
	}
}

func (s *Service) Handler() http.Handler {
	return s.handler
}

func (s *Service) Close() {
	if s.dbMgr != nil {
		s.dbMgr.Close()
	}
}
