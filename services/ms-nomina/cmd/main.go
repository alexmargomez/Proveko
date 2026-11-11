package main

import (
	"context"
	"fmt"
	"log"
	"time"

	msnomina "ms-nomina"
	"ms-nomina/backend"
	"ms-nomina/internal/platform/config"
	"ms-nomina/internal/platform/dbpool"
	"ms-nomina/internal/platform/gateway"
	"ms-nomina/internal/platform/httpx"
	"ms-nomina/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-nomina", 4112)
	if err != nil {
		log.Fatalf("[ms-nomina] invalid configuration: %v", err)
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
		log.Fatalf("[ms-nomina] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	dbMgr := dbpool.NewManager(cfg.CommonConfig, false)
	svc, err := backend.NewService(cfg, pubKey, replay, dbMgr)
	if err != nil {
		dbMgr.Close()
		log.Fatalf("[ms-nomina] failed to initialize service: %v", err)
	}

	if gwClient != nil {
		gwClient.RegisterWithRetry(msnomina.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-nomina] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		dbMgr.Close()
	}); err != nil {
		log.Fatalf("[ms-nomina] server terminated with error: %v", err)
	}
}
