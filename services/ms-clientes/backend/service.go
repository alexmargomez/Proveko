package backend

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	customersv1 "github.com/alexmargomez/proveko/proto/customers/v1"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
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

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	customersv1.RegisterCustomerServiceServer(srv, s)
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/customers", s.handleCreateCustomer)
	r.Delete("/customers/{id}", s.handleDeleteCustomer)
	r.Post("/contracts", s.handleCreateContract)
	r.Post("/vehicles", s.handleCreateVehicle)
	r.Delete("/vehicles/{id}", s.handleDeleteVehicle)
	r.Post("/drivers", s.handleCreateDriver)
	r.Post("/carriers", s.handleCreateCarrier)
	r.Post("/receivables/{invoiceId}/abono", s.handleRegisterAbono)

	return r
}

func (s *Service) ApplyAccountReceivableDelta(
	ctx context.Context,
	req *customersv1.ReceivableDeltaRequest,
) (*customersv1.ReceivableDeltaResponse, error) {
	if req == nil {
		return nil, errors.New("solicitud de cartera vacía")
	}
	tc := authguard.FromContext(ctx)
	enforceCreditLimit := licensegate.HasFeature(ctx, "cartera_cxc", "cupo_credito_control")

	var resp customersv1.ReceivableDeltaResponse
	err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		var resolvedContractID = strings.TrimSpace(req.ContractID)

		if strings.TrimSpace(req.CustomerID) != "" {
			custIdx := -1
			for i := range d.Customers {
				if d.Customers[i].ID == req.CustomerID {
					custIdx = i
					break
				}
			}
			if custIdx >= 0 {
				cust := &d.Customers[custIdx]
				if req.DebtDelta > 0 && enforceCreditLimit && cust.CreditLimit > 0 {
					projected := cust.CurrentDebt + req.DebtDelta
					if projected > cust.CreditLimit {
						return fmt.Errorf(
							"cupo de crédito excedido para %s: saldo proyectado $%.0f supera el cupo autorizado $%.0f",
							cust.Name,
							projected,
							cust.CreditLimit,
						)
					}
				}
				updated := cust.CurrentDebt + req.DebtDelta
				if updated < 0 {
					updated = 0
				}
				cust.CurrentDebt = math.Round(updated)
				resp.CustomerName = cust.Name
				resp.CustomerNit = formatCustomerNit(*cust)
				resp.UpdatedDebt = cust.CurrentDebt
				if resolvedContractID == "" {
					resolvedContractID = cust.ContractID
				}
			}
		}

		if resolvedContractID != "" && req.ContractConsumedDelta != 0 {
			for i := range d.Contracts {
				if d.Contracts[i].ID == resolvedContractID {
					consumed := d.Contracts[i].ConsumedAmount + req.ContractConsumedDelta
					if consumed < 0 {
						consumed = 0
					}
					d.Contracts[i].ConsumedAmount = math.Round(consumed)
					avail := d.Contracts[i].BudgetCeiling - d.Contracts[i].ConsumedAmount
					if avail < 0 {
						avail = 0
					}
					d.Contracts[i].AvailableBalance = math.Round(avail)
					break
				}
			}
		}

		resp.Ok = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &resp, nil
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		customers       = []tenantdb.Customer{}
		contracts       = []tenantdb.Contract{}
		tariffs         = []tenantdb.Tariff{}
		vehicles        = []tenantdb.Vehicle{}
		drivers         = []tenantdb.Driver{}
		carriers        = []tenantdb.Carrier{}
		pendingInvoices = []tenantdb.Invoice{}
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		if len(d.Customers) > 0 {
			customers = append(customers, d.Customers...)
		}
		if len(d.Contracts) > 0 {
			contracts = append(contracts, d.Contracts...)
		}
		if len(d.Tariffs) > 0 {
			tariffs = append(tariffs, d.Tariffs...)
		}
		if len(d.Vehicles) > 0 {
			vehicles = append(vehicles, d.Vehicles...)
		}
		if len(d.Drivers) > 0 {
			drivers = append(drivers, d.Drivers...)
		}
		if len(d.Carriers) > 0 {
			carriers = append(carriers, d.Carriers...)
		}
		for _, inv := range d.Invoices {
			if inv.PendingBalance > 0 {
				pendingInvoices = append(pendingInvoices, inv)
			}
		}
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"nextCustomerCode": s.db.Seq.Peek(tc.DBName, "CLI", 1005),
		"nextContractCode": s.db.Seq.Peek(tc.DBName, "CNV", 205),
		"nextDriverCode":   s.db.Seq.Peek(tc.DBName, "COND", 305),
		"nextCarrierCode":  s.db.Seq.Peek(tc.DBName, "TRN", 405),
		"customers":        customers,
		"contracts":        contracts,
		"tariffs":          tariffs,
		"vehicles":         vehicles,
		"drivers":          drivers,
		"carriers":         carriers,
		"pendingInvoices":  pendingInvoices,
	})
}

