package backend

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	workshopv1 "github.com/alexmargomez/proveko/proto/workshop/v1"
	"github.com/alexmargomez/proveko/services/ms-taller/migrations"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

var _ workshopv1.WorkshopServiceServer = (*Service)(nil)

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	if db != nil {
		db.RegisterServiceMigration("ms-taller", migrations.SchemaSQL)
	}
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	workshopv1.RegisterWorkshopServiceServer(srv, s)
}

func (s *Service) RegisterInvoicedOrderAndCommission(ctx context.Context, req *workshopv1.WorkshopInvoiceEvent) (*workshopv1.WorkshopInvoiceResponse, error) {
	if req == nil {
		return &workshopv1.WorkshopInvoiceResponse{Ok: false}, nil
	}
	tc := authguard.FromContext(ctx)
	orderID := strings.TrimSpace(req.WorkOrderID)
	mechanicID := strings.TrimSpace(req.MechanicID)
	var mechanicName string

	err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		if orderID != "" {
			for i := range d.WorkOrders {
				if d.WorkOrders[i].ID == orderID {
					d.WorkOrders[i].Status = "Entregado"
					break
				}
			}
		}
		if mechanicID != "" {
			for i := range d.Workers {
				if d.Workers[i].ID == mechanicID || d.Workers[i].Code == mechanicID {
					mechanicName = d.Workers[i].Name
					if req.LaborGross > 0 {
						d.Workers[i].TotalDayGross += req.LaborGross
					}
					break
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &workshopv1.WorkshopInvoiceResponse{
		Ok:           true,
		MechanicName: mechanicName,
	}, nil
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.With(licensegate.RequireModule("tablero_ordenes")).Post("/orders", s.handleCreateOrder)
	r.With(licensegate.RequireModule("tablero_ordenes")).Post("/orders/{id}/stage", s.handleUpdateOrderStage)
	r.With(licensegate.RequireModule("comisiones_tecnicos")).Post("/workers", s.handleCreateWorker)
	r.With(licensegate.RequireModule("comisiones_tecnicos")).Post("/workers/{id}/settle", s.handleSettleWorker)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		orders      []tenantdb.WorkOrder
		workers     []tenantdb.Worker
		settlements []tenantdb.Settlement
		customers   []tenantdb.Customer
		vehicles    []tenantdb.Vehicle
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		orders = make([]tenantdb.WorkOrder, len(d.WorkOrders))
		copy(orders, d.WorkOrders)
		workers = make([]tenantdb.Worker, len(d.Workers))
		copy(workers, d.Workers)
		settlements = make([]tenantdb.Settlement, len(d.Settlements))
		copy(settlements, d.Settlements)
		customers = make([]tenantdb.Customer, len(d.Customers))
		copy(customers, d.Customers)
		vehicles = make([]tenantdb.Vehicle, len(d.Vehicles))
		copy(vehicles, d.Vehicles)
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"nextOrderCode":  s.db.Seq.Peek(tc.DBName, "OT", 705),
		"nextWorkerCode": s.db.Seq.Peek(tc.DBName, "TEC", 105),
		"orders":         orders,
		"workers":        workers,
		"settlements":    settlements,
		"customers":      customers,
		"vehicles":       vehicles,
	})
}

type createOrderReq struct {
	CustomerID     string  `json:"customerId"`
	VehicleID      string  `json:"vehicleId"`
	WorkerID       string  `json:"workerId"`
	CurrentKm      int     `json:"currentKm"`
	ServiceDesc    string  `json:"serviceDesc"`
	TotalEstimated float64 `json:"totalEstimated"`
}

func (s *Service) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var req createOrderReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de orden de trabajo inválido")
		return
	}
	req.CustomerID = strings.TrimSpace(req.CustomerID)
	req.VehicleID = strings.TrimSpace(req.VehicleID)
	req.WorkerID = strings.TrimSpace(req.WorkerID)
	req.ServiceDesc = strings.TrimSpace(req.ServiceDesc)
	if req.VehicleID == "" || req.ServiceDesc == "" {
		httpx.Error(w, http.StatusBadRequest, "Placa del vehículo y descripción del servicio son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.WorkOrder

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		var (
			customerName string
			plate        string
			vehicleBrand string
			workerName   string
		)

		for _, c := range d.Customers {
			if c.ID == req.CustomerID {
				customerName = c.Name
				break
			}
		}

		currentKm := req.CurrentKm
		for i := range d.Vehicles {
			if d.Vehicles[i].ID == req.VehicleID {
				plate = d.Vehicles[i].Plate
				vehicleBrand = d.Vehicles[i].Brand
				if customerName == "" {
					req.CustomerID = d.Vehicles[i].CustomerID
					customerName = d.Vehicles[i].CustomerName
				}
				if currentKm <= 0 {
					currentKm = d.Vehicles[i].CurrentKm
				}
				d.Vehicles[i].CurrentKm = currentKm
				d.Vehicles[i].NextOilChangeKm = currentKm + 5000
				break
			}
		}
		if customerName == "" {
			customerName = "Cliente Mostrador"
		}

		for _, wk := range d.Workers {
			if wk.ID == req.WorkerID {
				workerName = wk.Name
				break
			}
		}

		created = tenantdb.WorkOrder{
			ID:             s.db.Seq.Next(tc.DBName, "OT", 705),
			CreatedAt:      time.Now().Format("2006-01-02 15:04"),
			CustomerID:     req.CustomerID,
			CustomerName:   customerName,
			VehicleID:      req.VehicleID,
			Plate:          plate,
			VehicleBrand:   vehicleBrand,
			CurrentKm:      currentKm,
			NextOilKm:      currentKm + 5000,
			WorkerID:       req.WorkerID,
			WorkerName:     workerName,
			Status:         "Recibido",
			ServiceDesc:    req.ServiceDesc,
			TotalEstimated: req.TotalEstimated,
		}
		d.WorkOrders = append([]tenantdb.WorkOrder{created}, d.WorkOrders...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"order": created,
	})
}

