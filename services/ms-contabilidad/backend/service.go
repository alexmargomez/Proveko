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

type createPucAccountRequest struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

type createVoucherRequest struct {
	DebitAccountID  string  `json:"debitAccountId"`
	CreditAccountID string  `json:"creditAccountId"`
	ThirdPartyID    string  `json:"thirdPartyId"`
	Concept         string  `json:"concept"`
	Amount          float64 `json:"amount"`
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/puc", s.handleCreatePucAccount)
	r.Post("/vouchers", s.handleCreateVoucher)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		pucAccounts := d.PucAccounts
		if pucAccounts == nil {
			pucAccounts = []tenantdb.PucAccount{}
		}
		customers := d.Customers
		if customers == nil {
			customers = []tenantdb.Customer{}
		}
		vouchers := d.GenericModules["comprobantes_puc"]
		if vouchers == nil {
			vouchers = []tenantdb.GenericRecord{}
		}

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":              true,
			"nextVoucherCode": s.db.Seq.Peek(tc.DBName, "CMP", 905),
			"pucAccounts":     pucAccounts,
			"customers":       customers,
			"vouchers":        vouchers,
		})
	})
}

func (s *Service) handleCreatePucAccount(w http.ResponseWriter, r *http.Request) {
	var req createPucAccountRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para cuenta PUC")
		return
	}
	req.Code = strings.TrimSpace(req.Code)
	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.TrimSpace(req.Category)

	if req.Code == "" || req.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "El código PUC y el nombre de la cuenta son obligatorios")
		return
	}
	if req.Category == "" {
		req.Category = "Activo"
	}

	displayName := req.Name
	if !strings.HasPrefix(displayName, req.Code) {
		displayName = fmt.Sprintf("%s — %s", req.Code, req.Name)
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.PucAccount

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for _, acc := range d.PucAccounts {
			if acc.Code == req.Code {
				return fmt.Errorf("la subcuenta PUC %s ya se encuentra registrada", req.Code)
			}
		}
		created = tenantdb.PucAccount{
			ID:       fmt.Sprintf("puc-%s-%d", req.Code, time.Now().UnixNano()),
			Code:     req.Code,
			Name:     displayName,
			Category: req.Category,
		}
		d.PucAccounts = append(d.PucAccounts, created)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":         true,
		"pucAccount": created,
	})
}

func (s *Service) handleCreateVoucher(w http.ResponseWriter, r *http.Request) {
	var req createVoucherRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para el comprobante contable")
		return
	}
	req.Concept = strings.TrimSpace(req.Concept)
	if req.Concept == "" || req.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "Ingresa un concepto contable y un valor mayor a cero")
		return
	}
	if req.DebitAccountID == "" || req.CreditAccountID == "" {
		httpx.Error(w, http.StatusBadRequest, "Selecciona la cuenta PUC Débito y la cuenta PUC Crédito")
		return
	}
	if req.DebitAccountID == req.CreditAccountID {
		httpx.Error(w, http.StatusBadRequest, "La cuenta Débito y la cuenta Crédito deben ser diferentes para conservar partida doble")
		return
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.GenericRecord

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}

		var debitAcc, creditAcc tenantdb.PucAccount
		foundDebit, foundCredit := false, false
		for _, acc := range d.PucAccounts {
			if acc.ID == req.DebitAccountID {
				debitAcc = acc
				foundDebit = true
			}
			if acc.ID == req.CreditAccountID {
				creditAcc = acc
				foundCredit = true
			}
		}
		if !foundDebit || !foundCredit {
			return errors.New("una de las cuentas PUC seleccionadas no existe en el catálogo")
		}

		thirdPartyName := "Tercero General"
		thirdPartyNit := "222222222222"
		if req.ThirdPartyID != "" {
			foundThird := false
			for _, c := range d.Customers {
				if c.ID == req.ThirdPartyID {
					thirdPartyName = c.Name
					thirdPartyNit = c.Nit
					foundThird = true
					break
				}
			}
			if !foundThird {
				return errors.New("el tercero seleccionado no existe")
			}
		}

		code := s.db.Seq.Next(tc.DBName, "CMP", 905)
		created = tenantdb.GenericRecord{
			ID:        code,
			CreatedAt: time.Now().Format("2006-01-02 15:04"),
			ModuleKey: "comprobantes_puc",
			Fields: map[string]string{
				"debitAccountId":    debitAcc.ID,
				"debitAccountCode":  debitAcc.Code,
				"debitAccountName":  debitAcc.Name,
				"creditAccountId":   creditAcc.ID,
				"creditAccountCode": creditAcc.Code,
				"creditAccountName": creditAcc.Name,
				"thirdPartyId":      req.ThirdPartyID,
				"thirdPartyName":    thirdPartyName,
				"thirdPartyNit":     thirdPartyNit,
				"concept":           req.Concept,
				"amount":            strconv.FormatFloat(req.Amount, 'f', 0, 64),
			},
		}
		d.GenericModules["comprobantes_puc"] = append([]tenantdb.GenericRecord{created}, d.GenericModules["comprobantes_puc"]...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"voucher": created,
	})
}