func (s *Service) handleCreateCustomer(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Customer
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de cliente inválidos")
		return
	}
	if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.Nit) == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre y número de documento / NIT son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "CLI", 1005)

	var created tenantdb.Customer
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		docType := strings.TrimSpace(in.DocType)
		if docType == "" {
			docType = "NIT"
		}
		taxRegime := strings.TrimSpace(in.TaxRegime)
		if taxRegime == "" {
			if docType == "NIT" {
				taxRegime = "Responsable de IVA"
			} else {
				taxRegime = "No Responsable"
			}
		}
		contractID := strings.TrimSpace(in.ContractID)
		if contractID == "" && len(d.Contracts) > 0 {
			contractID = d.Contracts[0].ID
		}
		tariffID := strings.TrimSpace(in.TariffID)
		if tariffID == "" {
			for _, c := range d.Contracts {
				if c.ID == contractID && c.TariffID != "" {
					tariffID = c.TariffID
					break
				}
			}
			if tariffID == "" && len(d.Tariffs) > 0 {
				tariffID = d.Tariffs[0].ID
			}
		}

		created = tenantdb.Customer{
			ID:          strings.ToLower(strings.ReplaceAll(code, "-", "")),
			Code:        code,
			DocType:     docType,
			Nit:         strings.TrimSpace(in.Nit),
			DV:          strings.TrimSpace(in.DV),
			Name:        strings.TrimSpace(in.Name),
			TaxRegime:   taxRegime,
			Phone:       strings.TrimSpace(in.Phone),
			Email:       strings.TrimSpace(in.Email),
			City:        strings.TrimSpace(in.City),
			Address:     strings.TrimSpace(in.Address),
			ContractID:  contractID,
			TariffID:    tariffID,
			CreditLimit: math.Max(0, in.CreditLimit),
			CurrentDebt: math.Max(0, in.CurrentDebt),
		}
		d.Customers = append(d.Customers, created)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"customer": created,
	})
}

func (s *Service) handleDeleteCustomer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tc := authguard.FromContext(r.Context())

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		filtered := make([]tenantdb.Customer, 0, len(d.Customers))
		found := false
		for _, c := range d.Customers {
			if c.ID == id {
				found = true
				continue
			}
			filtered = append(filtered, c)
		}
		if !found {
			return errors.New("cliente no encontrado")
		}
		d.Customers = filtered
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Service) handleCreateContract(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Contract
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de convenio inválidos")
		return
	}
	if strings.TrimSpace(in.EntityName) == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre de la entidad o convenio es obligatorio")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "CNV", 205)

	var created tenantdb.Contract
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		tariffID := strings.TrimSpace(in.TariffID)
		tariffName := strings.TrimSpace(in.TariffName)
		if tariffID == "" && len(d.Tariffs) > 0 {
			tariffID = d.Tariffs[0].ID
			tariffName = d.Tariffs[0].Name
		} else {
			for _, t := range d.Tariffs {
				if t.ID == tariffID {
					tariffName = t.Name
					break
				}
			}
		}

		ceiling := math.Max(0, in.BudgetCeiling)
		consumed := math.Max(0, in.ConsumedAmount)
		avail := ceiling - consumed
		if avail < 0 {
			avail = 0
		}
		status := strings.TrimSpace(in.Status)
		if status == "" {
			status = "Activo"
		}

		created = tenantdb.Contract{
			ID:               strings.ToLower(strings.ReplaceAll(code, "-", "")),
			Code:             code,
			EntityName:       strings.TrimSpace(in.EntityName),
			TariffID:         tariffID,
			TariffName:       tariffName,
			BudgetCeiling:    ceiling,
			ConsumedAmount:   consumed,
			AvailableBalance: avail,
			Status:           status,
		}
		d.Contracts = append(d.Contracts, created)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"contract": created,
	})
}

