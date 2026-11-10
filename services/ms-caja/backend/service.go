package backend

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/alexmargomez/proveko/services/ms-caja/migrations"
	"github.com/go-chi/chi/v5"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	if db != nil {
		db.RegisterServiceMigration("ms-caja", migrations.SchemaSQL)
	}
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/summary", s.handleSummary)
	r.With(licensegate.RequireModule("arqueo_gastos")).Post("/expenses", s.handleCreateExpense)
	r.With(licensegate.RequireModule("arqueo_gastos")).Delete("/expenses/{id}", s.handleDeleteExpense)
	r.With(licensegate.RequireModule("bancos_tesoreria")).Post("/bank-movements", s.handleCreateBankMovement)

	return r
}

func (s *Service) handleSummary(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		cashSales     float64
		digitalSales  float64
		totalExpenses float64
		cashExpenses  float64
		expenses      []tenantdb.Expense
		bankMovements []tenantdb.GenericRecord
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		for _, inv := range d.Invoices {
			if strings.EqualFold(inv.Status, "Anulada") {
				continue
			}
			pm := strings.TrimSpace(inv.PaymentMethod)
			pmLower := strings.ToLower(pm)
			collected := inv.AmountPaid
			if collected <= 0 && inv.PendingBalance <= 0 {
				collected = inv.Total
			}

			switch {
			case pm == "Efectivo" || strings.Contains(pmLower, "efectivo"):
				cashSales += collected
			case isDigitalMethod(pmLower):
				digitalSales += collected
			default:
				for _, ab := range inv.AbonosHistory {
					abLower := strings.ToLower(ab.Method)
					if strings.Contains(abLower, "efectivo") {
						cashSales += ab.Amount
					} else if isDigitalMethod(abLower) {
						digitalSales += ab.Amount
					}
				}
			}
		}

		expenses = make([]tenantdb.Expense, len(d.Expenses))
		copy(expenses, d.Expenses)
		for _, exp := range d.Expenses {
			totalExpenses += exp.Amount
			srcLower := strings.ToLower(exp.PaymentSource)
			if srcLower == "" || strings.Contains(srcLower, "efectivo") || strings.Contains(srcLower, "caja") {
				cashExpenses += exp.Amount
			}
		}

		if d.GenericModules != nil {
			rawBank := d.GenericModules["bancos_tesoreria"]
			bankMovements = make([]tenantdb.GenericRecord, len(rawBank))
			copy(bankMovements, rawBank)
		} else {
			bankMovements = []tenantdb.GenericRecord{}
		}
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"cashSales":       cashSales,
		"digitalSales":    digitalSales,
		"totalExpenses":   totalExpenses,
		"netCash":         cashSales - cashExpenses,
		"nextExpenseCode": s.db.Seq.Peek(tc.DBName, "EGR", 505),
		"nextBankCode":    s.db.Seq.Peek(tc.DBName, "BCO", 205),
		"expenses":        expenses,
		"bankMovements":   bankMovements,
	})
}

type createExpenseReq struct {
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentSource string  `json:"paymentSource"`
	Responsible   string  `json:"responsible"`
}

func (s *Service) handleCreateExpense(w http.ResponseWriter, r *http.Request) {
	var req createExpenseReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de gasto inválido")
		return
	}
	req.Description = strings.TrimSpace(req.Description)
	if req.Description == "" || req.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "Descripción y monto mayor a cero son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Gasto Operativo"
	}
	paymentSource := strings.TrimSpace(req.PaymentSource)
	if paymentSource == "" {
		paymentSource = "Efectivo Caja"
	}
	responsible := strings.TrimSpace(req.Responsible)
	if responsible == "" {
		if tc.Username != "" {
			responsible = tc.Username
		} else {
			responsible = "Caja Principal"
		}
	}

	expense := tenantdb.Expense{
		ID:            s.db.Seq.Next(tc.DBName, "EGR", 505),
		Date:          time.Now().Format("2006-01-02 15:04"),
		Category:      category,
		Description:   req.Description,
		Amount:        req.Amount,
		PaymentSource: paymentSource,
		Responsible:   responsible,
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.Expenses = append([]tenantdb.Expense{expense}, d.Expenses...)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"expense": expense,
	})
}

func (s *Service) handleDeleteExpense(w http.ResponseWriter, r *http.Request) {
	expenseID := strings.TrimSpace(chi.URLParam(r, "id"))
	if expenseID == "" {
		httpx.Error(w, http.StatusBadRequest, "ID de gasto requerido")
		return
	}

	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("comprobante de gasto no encontrado")

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		idx := -1
		for i, exp := range d.Expenses {
			if exp.ID == expenseID {
				idx = i
				break
			}
		}
		if idx == -1 {
			return errNotFound
		}
		d.Expenses = append(d.Expenses[:idx], d.Expenses[idx+1:]...)
		return nil
	})
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

type createBankMovementReq struct {
	AccountName  string  `json:"accountName"`
	MovementType string  `json:"movementType"`
	Reference    string  `json:"reference"`
	Concept      string  `json:"concept"`
	Amount       float64 `json:"amount"`
}

func (s *Service) handleCreateBankMovement(w http.ResponseWriter, r *http.Request) {
	var req createBankMovementReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de movimiento bancario inválido")
		return
	}
	req.Concept = strings.TrimSpace(req.Concept)
	if req.Concept == "" || req.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "Concepto y valor mayor a cero son obligatorios")
		return
	}

	accountName := strings.TrimSpace(req.AccountName)
	if accountName == "" {
		accountName = "Bancolombia Cuenta Corriente"
	}
	movType := strings.TrimSpace(req.MovementType)
	if movType == "" {
		movType = "Ingreso"
	}

	tc := authguard.FromContext(r.Context())
	record := tenantdb.GenericRecord{
		ID:        s.db.Seq.Next(tc.DBName, "BCO", 205),
		CreatedAt: time.Now().Format("2006-01-02 15:04"),
		ModuleKey: "bancos_tesoreria",
		Fields: map[string]string{
			"accountName":  accountName,
			"movementType": movType,
			"reference":    strings.TrimSpace(req.Reference),
			"concept":      req.Concept,
			"amount":       fmt.Sprintf("%.0f", req.Amount),
			"actor":        tc.Username,
		},
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}
		d.GenericModules["bancos_tesoreria"] = append([]tenantdb.GenericRecord{record}, d.GenericModules["bancos_tesoreria"]...)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"movement": record,
	})
}

func isDigitalMethod(pmLower string) bool {
	return strings.Contains(pmLower, "transferencia") ||
		strings.Contains(pmLower, "tarjeta") ||
		strings.Contains(pmLower, "nequi") ||
		strings.Contains(pmLower, "daviplata") ||
		strings.Contains(pmLower, "pse") ||
		strings.Contains(pmLower, "digital")
}
