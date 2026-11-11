package main

import (
	"context"
	"fmt"
	"log"
	"time"

	msagenda "ms-agenda"
	"ms-agenda/backend"
	"ms-agenda/internal/platform/config"
	"ms-agenda/internal/platform/dbpool"
	"ms-agenda/internal/platform/gateway"
	"ms-agenda/internal/platform/httpx"
	"ms-agenda/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-agenda", 4110)
	if err != nil {
		log.Fatalf("[ms-agenda] invalid configuration: %v", err)
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
		log.Fatalf("[ms-agenda] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	svc, err := backend.NewService(cfg, pubKey, replay, dbMgr)
	if err != nil {
		dbMgr.Close()
		log.Fatalf("[ms-agenda] failed to initialize service: %v", err)
	}

	if gwClient != nil {
		gwClient.RegisterWithRetry(msagenda.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-agenda] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-agenda] server terminated with error: %v", err)
	}
}
