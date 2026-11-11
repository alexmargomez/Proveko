package main

import (
	"context"
	"fmt"
	"log"
	"time"

	msplatform "ms-platform"
	"ms-platform/backend"
	"ms-platform/internal/platform/config"
	"ms-platform/internal/platform/gateway"
	"ms-platform/internal/platform/httpx"
	"ms-platform/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-platform", 4100)
	if err != nil {
		log.Fatalf("[ms-platform] invalid configuration: %v", err)
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
		log.Fatalf("[ms-platform] failed to load verifier public key: %v", err)
	}

	replay := security.NewReplayGuard(16384)
	svc := backend.NewService(cfg, pubKey, replay)
	if gwClient != nil {
		gwClient.RegisterWithRetry(msplatform.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-platform] HTTP server listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, nil); err != nil {
		log.Fatalf("[ms-platform] server terminated with error: %v", err)
	}
}
