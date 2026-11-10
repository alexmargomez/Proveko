package backend

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/go-chi/chi/v5"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

type createAppointmentRequest struct {
	CustomerID  string `json:"customerId"`
	WorkerID    string `json:"workerId"`
	DateTime    string `json:"dateTime"`
	ServiceName string `json:"serviceName"`
	Notes       string `json:"notes"`
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/appointments", s.handleCreateAppointment)
	r.Delete("/appointments/{id}", s.handleDeleteAppointment)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		customers := d.Customers
		if customers == nil {
			customers = []tenantdb.Customer{}
		}
		workers := d.Workers
		if workers == nil {
			workers = []tenantdb.Worker{}
		}
		appointments := d.GenericModules["calendario_citas"]
		if appointments == nil {
			appointments = []tenantdb.GenericRecord{}
		}

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"nextCode":     s.db.Seq.Peek(tc.DBName, "CIT", 605),
			"customers":    customers,
			"workers":      workers,
			"appointments": appointments,
		})
	})
}

func (s *Service) handleCreateAppointment(w http.ResponseWriter, r *http.Request) {
	var req createAppointmentRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para la cita")
		return
	}
	req.DateTime = strings.TrimSpace(strings.ReplaceAll(req.DateTime, "T", " "))
	req.ServiceName = strings.TrimSpace(req.ServiceName)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.DateTime == "" || req.ServiceName == "" {
		httpx.Error(w, http.StatusBadRequest, "La fecha/hora y el servicio o motivo de la cita son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.GenericRecord

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}

		var customer tenantdb.Customer
		foundCustomer := false
		for _, c := range d.Customers {
			if c.ID == req.CustomerID {
				customer = c
				foundCustomer = true
				break
			}
		}
		if !foundCustomer {
			return errors.New("selecciona un cliente válido")
		}

		workerName := "Por Asignar"
		workerSpecialty := "General"
		for _, wk := range d.Workers {
			if wk.ID == req.WorkerID {
				workerName = wk.Name
				workerSpecialty = wk.Specialty
				break
			}
		}

		code := s.db.Seq.Next(tc.DBName, "CIT", 605)
		created = tenantdb.GenericRecord{
			ID:        code,
			CreatedAt: time.Now().Format("2006-01-02 15:04"),
			ModuleKey: "calendario_citas",
			Fields: map[string]string{
				"customerId":      customer.ID,
				"customerName":    customer.Name,
				"customerNit":     customer.Nit,
				"customerPhone":   customer.Phone,
				"workerId":        req.WorkerID,
				"workerName":      workerName,
				"workerSpecialty": workerSpecialty,
				"dateTime":        req.DateTime,
				"serviceName":     req.ServiceName,
				"notes":           req.Notes,
				"status":          "Programada",
			},
		}
		d.GenericModules["calendario_citas"] = append([]tenantdb.GenericRecord{created}, d.GenericModules["calendario_citas"]...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":          true,
		"appointment": created,
	})
}

func (s *Service) handleDeleteAppointment(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "Identificador de cita requerido")
		return
	}

	tc := authguard.FromContext(r.Context())
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			return errors.New("cita no encontrada")
		}
		current := d.GenericModules["calendario_citas"]
		filtered := make([]tenantdb.GenericRecord, 0, len(current))
		found := false
		for _, item := range current {
			if item.ID == id {
				found = true
				continue
			}
			filtered = append(filtered, item)
		}
		if !found {
			return errors.New("cita no encontrada")
		}
		d.GenericModules["calendario_citas"] = filtered
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"deletedId": id,
	})
}
