package backend

import (
	"errors"
	"fmt"
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

type createPayrollRequest struct {
	WorkerID   string  `json:"workerId"`
	Period     string  `json:"period"`
	BaseSalary float64 `json:"baseSalary"`
	Bonuses    float64 `json:"bonuses"`
	Deductions float64 `json:"deductions"`
}

type createWorkerRequest struct {
	Name      string `json:"name"`
	DocNumber string `json:"docNumber"`
	Specialty string `json:"specialty"`
	Phone     string `json:"phone"`
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/payrolls", s.handleCreatePayroll)
	r.Post("/workers", s.handleCreateWorker)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		workers := d.Workers
		if workers == nil {
			workers = []tenantdb.Worker{}
		}
		payrolls := d.GenericModules["liquidacion_nomina"]
		if payrolls == nil {
			payrolls = []tenantdb.GenericRecord{}
		}

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":       true,
			"nextCode": s.db.Seq.Peek(tc.DBName, "NOM", 305),
			"workers":  workers,
			"payrolls": payrolls,
		})
	})
}

func (s *Service) handleCreatePayroll(w http.ResponseWriter, r *http.Request) {
	var req createPayrollRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para liquidación de nómina")
		return
	}
	req.Period = strings.TrimSpace(req.Period)
	if req.Period == "" {
		httpx.Error(w, http.StatusBadRequest, "El periodo de nómina es obligatorio")
		return
	}
	if req.BaseSalary <= 0 || req.Bonuses < 0 || req.Deductions < 0 {
		httpx.Error(w, http.StatusBadRequest, "Verifica los valores de salario base, bonificaciones y deducciones")
		return
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.GenericRecord

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}

		var worker tenantdb.Worker
		found := false
		for _, wk := range d.Workers {
			if wk.ID == req.WorkerID {
				worker = wk
				found = true
				break
			}
		}
		if !found {
			return errors.New("selecciona un empleado o colaborador válido")
		}

		netPay := req.BaseSalary + req.Bonuses - req.Deductions
		if netPay < 0 {
			return errors.New("el neto a pagar no puede ser negativo")
		}

		code := s.db.Seq.Next(tc.DBName, "NOM", 305)
		created = tenantdb.GenericRecord{
			ID:        code,
			CreatedAt: time.Now().Format("2006-01-02 15:04"),
			ModuleKey: "liquidacion_nomina",
			Fields: map[string]string{
				"workerId":        worker.ID,
				"workerCode":      worker.Code,
				"workerName":      worker.Name,
				"workerDoc":       worker.DocNumber,
				"workerSpecialty": worker.Specialty,
				"period":          req.Period,
				"baseSalary":      strconv.FormatFloat(req.BaseSalary, 'f', 0, 64),
				"bonuses":         strconv.FormatFloat(req.Bonuses, 'f', 0, 64),
				"deductions":      strconv.FormatFloat(req.Deductions, 'f', 0, 64),
				"netPay":          strconv.FormatFloat(netPay, 'f', 0, 64),
			},
		}
		d.GenericModules["liquidacion_nomina"] = append([]tenantdb.GenericRecord{created}, d.GenericModules["liquidacion_nomina"]...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"payroll": created,
	})
}

func (s *Service) handleCreateWorker(w http.ResponseWriter, r *http.Request) {
	var req createWorkerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para colaborador")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.DocNumber = strings.TrimSpace(req.DocNumber)
	req.Specialty = strings.TrimSpace(req.Specialty)
	if req.Name == "" || req.DocNumber == "" {
		httpx.Error(w, http.StatusBadRequest, "Nombre y documento del colaborador son obligatorios")
		return
	}
	if req.Specialty == "" {
		req.Specialty = "Cargo Operativo / Administrativo"
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.Worker

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		created = tenantdb.Worker{
			ID:        fmt.Sprintf("wk-%d", time.Now().UnixNano()),
			Code:      s.db.Seq.Next(tc.DBName, "EMP", 10),
			Name:      req.Name,
			DocNumber: req.DocNumber,
			Specialty: req.Specialty,
			Phone:     strings.TrimSpace(req.Phone),
		}
		d.Workers = append([]tenantdb.Worker{created}, d.Workers...)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"worker": created,
	})
}