type updateStageReq struct {
	Status string `json:"status"`
}

func (s *Service) handleUpdateOrderStage(w http.ResponseWriter, r *http.Request) {
	orderID := strings.TrimSpace(chi.URLParam(r, "id"))
	var req updateStageReq
	_ = httpx.Decode(r, &req)
	req.Status = strings.TrimSpace(req.Status)

	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("orden de trabajo no encontrada")
	var updated tenantdb.WorkOrder

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.WorkOrders {
			if d.WorkOrders[i].ID == orderID {
				if req.Status != "" {
					d.WorkOrders[i].Status = req.Status
				} else {
					d.WorkOrders[i].Status = nextOrderStatus(d.WorkOrders[i].Status)
				}
				updated = d.WorkOrders[i]
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"order": updated,
	})
}

type createWorkerReq struct {
	Name          string  `json:"name"`
	DocNumber     string  `json:"docNumber"`
	Specialty     string  `json:"specialty"`
	CommissionPct float64 `json:"commissionPct"`
	Phone         string  `json:"phone"`
}

func (s *Service) handleCreateWorker(w http.ResponseWriter, r *http.Request) {
	var req createWorkerReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de especialista inválido")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre del técnico es obligatorio")
		return
	}
	if req.CommissionPct <= 0 || req.CommissionPct > 100 {
		req.CommissionPct = 40
	}
	specialty := strings.TrimSpace(req.Specialty)
	if specialty == "" {
		specialty = "Mecánica Automotriz General"
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "TEC", 105)
	worker := tenantdb.Worker{
		ID:            strings.ToLower(code),
		Code:          code,
		Name:          req.Name,
		DocNumber:     strings.TrimSpace(req.DocNumber),
		Specialty:     specialty,
		CommissionPct: req.CommissionPct,
		Phone:         strings.TrimSpace(req.Phone),
		TotalDayGross: 0,
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.Workers = append(d.Workers, worker)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"worker": worker,
	})
}

func (s *Service) handleSettleWorker(w http.ResponseWriter, r *http.Request) {
	workerID := strings.TrimSpace(chi.URLParam(r, "id"))
	tc := authguard.FromContext(r.Context())

	errNotFound := errors.New("técnico no encontrado")
	errNoBalance := errors.New("el técnico no tiene mano de obra acumulada pendiente por liquidar")
	var settlement tenantdb.Settlement

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.Workers {
			if d.Workers[i].ID == workerID {
				wk := &d.Workers[i]
				if wk.TotalDayGross <= 0 {
					return errNoBalance
				}
				payout := wk.TotalDayGross * wk.CommissionPct / 100.0
				retention := wk.TotalDayGross - payout
				settlement = tenantdb.Settlement{
					ID:               s.db.Seq.Next(tc.DBName, "LIQ", 305),
					Date:             time.Now().Format("2006-01-02 15:04"),
					WorkerID:         wk.ID,
					WorkerName:       wk.Name,
					GrossLabor:       wk.TotalDayGross,
					CommissionPct:    wk.CommissionPct,
					TechnicianPayout: payout,
					CompanyRetention: retention,
				}
				wk.TotalDayGross = 0
				d.Settlements = append([]tenantdb.Settlement{settlement}, d.Settlements...)
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errNoBalance) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"settlement": settlement,
	})
}

func nextOrderStatus(current string) string {
	switch current {
	case "Recibido":
		return "En Proceso"
	case "En Proceso":
		return "Listo"
	case "Listo", "Listo para Entrega":
		return "Entregado"
	default:
		return "Entregado"
	}
}
