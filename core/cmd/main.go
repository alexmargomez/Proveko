package main

import (
	"fmt"
	"net/http"

	"github.com/alexmargomez/proveko/core"
	"github.com/alexmargomez/proveko/core/backend/gateway"
	"github.com/alexmargomez/proveko/core/backend/grpcserver"
	"github.com/alexmargomez/proveko/core/backend/provisioning"
	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/cryptovault"
	"github.com/alexmargomez/proveko/pkg/grpcx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	corev1 "github.com/alexmargomez/proveko/proto/core/v1"
)

func main() {
	cfg := config.Load()
	dbMgr := tenantdb.NewManager(cfg)
	vault := cryptovault.New(cfg.ClusterSecret)
	reg := provisioning.NewRegistry(dbMgr, vault)

	grpcSrv := grpcx.NewServer(cfg.ClusterSecret)
	corev1.RegisterLicensingServiceServer(grpcSrv, grpcserver.New(reg))

	gw := gateway.New(cfg, reg, core.StaticFS())
	addr := fmt.Sprintf(":%d", cfg.BackendPort)
	fmt.Printf("[proveko-core] listening on %s\n", addr)
	if err := http.ListenAndServe(addr, gw.Router()); err != nil {
		panic(err)
	}
}
