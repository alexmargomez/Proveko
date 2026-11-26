package main

import (
	"context"
	"fmt"
	"log"
	"time"

	msadmin "ms-admin"
	"ms-admin/backend"
	"ms-admin/internal/platform/config"
	"ms-admin/internal/platform/gateway"
	"ms-admin/internal/platform/httpx"
	"ms-admin/internal/platform/security"
)

func main() {
	cfg, err := config.LoadService("ms-admin", 4116)
	if err != nil {
		log.Fatalf("[ms-admin] invalid configuration: %v", err)
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
		if gwClient == nil {
			log.Fatalf("[ms-admin] failed to load verifier public key: %v", err)
		}
		log.Printf("[ms-admin] awaiting dynamic Ed25519 public key from Gateway (%s)", cfg.GatewayURL)
	}

	replay := security.NewReplayGuard(16384)
	svc := backend.NewService(cfg, pubKey, replay)
	if gwClient != nil {
		gwClient.RegisterWithRetry(msadmin.ManifestJSON, cfg.ServicePublicURL)
	}

	httpAddr := fmt.Sprintf(":%d", cfg.HTTPPort)
	httpSrv := httpx.NewServer(httpAddr, svc.Handler())
	log.Printf("[ms-admin] Platform Administration Service listening on %s", httpAddr)

	if err := httpx.ListenAndServeGraceful(httpSrv, func() {
		svc.Close()
	}); err != nil {
		log.Fatalf("[ms-admin] server terminated with error: %v", err)
	}
}
