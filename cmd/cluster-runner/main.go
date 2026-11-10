package main

import (
	"fmt"
	"net/http"

	"github.com/alexmargomez/proveko/core"
	"github.com/alexmargomez/proveko/core/backend/gateway"
	"github.com/alexmargomez/proveko/core/backend/grpcserver"
	"github.com/alexmargomez/proveko/core/backend/provisioning"
	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/cryptovault"
	"github.com/alexmargomez/proveko/pkg/grpcx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	corev1 "github.com/alexmargomez/proveko/proto/core/v1"
	customersv1 "github.com/alexmargomez/proveko/proto/customers/v1"
	gastrov1 "github.com/alexmargomez/proveko/proto/gastro/v1"
	hospitalityv1 "github.com/alexmargomez/proveko/proto/hospitality/v1"
	inventoryv1 "github.com/alexmargomez/proveko/proto/inventory/v1"
	printingv1 "github.com/alexmargomez/proveko/proto/printing/v1"
	workshopv1 "github.com/alexmargomez/proveko/proto/workshop/v1"

	msagenda "github.com/alexmargomez/proveko/services/ms-agenda/backend"
	sqlagenda "github.com/alexmargomez/proveko/services/ms-agenda/migrations"
	msbascula "github.com/alexmargomez/proveko/services/ms-bascula/backend"
	sqlbascula "github.com/alexmargomez/proveko/services/ms-bascula/migrations"
	mscaja "github.com/alexmargomez/proveko/services/ms-caja/backend"
	sqlcaja "github.com/alexmargomez/proveko/services/ms-caja/migrations"
	msclientes "github.com/alexmargomez/proveko/services/ms-clientes/backend"
	sqlclientes "github.com/alexmargomez/proveko/services/ms-clientes/migrations"
	mscomandas "github.com/alexmargomez/proveko/services/ms-comandas/backend"
	sqlcomandas "github.com/alexmargomez/proveko/services/ms-comandas/migrations"
	mscompras "github.com/alexmargomez/proveko/services/ms-compras/backend"
	sqlcompras "github.com/alexmargomez/proveko/services/ms-compras/migrations"
	mscontabilidad "github.com/alexmargomez/proveko/services/ms-contabilidad/backend"
	sqlcontabilidad "github.com/alexmargomez/proveko/services/ms-contabilidad/migrations"
	msfacturacion "github.com/alexmargomez/proveko/services/ms-facturacion/backend"
	sqlfacturacion "github.com/alexmargomez/proveko/services/ms-facturacion/migrations"
	mshoteleria "github.com/alexmargomez/proveko/services/ms-hoteleria/backend"
	sqlhoteleria "github.com/alexmargomez/proveko/services/ms-hoteleria/migrations"
	msimpresiones "github.com/alexmargomez/proveko/services/ms-impresiones/backend"
	sqlimpresiones "github.com/alexmargomez/proveko/services/ms-impresiones/migrations"
	msinventario "github.com/alexmargomez/proveko/services/ms-inventario/backend"
	sqlinventario "github.com/alexmargomez/proveko/services/ms-inventario/migrations"
	msnomina "github.com/alexmargomez/proveko/services/ms-nomina/backend"
	sqlnomina "github.com/alexmargomez/proveko/services/ms-nomina/migrations"
	msreportes "github.com/alexmargomez/proveko/services/ms-reportes/backend"
	sqlreportes "github.com/alexmargomez/proveko/services/ms-reportes/migrations"
	mstaller "github.com/alexmargomez/proveko/services/ms-taller/backend"
	sqltaller "github.com/alexmargomez/proveko/services/ms-taller/migrations"
	mstaquilla "github.com/alexmargomez/proveko/services/ms-taquilla/backend"
	sqltaquilla "github.com/alexmargomez/proveko/services/ms-taquilla/migrations"
)

type ClusterRuntime struct {
	Handler  http.Handler
	Registry *provisioning.Registry
	DB       *tenantdb.Manager
}