func (s *Service) handleCreateVehicle(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Vehicle
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos del vehículo inválidos")
		return
	}
	plate := strings.ToUpper(strings.TrimSpace(in.Plate))
	if plate == "" || strings.TrimSpace(in.Brand) == "" {
		httpx.Error(w, http.StatusBadRequest, "La placa y la marca/línea del vehículo son obligatorias")
		return
	}

	tc := authguard.FromContext(r.Context())
	seqCode := s.db.Seq.Next(tc.DBName, "VEH", 300)

	var created tenantdb.Vehicle
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for _, existing := range d.Vehicles {
			if strings.EqualFold(existing.Plate, plate) {
				return fmt.Errorf("la placa %s ya se encuentra registrada", plate)
			}
		}

		custName := strings.TrimSpace(in.CustomerName)
		if in.CustomerID != "" {
			for _, c := range d.Customers {
				if c.ID == in.CustomerID {
					custName = c.Name
					break
				}
			}
		}

		nextOil := in.NextOilChangeKm
		if nextOil <= 0 && in.CurrentKm > 0 {
			nextOil = in.CurrentKm + 5000
		}

		created = tenantdb.Vehicle{
			ID:              strings.ToLower(strings.ReplaceAll(seqCode, "-", "")),
			Plate:           plate,
			Brand:           strings.TrimSpace(in.Brand),
			ModelYear:       strings.TrimSpace(in.ModelYear),
			CustomerID:      strings.TrimSpace(in.CustomerID),
			CustomerName:    custName,
			CurrentKm:       in.CurrentKm,
			NextOilChangeKm: nextOil,
			SoatExpiry:      strings.TrimSpace(in.SoatExpiry),
			Notes:           strings.TrimSpace(in.Notes),
		}
		d.Vehicles = append(d.Vehicles, created)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"vehicle": created,
	})
}

func (s *Service) handleDeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tc := authguard.FromContext(r.Context())

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		filtered := make([]tenantdb.Vehicle, 0, len(d.Vehicles))
		found := false
		for _, v := range d.Vehicles {
			if v.ID == id {
				found = true
				continue
			}
			filtered = append(filtered, v)
		}
		if !found {
			return errors.New("vehículo no encontrado")
		}
		d.Vehicles = filtered
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Service) handleCreateDriver(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Driver
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos del conductor inválidos")
		return
	}
	if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.DocNumber) == "" {
		httpx.Error(w, http.StatusBadRequest, "Nombre y documento del conductor son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "COND", 305)

	var created tenantdb.Driver
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		plate := strings.TrimSpace(in.AssignedPlate)
		if in.VehicleID != "" {
			for _, v := range d.Vehicles {
				if v.ID == in.VehicleID {
					plate = v.Plate
					break
				}
			}
		}
		lic := strings.TrimSpace(in.LicenseCategory)
		if lic == "" {
			lic = "C2"
		}
		status := strings.TrimSpace(in.Status)
		if status == "" {
			status = "Activo"
		}

		created = tenantdb.Driver{
			ID:              strings.ToLower(strings.ReplaceAll(code, "-", "")),
			Code:            code,
			Name:            strings.TrimSpace(in.Name),
			DocNumber:       strings.TrimSpace(in.DocNumber),
			LicenseCategory: lic,
			Phone:           strings.TrimSpace(in.Phone),
			VehicleID:       strings.TrimSpace(in.VehicleID),
			AssignedPlate:   plate,
			Status:          status,
		}
		d.Drivers = append(d.Drivers, created)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"driver": created,
	})
}

