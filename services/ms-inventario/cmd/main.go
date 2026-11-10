package main

import (
	"log"
	"net"
	"net/http"

	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/grpcx"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/alexmargomez/proveko/services/ms-inventario/backend"
	"github.com/alexmargomez/proveko/services/ms-inventario/migrations"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()
	db := tenantdb.NewManager(cfg)
	db.RegisterServiceMigration("ms-inventario", migrations.SchemaSQL)

	svc := backend.NewService(db, cfg.ClusterSecret)

	if grpcPort := config.EnvOr("GRPC_PORT", ""); grpcPort != "" {
		go func() {
			lis, err := net.Listen("tcp", ":"+grpcPort)
			if err != nil {
				log.Fatalf("ms-inventario grpc listen error: %v", err)
			}
			grpcSrv := grpcx.NewServer(cfg.ClusterSecret)
			svc.RegisterGRPC(grpcSrv)
			log.Printf("ms-inventario gRPC listening on :%s", grpcPort)
			if err := grpcSrv.Serve(lis); err != nil {
				log.Fatalf("ms-inventario grpc serve error: %v", err)
			}
		}()
	}

	root := chi.NewRouter()
	root.Use(middleware.Recoverer)
	root.Use(httpx.CORS)
	root.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-inventario"})
	})
	root.Mount("/api/v1/inventario", svc.Router())

	port := config.EnvOr("PORT", "4102")
	log.Printf("ms-inventario HTTP listening on :%s", port)
	if err := http.ListenAndServe(":"+port, root); err != nil {
		log.Fatal(err)
	}
}
