package main

import (
	"fmt"
	"log"

	mscore "ms-core"
	"ms-core/backend/gateway"
	"ms-core/backend/provisioning"
	"ms-core/internal/platform/config"
	"ms-core/internal/platform/dbpool"
	"ms-core/internal/platform/httpx"
	"ms-core/internal/platform/security"
)

func main() {
	cfg, err := config.LoadCore()
	if err != nil {
		log.Fatalf("[ms-core] invalid configuration: %v", err)
	}
	privKey, _, err := security.LoadCoreKeyPair(cfg.CorePrivateHex, cfg.DevEd25519Seed, cfg.IsProduction())
	if err != nil {
		log.Fatalf("[ms-core] failed to load Ed25519 key pair: %v", err)
	}

	dbMgr := dbpool.NewManager(cfg.CommonConfig, true)
	reg, err := provisioning.NewRegistry(cfg, dbMgr)
	if err != nil {
		dbMgr.Close()
		log.Fatalf("[ms-core] failed to initialize registry: %v", err)
	}

	gw := gateway.New(cfg, privKey, reg, mscore.StaticFS())
	addr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(addr, gw.Router())
	log.Printf("[ms-core] Central Hub-and-Spoke Gateway listening on %s", addr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-core] server terminated with error: %v", err)
	}
}
