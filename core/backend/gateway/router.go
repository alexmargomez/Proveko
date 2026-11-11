package gateway

import (
	"crypto/ed25519"
	"io/fs"

	"ms-core/backend/provisioning"
	httpadapter "ms-core/internal/infrastructure/http"
	"ms-core/internal/platform/config"
)

type Gateway = httpadapter.GatewayServer

func New(cfg config.CoreConfig, privKey ed25519.PrivateKey, reg *provisioning.Registry, staticFS fs.FS) *Gateway {
	return httpadapter.NewGatewayServer(cfg, privKey, reg.Service, reg.Catalog, staticFS)
}
