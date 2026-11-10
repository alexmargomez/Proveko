package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/alexmargomez/proveko/services/ms-agenda/backend"
	"github.com/alexmargomez/proveko/services/ms-agenda/migrations"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()
	db := tenantdb.NewManager(cfg)
	db.RegisterServiceMigration("ms-agenda", migrations.SchemaSQL)

	svc := backend.NewService(db, cfg.ClusterSecret)

	root := chi.NewRouter()
	root.Use(middleware.Recoverer)
	root.Use(httpx.CORS)
	root.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-agenda"})
	})
	root.Mount("/api/v1/agenda", svc.Router())

	addr := fmt.Sprintf(":%d", cfg.BackendPort)
	log.Printf("[ms-agenda] escuchando en %s", addr)
	if err := http.ListenAndServe(addr, root); err != nil {
		log.Fatal(err)
	}
}
