package main

import (
	"context"
	"fmt"
	"log"
	"time"

	msbascula "ms-bascula"
	"ms-bascula/backend"
	"ms-bascula/internal/platform/config"
	"ms-bascula/internal/platform/dbpool"
	"ms-bascula/internal/platform/gateway"
	"ms-bascula/internal/platform/httpx"
	"ms-bascula/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-bascula", 4108)
	if err != nil {
		log.Fatalf("[ms-bascula] invalid configuration: %v", err)
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
		log.Fatalf("[ms-bascula] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	svc := backend.NewService(cfg, pubKey, replay, dbMgr)

	if gwClient != nil {
		gwClient.RegisterWithRetry(msbascula.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-bascula] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-bascula] server terminated with error: %v", err)
	}
}
