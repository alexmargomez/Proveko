package main

import (
	"log"
	"net/http"

	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/grpcx"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	customersv1 "github.com/alexmargomez/proveko/proto/customers/v1"
	gastrov1 "github.com/alexmargomez/proveko/proto/gastro/v1"
	hospitalityv1 "github.com/alexmargomez/proveko/proto/hospitality/v1"
	inventoryv1 "github.com/alexmargomez/proveko/proto/inventory/v1"
	printingv1 "github.com/alexmargomez/proveko/proto/printing/v1"
	workshopv1 "github.com/alexmargomez/proveko/proto/workshop/v1"
	"github.com/alexmargomez/proveko/services/ms-facturacion/backend"
	"github.com/alexmargomez/proveko/services/ms-facturacion/migrations"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()
	db := tenantdb.NewManager(cfg)
	db.RegisterServiceMigration("ms-facturacion", migrations.SchemaSQL)

	var clients backend.Clients
	if addr := config.EnvOr("INVENTORY_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Inventory = inventoryv1.NewInventoryServiceClient(cc)
		}
	}
	if addr := config.EnvOr("CUSTOMERS_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Customers = customersv1.NewCustomerServiceClient(cc)
		}
	}
	if addr := config.EnvOr("WORKSHOP_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Workshop = workshopv1.NewWorkshopServiceClient(cc)
		}
	}
	if addr := config.EnvOr("HOSPITALITY_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Hospitality = hospitalityv1.NewHospitalityServiceClient(cc)
		}
	}
	if addr := config.EnvOr("GASTRO_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Gastro = gastrov1.NewGastroServiceClient(cc)
		}
	}
	if addr := config.EnvOr("PRINTING_GRPC_ADDR", ""); addr != "" {
		if cc, err := grpcx.DialTCP(addr, cfg.ClusterSecret); err == nil {
			clients.Printing = printingv1.NewPrintServiceClient(cc)
		}
	}

	svc := backend.NewService(db, cfg.ClusterSecret, clients)

	root := chi.NewRouter()
	root.Use(middleware.Recoverer)
	root.Use(httpx.CORS)
	root.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-facturacion"})
	})
	root.Mount("/api/v1/facturacion", svc.Router())

	port := config.EnvOr("PORT", "4103")
	log.Printf("ms-facturacion HTTP listening on :%s", port)
	if err := http.ListenAndServe(":"+port, root); err != nil {
		log.Fatal(err)
	}
}