// NewClusterRuntime conecta el bus gRPC interno (bufconn o TCP remoto) y monta los 15 microservicios en Core Gateway.
func NewClusterRuntime(cfg config.Config) (*ClusterRuntime, error) {
	dbMgr := tenantdb.NewManager(cfg)

	dbMgr.RegisterServiceMigration("ms-facturacion", sqlfacturacion.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-clientes", sqlclientes.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-inventario", sqlinventario.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-caja", sqlcaja.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-comandas", sqlcomandas.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-hoteleria", sqlhoteleria.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-taller", sqltaller.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-bascula", sqlbascula.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-compras", sqlcompras.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-agenda", sqlagenda.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-taquilla", sqltaquilla.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-nomina", sqlnomina.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-contabilidad", sqlcontabilidad.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-reportes", sqlreportes.SchemaSQL)
	dbMgr.RegisterServiceMigration("ms-impresiones", sqlimpresiones.SchemaSQL)

	vault := cryptovault.New(cfg.ClusterSecret)
	reg := provisioning.NewRegistry(dbMgr, vault)

	svcImpresiones := msimpresiones.NewService(dbMgr, cfg.ClusterSecret)
	svcClientes := msclientes.NewService(dbMgr, cfg.ClusterSecret)
	svcInventario := msinventario.NewService(dbMgr, cfg.ClusterSecret)
	svcCaja := mscaja.NewService(dbMgr, cfg.ClusterSecret)
	svcComandas := mscomandas.NewService(dbMgr, cfg.ClusterSecret)
	svcHoteleria := mshoteleria.NewService(dbMgr, cfg.ClusterSecret)
	svcTaller := mstaller.NewService(dbMgr, cfg.ClusterSecret)
	svcBascula := msbascula.NewService(dbMgr, cfg.ClusterSecret)
	svcCompras := mscompras.NewService(dbMgr, cfg.ClusterSecret)
	svcAgenda := msagenda.NewService(dbMgr, cfg.ClusterSecret)
	svcTaquilla := mstaquilla.NewService(dbMgr, cfg.ClusterSecret)
	svcNomina := msnomina.NewService(dbMgr, cfg.ClusterSecret)
	svcContabilidad := mscontabilidad.NewService(dbMgr, cfg.ClusterSecret)
	svcReportes := msreportes.NewService(dbMgr, cfg.ClusterSecret)

	grpcBus := grpcx.NewServer(cfg.ClusterSecret)
	corev1.RegisterLicensingServiceServer(grpcBus, grpcserver.New(reg))
	svcImpresiones.RegisterGRPC(grpcBus)
	svcClientes.RegisterGRPC(grpcBus)
	svcInventario.RegisterGRPC(grpcBus)
	svcComandas.RegisterGRPC(grpcBus)
	svcHoteleria.RegisterGRPC(grpcBus)
	svcTaller.RegisterGRPC(grpcBus)

	grpcConn, err := grpcx.ServeInMemory(grpcBus, cfg.ClusterSecret)
	if err != nil {
		return nil, err
	}

	svcFacturacion := msfacturacion.NewService(dbMgr, cfg.ClusterSecret, msfacturacion.Clients{
		Inventory:   inventoryv1.NewInventoryServiceClient(grpcConn),
		Customers:   customersv1.NewCustomerServiceClient(grpcConn),
		Workshop:    workshopv1.NewWorkshopServiceClient(grpcConn),
		Hospitality: hospitalityv1.NewHospitalityServiceClient(grpcConn),
		Gastro:      gastrov1.NewGastroServiceClient(grpcConn),
		Printing:    printingv1.NewPrintServiceClient(grpcConn),
	})

	gw := gateway.New(cfg, reg, core.StaticFS())
	services := []gateway.ServiceTarget{
		{ServiceKey: "ms-facturacion", APIPrefix: "/api/v1/facturacion", LocalHandler: svcFacturacion.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_FACTURACION", "")},
		{ServiceKey: "ms-clientes", APIPrefix: "/api/v1/clientes", LocalHandler: svcClientes.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_CLIENTES", "")},
		{ServiceKey: "ms-inventario", APIPrefix: "/api/v1/inventario", LocalHandler: svcInventario.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_INVENTARIO", "")},
		{ServiceKey: "ms-caja", APIPrefix: "/api/v1/caja", LocalHandler: svcCaja.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_CAJA", "")},
		{ServiceKey: "ms-comandas", APIPrefix: "/api/v1/comandas", LocalHandler: svcComandas.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_COMANDAS", "")},
		{ServiceKey: "ms-hoteleria", APIPrefix: "/api/v1/hoteleria", LocalHandler: svcHoteleria.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_HOTELERIA", "")},
		{ServiceKey: "ms-taller", APIPrefix: "/api/v1/taller", LocalHandler: svcTaller.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_TALLER", "")},
		{ServiceKey: "ms-bascula", APIPrefix: "/api/v1/bascula", LocalHandler: svcBascula.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_BASCULA", "")},
		{ServiceKey: "ms-compras", APIPrefix: "/api/v1/compras", LocalHandler: svcCompras.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_COMPRAS", "")},
		{ServiceKey: "ms-agenda", APIPrefix: "/api/v1/agenda", LocalHandler: svcAgenda.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_AGENDA", "")},
		{ServiceKey: "ms-taquilla", APIPrefix: "/api/v1/taquilla", LocalHandler: svcTaquilla.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_TAQUILLA", "")},
		{ServiceKey: "ms-nomina", APIPrefix: "/api/v1/nomina", LocalHandler: svcNomina.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_NOMINA", "")},
		{ServiceKey: "ms-contabilidad", APIPrefix: "/api/v1/contabilidad", LocalHandler: svcContabilidad.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_CONTABILIDAD", "")},
		{ServiceKey: "ms-reportes", APIPrefix: "/api/v1/reportes", LocalHandler: svcReportes.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_REPORTES", "")},
		{ServiceKey: "ms-impresiones", APIPrefix: "/api/v1/impresiones", LocalHandler: svcImpresiones.Router(), UpstreamURL: config.EnvOr("UPSTREAM_MS_IMPRESIONES", "")},
	}
	for _, st := range services {
		gw.RegisterService(st)
	}

	return &ClusterRuntime{
		Handler:  gw.Router(),
		Registry: reg,
		DB:       dbMgr,
	}, nil
}

func main() {
	cfg := config.Load()
	rt, err := NewClusterRuntime(cfg)
	if err != nil {
		panic(err)
	}

	// Expone simultáneamente FRONTEND_PORT y BACKEND_PORT cuando difieren para soportar proxies inversos perimetrales.
	if cfg.FrontendPort > 0 && cfg.FrontendPort != cfg.BackendPort {
		go func() {
			fAddr := fmt.Sprintf(":%d", cfg.FrontendPort)
			fmt.Printf("[proveko-go] SPA & Gateway en %s\n", fAddr)
			_ = http.ListenAndServe(fAddr, rt.Handler)
		}()
	}

	bAddr := fmt.Sprintf(":%d", cfg.BackendPort)
	fmt.Printf("[proveko-go] API Gateway & gRPC Bus activo en %s\n", bAddr)
	if err := http.ListenAndServe(bAddr, rt.Handler); err != nil {
		panic(err)
	}
}
