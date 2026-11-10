package backend

import (
	"errors"
	"net/http"
	"strconv"
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

type createTicketRequest struct {
	CustomerID string  `json:"customerId"`
	EventName  string  `json:"eventName"`
	Zone       string  `json:"zone"`
	Qty        float64 `json:"qty"`
	UnitPrice  float64 `json:"unitPrice"`
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/tickets", s.handleCreateTicket)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		customers := d.Customers
		if customers == nil {
			customers = []tenantdb.Customer{}
		}
		tickets := d.GenericModules["venta_boletas"]
		if tickets == nil {
			tickets = []tenantdb.GenericRecord{}
		}

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"nextCode":  s.db.Seq.Peek(tc.DBName, "TKT", 5005),
			"customers": customers,
			"tickets":   tickets,
		})
	})
}

func (s *Service) handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	var req createTicketRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para emisión de boleta")
		return
	}
	req.EventName = strings.TrimSpace(req.EventName)
	req.Zone = strings.TrimSpace(req.Zone)
	if req.Zone == "" {
		req.Zone = "General"
	}
	if req.EventName == "" || req.Qty <= 0 || req.UnitPrice < 0 {
		httpx.Error(w, http.StatusBadRequest, "Ingresa evento/servicio, cantidad mayor a cero y precio válido")
		return
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.GenericRecord

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}

		customerName := "Comprador Mostrador"
		customerNit := "222222222222"
		if req.CustomerID != "" {
			found := false
			for _, c := range d.Customers {
				if c.ID == req.CustomerID {
					customerName = c.Name
					customerNit = c.Nit
					found = true
					break
				}
			}
			if !found {
				return errors.New("el comprador seleccionado no existe")
			}
		}

		code := s.db.Seq.Next(tc.DBName, "TKT", 5005)
		total := req.Qty * req.UnitPrice

		created = tenantdb.GenericRecord{
			ID:        code,
			CreatedAt: time.Now().Format("2006-01-02 15:04"),
			ModuleKey: "venta_boletas",
			Fields: map[string]string{
				"customerId":   req.CustomerID,
				"customerName": customerName,
				"customerNit":  customerNit,
				"eventName":    req.EventName,
				"zone":         req.Zone,
				"qty":          strconv.FormatFloat(req.Qty, 'f', -1, 64),
				"unitPrice":    strconv.FormatFloat(req.UnitPrice, 'f', 0, 64),
				"total":        strconv.FormatFloat(total, 'f', 0, 64),
			},
		}
		d.GenericModules["venta_boletas"] = append([]tenantdb.GenericRecord{created}, d.GenericModules["venta_boletas"]...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"ticket": created,
	})
}
