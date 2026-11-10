package main

import (
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/grpcx"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/alexmargomez/proveko/services/ms-taller/backend"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()
	db := tenantdb.NewManager(cfg)
	svc := backend.NewService(db, cfg.ClusterSecret)

	if grpcPort := config.EnvOr("GRPC_PORT", ""); grpcPort != "" {
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			log.Fatalf("[ms-taller] error iniciando listener gRPC: %v", err)
		}
		grpcSrv := grpcx.NewServer(cfg.ClusterSecret)
		svc.RegisterGRPC(grpcSrv)
		go func() {
			log.Printf("[ms-taller] servidor gRPC escuchando en :%s", grpcPort)
			if err := grpcSrv.Serve(lis); err != nil {
				log.Printf("[ms-taller] gRPC finalizado: %v", err)
			}
		}()
	}

	root := chi.NewRouter()
	root.Use(middleware.Recoverer)
	root.Use(httpx.CORS)
	root.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-taller"})
	})
	root.Mount("/api/v1/taller", svc.Router())

	addr := fmt.Sprintf(":%d", cfg.BackendPort)
	log.Printf("[ms-taller] escuchando en %s", addr)
	if err := http.ListenAndServe(addr, root); err != nil {
		log.Fatal(err)
	}
}
