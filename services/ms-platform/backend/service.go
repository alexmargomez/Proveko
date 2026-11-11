package backend

import (
	"crypto/ed25519"
	"net/http"

	"ms-platform/internal/application"
	httpadapter "ms-platform/internal/infrastructure/http"
	"ms-platform/internal/platform/config"
	"ms-platform/internal/platform/security"
)

type Service struct {
	handler http.Handler
}

func NewService(cfg config.ServiceConfig, pub ed25519.PublicKey, replay *security.ReplayGuard) *Service {
	if replay == nil {
		replay = security.NewReplayGuard(16384)
	}
	app := application.NewService()
	h := httpadapter.NewHandler(app, cfg, pub, replay)
	return &Service{handler: h.Router()}
}

func (s *Service) Handler() http.Handler { return s.handler }
func (s *Service) Router() http.Handler  { return s.handler }
