package backend

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/alexmargomez/proveko/services/ms-bascula/migrations"
	"github.com/go-chi/chi/v5"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	if db != nil {
		db.RegisterServiceMigration("ms-bascula", migrations.SchemaSQL)
	}
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.With(licensegate.RequireModule("pesaje_camionero")).Post("/tickets", s.handleCreateTicket)
	r.Post("/routes", s.handleCreateRoute)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		tickets  []tenantdb.ScaleTicket
		routes   []tenantdb.CargoRoute
		vehicles []tenantdb.Vehicle
		drivers  []tenantdb.Driver
		carriers []tenantdb.Carrier
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		tickets = make([]tenantdb.ScaleTicket, len(d.ScaleTickets))
		copy(tickets, d.ScaleTickets)
		routes = make([]tenantdb.CargoRoute, len(d.CargoRoutes))
		copy(routes, d.CargoRoutes)
		vehicles = make([]tenantdb.Vehicle, len(d.Vehicles))
		copy(vehicles, d.Vehicles)
		drivers = make([]tenantdb.Driver, len(d.Drivers))
		copy(drivers, d.Drivers)
		carriers = make([]tenantdb.Carrier, len(d.Carriers))
		copy(carriers, d.Carriers)
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"nextTicketCode": s.db.Seq.Peek(tc.DBName, "BAS", 1005),
		"nextRouteCode":  s.db.Seq.Peek(tc.DBName, "CAR", 105),
		"tickets":        tickets,
		"routes":         routes,
		"vehicles":       vehicles,
		"drivers":        drivers,
		"carriers":       carriers,
	})
}

type createTicketReq struct {
	VehicleID string  `json:"vehicleId"`
	DriverID  string  `json:"driverId"`
	CarrierID string  `json:"carrierId"`
	CargoID   string  `json:"cargoId"`
	GrossKg   float64 `json:"grossKg"`
	TareKg    float64 `json:"tareKg"`
}

func (s *Service) handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	var req createTicketReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de tiquete de báscula inválido")
		return
	}
	if req.GrossKg <= 0 || req.TareKg < 0 {
		httpx.Error(w, http.StatusBadRequest, "Ingresa pesos Bruto y Tara válidos")
		return
	}
	if req.GrossKg <= req.TareKg {
		httpx.Error(w, http.StatusBadRequest, "El Peso Bruto debe ser estrictamente mayor al Peso Tara")
		return
	}

	req.VehicleID = strings.TrimSpace(req.VehicleID)
	req.DriverID = strings.TrimSpace(req.DriverID)
	req.CarrierID = strings.TrimSpace(req.CarrierID)
	req.CargoID = strings.TrimSpace(req.CargoID)

	tc := authguard.FromContext(r.Context())
	var ticket tenantdb.ScaleTicket

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		plate := "SIN-PLACA"
		for _, v := range d.Vehicles {
			if v.ID == req.VehicleID {
				plate = v.Plate
				break
			}
		}

		driverName := "Conductor General"
		for _, drv := range d.Drivers {
			if drv.ID == req.DriverID {
				driverName = drv.Name
				break
			}
		}

		carrierName := "Transporte Particular"
		for _, car := range d.Carriers {
			if car.ID == req.CarrierID {
				carrierName = car.Name
				break
			}
		}

		cargoDesc := "Carga General"
		for _, rt := range d.CargoRoutes {
			if rt.ID == req.CargoID {
				if rt.Origin != "" && rt.Destination != "" {
					cargoDesc = fmt.Sprintf("%s (%s -> %s)", rt.Description, rt.Origin, rt.Destination)
				} else {
					cargoDesc = rt.Description
				}
				break
			}
		}

		ticket = tenantdb.ScaleTicket{
			ID:          s.db.Seq.Next(tc.DBName, "BAS", 1005),
			Date:        time.Now().Format("2006-01-02 15:04"),
			VehicleID:   req.VehicleID,
			Plate:       plate,
			DriverID:    req.DriverID,
			DriverName:  driverName,
			CarrierID:   req.CarrierID,
			CarrierName: carrierName,
			CargoID:     req.CargoID,
			CargoDesc:   cargoDesc,
			GrossKg:     req.GrossKg,
			TareKg:      req.TareKg,
			NetKg:       req.GrossKg - req.TareKg,
			Status:      "Pesaje Completado",
		}
		d.ScaleTickets = append([]tenantdb.ScaleTicket{ticket}, d.ScaleTickets...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"ticket": ticket,
	})
}

type createRouteReq struct {
	Description string `json:"description"`
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
}

func (s *Service) handleCreateRoute(w http.ResponseWriter, r *http.Request) {
	if !licensegate.HasModule(r.Context(), "pesaje_camionero") && !licensegate.HasModule(r.Context(), "rutas_manifiestos") {
		httpx.Error(w, http.StatusForbidden, "No tienes módulo de báscula habilitado para crear cargas o rutas")
		return
	}

	var req createRouteReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de ruta/carga inválido")
		return
	}
	req.Description = strings.TrimSpace(req.Description)
	if req.Description == "" {
		httpx.Error(w, http.StatusBadRequest, "La descripción del tipo de carga o ruta es obligatoria")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "CAR", 105)
	route := tenantdb.CargoRoute{
		ID:          strings.ToLower(code),
		Code:        code,
		Description: req.Description,
		Origin:      strings.TrimSpace(req.Origin),
		Destination: strings.TrimSpace(req.Destination),
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.CargoRoutes = append(d.CargoRoutes, route)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"route": route,
	})
}
