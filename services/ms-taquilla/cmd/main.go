package main

import (
	"context"
	"fmt"
	"log"
	"time"

	mstaquilla "ms-taquilla"
	"ms-taquilla/backend"
	"ms-taquilla/internal/platform/config"
	"ms-taquilla/internal/platform/dbpool"
	"ms-taquilla/internal/platform/gateway"
	"ms-taquilla/internal/platform/httpx"
	"ms-taquilla/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-taquilla", 4111)
	if err != nil {
		log.Fatalf("[ms-taquilla] invalid configuration: %v", err)
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
		log.Fatalf("[ms-taquilla] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	svc, err := backend.NewService(cfg, pubKey, replay, dbMgr)
	if err != nil {
		dbMgr.Close()
		log.Fatalf("[ms-taquilla] failed to initialize service: %v", err)
	}

	if gwClient != nil {
		gwClient.RegisterWithRetry(mstaquilla.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-taquilla] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-taquilla] server terminated with error: %v", err)
	}
}
