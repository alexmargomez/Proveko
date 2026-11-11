package main

import (
	"context"
	"fmt"
	"log"
	"time"

	mscomandas "ms-comandas"
	"ms-comandas/backend"
	"ms-comandas/internal/platform/config"
	"ms-comandas/internal/platform/dbpool"
	"ms-comandas/internal/platform/gateway"
	"ms-comandas/internal/platform/httpx"
	"ms-comandas/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-comandas", 4105)
	if err != nil {
		log.Fatalf("[ms-comandas] invalid configuration: %v", err)
	}

	gwClient := gateway.NewClient(cfg.GatewayURL, cfg.S2SSharedKey)
	if cfg.CorePublicHex == "" && gwClient != nil {
		for i := 0; i < 6; i++ {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			pubHex, fetchErr := gwClient.FetchVerifierPublicKey(ctx)
			cancel()
			if fetchErr == nil && pubHex != "" {
				cfg.CorePublicHex = pubHex
				break
			}
			time.Sleep(400 * time.Millisecond)
		}
	}

	pubKey, err := security.LoadVerifierPublicKey(cfg.CorePublicHex, cfg.DevEd25519Seed, cfg.IsProduction())
	if err != nil {
		log.Fatalf("[ms-comandas] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	svc := backend.NewService(cfg, pubKey, replay, dbMgr)

	if gwClient != nil {
		gwClient.RegisterWithRetry(mscomandas.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-comandas] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-comandas] server terminated with error: %v", err)
	}
}