func (s *Service) handleCreateCarrier(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Carrier
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de la transportadora inválidos")
		return
	}
	if strings.TrimSpace(in.Name) == "" || strings.TrimSpace(in.Nit) == "" {
		httpx.Error(w, http.StatusBadRequest, "El NIT y razón social de la transportadora son obligatorios")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "TRN", 405)

	created := tenantdb.Carrier{
		ID:          strings.ToLower(strings.ReplaceAll(code, "-", "")),
		Code:        code,
		Nit:         strings.TrimSpace(in.Nit),
		Name:        strings.TrimSpace(in.Name),
		VehicleType: strings.TrimSpace(in.VehicleType),
		RouteZone:   strings.TrimSpace(in.RouteZone),
		Phone:       strings.TrimSpace(in.Phone),
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.Carriers = append(d.Carriers, created)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"carrier": created,
	})
}

type abonoPayload struct {
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
	Note   string  `json:"note"`
}

func (s *Service) handleRegisterAbono(w http.ResponseWriter, r *http.Request) {
	invoiceID := chi.URLParam(r, "invoiceId")
	var req abonoPayload
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos del abono inválidos")
		return
	}
	if req.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "El valor del abono debe ser mayor a cero")
		return
	}

	tc := authguard.FromContext(r.Context())
	receiptID := s.db.Seq.Next(tc.DBName, "RC", 5005)
	method := strings.TrimSpace(req.Method)
	if method == "" {
		method = "Efectivo / Transferencia"
	}

	var updatedInvoice tenantdb.Invoice
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		invIdx := -1
		for i := range d.Invoices {
			if d.Invoices[i].ID == invoiceID {
				invIdx = i
				break
			}
		}
		if invIdx < 0 {
			return fmt.Errorf("factura %s no encontrada", invoiceID)
		}

		inv := &d.Invoices[invIdx]
		if inv.PendingBalance <= 0 {
			return fmt.Errorf("la factura %s ya se encuentra totalmente pagada", invoiceID)
		}
		if req.Amount > inv.PendingBalance {
			return fmt.Errorf("el abono ($%.0f) supera el saldo pendiente de la factura ($%.0f)", req.Amount, inv.PendingBalance)
		}

		inv.AmountPaid = math.Round(inv.AmountPaid + req.Amount)
		inv.PendingBalance = math.Round(inv.PendingBalance - req.Amount)
		if inv.PendingBalance <= 0 {
			inv.PendingBalance = 0
			inv.Status = "Pagada"
		} else {
			inv.Status = "Pendiente CxC"
		}

		inv.AbonosHistory = append(inv.AbonosHistory, tenantdb.AbonoRecord{
			ID:     receiptID,
			Date:   time.Now().Format("2006-01-02 15:04"),
			Amount: req.Amount,
			Method: method,
			Note:   strings.TrimSpace(req.Note),
		})

		if inv.CustomerID != "" {
			for i := range d.Customers {
				if d.Customers[i].ID == inv.CustomerID {
					newDebt := d.Customers[i].CurrentDebt - req.Amount
					if newDebt < 0 {
						newDebt = 0
					}
					d.Customers[i].CurrentDebt = math.Round(newDebt)
					break
				}
			}
		}

		updatedInvoice = *inv
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"invoice": updatedInvoice,
	})
}

func formatCustomerNit(c tenantdb.Customer) string {
	if c.DV != "" && !strings.Contains(c.Nit, "-") {
		return c.Nit + "-" + c.DV
	}
	return c.Nit
}
