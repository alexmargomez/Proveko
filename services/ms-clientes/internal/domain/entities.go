package domain

import (
	"strings"
	"time"

	"ms-clientes/internal/platform/apperr"
	"ms-clientes/internal/platform/money"
)

const (
	BaseCustomerSeq = 103
	BaseContractSeq = 202
	BaseTariffSeq   = 103
	BaseAbonoSeq    = 501
)

type Customer struct {
	ID           string  `json:"id"`
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Nit          string  `json:"nit"`
	Phone        string  `json:"phone"`
	Email        string  `json:"email"`
	Address      string  `json:"address"`
	ContractID   string  `json:"contractId"`
	ContractCode string  `json:"contractCode"`
	TariffID     string  `json:"tariffId"`
	TariffName   string  `json:"tariffName"`
	CreditLimit  float64 `json:"creditLimit"`
	CurrentDebt  float64 `json:"currentDebt"`
}

func (c Customer) Clone() Customer {
	return c
}

type Tariff struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	DiscountPct float64 `json:"discountPct"`
}

func (t Tariff) Clone() Tariff {
	return t
}

type Contract struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	EntityNit        string  `json:"entityNit"`
	TariffID         string  `json:"tariffId"`
	TariffName       string  `json:"tariffName"`
	BudgetCeiling    float64 `json:"budgetCeiling"`
	ConsumedAmount   float64 `json:"consumedAmount"`
	AvailableBalance float64 `json:"availableBalance"`
}

func (c Contract) Clone() Contract {
	return c
}

type AbonoRecord struct {
	ID     string  `json:"id"`
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
	Note   string  `json:"note"`
}

func (a AbonoRecord) Clone() AbonoRecord {
	return a
}

type Receivable struct {
	InvoiceID      string        `json:"invoiceId"`
	InvoiceNumber  string        `json:"invoiceNumber"`
	IssueDate      string        `json:"issueDate"`
	CustomerID     string        `json:"customerId"`
	CustomerName   string        `json:"customerName"`
	CustomerNit    string        `json:"customerNit"`
	InvoiceTotal   float64       `json:"invoiceTotal"`
	PendingBalance float64       `json:"pendingBalance"`
	Abonos         []AbonoRecord `json:"abonos"`
}

func (r Receivable) Clone() Receivable {
	abonos := make([]AbonoRecord, len(r.Abonos))
	for i, a := range r.Abonos {
		abonos[i] = a.Clone()
	}
	r.Abonos = abonos
	return r
}

type DirectorySnapshot struct {
	NextCustomerCode string       `json:"nextCustomerCode"`
	NextContractCode string       `json:"nextContractCode"`
	NextTariffCode   string       `json:"nextTariffCode"`
	Customers        []Customer   `json:"customers"`
	Contracts        []Contract   `json:"contracts"`
	Tariffs          []Tariff     `json:"tariffs"`
	PendingInvoices  []Receivable `json:"pendingInvoices"`
}

type CreateCustomerInput struct {
	Name        string  `json:"name"`
	Nit         string  `json:"nit"`
	Phone       string  `json:"phone"`
	Email       string  `json:"email"`
	Address     string  `json:"address"`
	ContractID  string  `json:"contractId"`
	TariffID    string  `json:"tariffId"`
	CreditLimit float64 `json:"creditLimit"`
}

type CreateTariffInput struct {
	Name        string  `json:"name"`
	DiscountPct float64 `json:"discountPct"`
}

type CreateContractInput struct {
	Name          string  `json:"name"`
	EntityName    string  `json:"entityName,omitempty"`
	EntityNit     string  `json:"entityNit"`
	TariffID      string  `json:"tariffId"`
	BudgetCeiling float64 `json:"budgetCeiling"`
}

type RegisterAbonoInput struct {
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
	Note   string  `json:"note"`
}

type CommercialTerms struct {
	CustomerID      string  `json:"customerId"`
	CustomerName    string  `json:"customerName"`
	CustomerNit     string  `json:"customerNit"`
	CustomerPhone   string  `json:"customerPhone"`
	CustomerAddress string  `json:"customerAddress"`
	ContractID      string  `json:"contractId"`
	ContractCode    string  `json:"contractCode"`
	DiscountPct     float64 `json:"discountPct"`
}

type ReceivableDeltaInput struct {
	IdempotencyKey        string  `json:"idempotencyKey"`
	CustomerID            string  `json:"customerId"`
	ContractID            string  `json:"contractId"`
	InvoiceID             string  `json:"invoiceId"`
	InvoiceNumber         string  `json:"invoiceNumber"`
	IssueDate             string  `json:"issueDate"`
	InvoiceTotal          float64 `json:"invoiceTotal"`
	DebtDelta             float64 `json:"debtDelta"`
	ContractConsumedDelta float64 `json:"contractConsumedDelta"`
}

type ReceivableDeltaResult struct {
	Ok           bool    `json:"ok"`
	CustomerName string  `json:"customerName"`
	CustomerNit  string  `json:"customerNit"`
	UpdatedDebt  float64 `json:"updatedDebt"`
}

func BuildTariff(code string, in CreateTariffInput) (Tariff, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Tariff{}, apperr.Validation("El nombre de la tarifa comercial es obligatorio")
	}
	if !money.IsFinite(in.DiscountPct) || in.DiscountPct < 0 || in.DiscountPct > 100 {
		return Tariff{}, apperr.Validation("El porcentaje de descuento debe estar entre 0% y 100%")
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return Tariff{
		ID:          strings.ToLower(cleanCode),
		Code:        cleanCode,
		Name:        name,
		DiscountPct: money.RoundCents(in.DiscountPct),
	}, nil
}

func BuildContract(code string, in CreateContractInput, resolvedTariff *Tariff) (Contract, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = strings.TrimSpace(in.EntityName)
	}
	if name == "" {
		return Contract{}, apperr.Validation("El nombre del contrato o convenio comercial es obligatorio")
	}
	if !money.IsFinite(in.BudgetCeiling) || in.BudgetCeiling < 0 {
		return Contract{}, apperr.Validation("El tope presupuestal del contrato debe ser un monto válido mayor o igual a cero")
	}
	ceiling := money.RoundCents(in.BudgetCeiling)
	cleanCode := strings.ToUpper(strings.TrimSpace(code))

	var tariffID, tariffName string
	if resolvedTariff != nil {
		tariffID = resolvedTariff.ID
		tariffName = resolvedTariff.Name
	}

	return Contract{
		ID:               strings.ToLower(cleanCode),
		Code:             cleanCode,
		Name:             name,
		EntityNit:        strings.TrimSpace(in.EntityNit),
		TariffID:         tariffID,
		TariffName:       tariffName,
		BudgetCeiling:    ceiling,
		ConsumedAmount:   0,
		AvailableBalance: ceiling,
	}, nil
}

func BuildCustomer(code string, in CreateCustomerInput, resolvedContract *Contract, resolvedTariff *Tariff) (Customer, error) {
	name := strings.TrimSpace(in.Name)
	nit := strings.TrimSpace(in.Nit)
	if name == "" || nit == "" {
		return Customer{}, apperr.Validation("El nombre o razón social y el NIT o documento son obligatorios")
	}
	if !money.IsFinite(in.CreditLimit) || in.CreditLimit < 0 {
		return Customer{}, apperr.Validation("El cupo de crédito debe ser un monto válido mayor o igual a cero")
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))

	var contractID, contractCode string
	if resolvedContract != nil {
		contractID = resolvedContract.ID
		contractCode = resolvedContract.Code
	}

	var tariffID, tariffName string
	if resolvedTariff != nil {
		tariffID = resolvedTariff.ID
		tariffName = resolvedTariff.Name
	}

	return Customer{
		ID:           strings.ToLower(cleanCode),
		Code:         cleanCode,
		Name:         name,
		Nit:          nit,
		Phone:        strings.TrimSpace(in.Phone),
		Email:        strings.TrimSpace(in.Email),
		Address:      strings.TrimSpace(in.Address),
		ContractID:   contractID,
		ContractCode: contractCode,
		TariffID:     tariffID,
		TariffName:   tariffName,
		CreditLimit:  money.RoundCents(in.CreditLimit),
		CurrentDebt:  0,
	}, nil
}

func ValidateReceivableDelta(in ReceivableDeltaInput) (ReceivableDeltaInput, error) {
	if !money.IsFinite(in.InvoiceTotal) || in.InvoiceTotal < 0 {
		return ReceivableDeltaInput{}, apperr.Validation("El total de la factura no es válido")
	}
	if !money.IsFinite(in.DebtDelta) {
		return ReceivableDeltaInput{}, apperr.Validation("La variación de cartera no es un monto válido")
	}
	if !money.IsFinite(in.ContractConsumedDelta) {
		return ReceivableDeltaInput{}, apperr.Validation("La variación de consumo del contrato no es un monto válido")
	}

	out := ReceivableDeltaInput{
		IdempotencyKey:        strings.TrimSpace(in.IdempotencyKey),
		CustomerID:            strings.TrimSpace(in.CustomerID),
		ContractID:            strings.TrimSpace(in.ContractID),
		InvoiceID:             strings.TrimSpace(in.InvoiceID),
		InvoiceNumber:         strings.TrimSpace(in.InvoiceNumber),
		IssueDate:             strings.TrimSpace(in.IssueDate),
		InvoiceTotal:          money.RoundCents(in.InvoiceTotal),
		DebtDelta:             money.RoundCents(in.DebtDelta),
		ContractConsumedDelta: money.RoundCents(in.ContractConsumedDelta),
	}

	if out.DebtDelta != 0 && out.CustomerID == "" {
		return ReceivableDeltaInput{}, apperr.Validation("El identificador del cliente es obligatorio para afectar cuentas por cobrar")
	}
	if out.CustomerID == "" && out.ContractID == "" {
		return ReceivableDeltaInput{}, apperr.Validation("Se requiere cliente o contrato para registrar la afectación comercial")
	}
	return out, nil
}

func EvaluateCreditLimit(cust Customer, debtDelta float64, enforceCreditLimit bool) error {
	if debtDelta > 0 && enforceCreditLimit && cust.CreditLimit > 0 && money.RoundCents(cust.CurrentDebt+debtDelta) > cust.CreditLimit {
		return apperr.Unprocessable("El saldo supera el cupo de crédito autorizado del cliente")
	}
	return nil
}

func EvaluateContractCeiling(cnt Contract, consumedDelta float64) error {
	if consumedDelta > 0 && cnt.BudgetCeiling > 0 && money.RoundCents(cnt.ConsumedAmount+consumedDelta) > cnt.BudgetCeiling {
		return apperr.Unprocessable("El consumo supera el tope presupuestal del contrato")
	}
	return nil
}

func ComputeUpdatedDebt(currentDebt, debtDelta float64) float64 {
	updated := money.RoundCents(currentDebt + debtDelta)
	if updated < 0 {
		return 0
	}
	return updated
}

func ComputeUpdatedContractBalances(ceiling, currentConsumed, consumedDelta float64) (float64, float64) {
	consumed := money.RoundCents(currentConsumed + consumedDelta)
	if consumed < 0 {
		consumed = 0
	}
	avail := money.RoundCents(ceiling - consumed)
	if avail < 0 {
		avail = 0
	}
	return consumed, avail
}

func BuildOrUpdateReceivable(existing *Receivable, cust Customer, in ReceivableDeltaInput, now time.Time) *Receivable {
	if in.DebtDelta == 0 {
		return existing
	}

	invoiceID := in.InvoiceID
	if invoiceID == "" {
		invoiceID = in.InvoiceNumber
	}
	if invoiceID == "" && in.DebtDelta > 0 {
		invoiceID = money.NewID("FV")
	}

	invoiceNumber := in.InvoiceNumber
	if invoiceNumber == "" {
		invoiceNumber = invoiceID
	}

	issueDate := in.IssueDate
	if issueDate == "" {
		issueDate = now.Format("2006-01-02")
	}

	if in.DebtDelta > 0 {
		if existing != nil {
			cp := existing.Clone()
			cp.PendingBalance = money.RoundCents(cp.PendingBalance + in.DebtDelta)
			if in.InvoiceTotal > cp.InvoiceTotal {
				cp.InvoiceTotal = in.InvoiceTotal
			}
			return &cp
		}
		invTotal := in.InvoiceTotal
		if invTotal < in.DebtDelta {
			invTotal = in.DebtDelta
		}
		return &Receivable{
			InvoiceID:      invoiceID,
			InvoiceNumber:  invoiceNumber,
			IssueDate:      issueDate,
			CustomerID:     cust.ID,
			CustomerName:   cust.Name,
			CustomerNit:    cust.Nit,
			InvoiceTotal:   invTotal,
			PendingBalance: in.DebtDelta,
			Abonos:         []AbonoRecord{},
		}
	}

	if existing == nil {
		return nil
	}
	cp := existing.Clone()
	nextPending := money.RoundCents(cp.PendingBalance + in.DebtDelta)
	if nextPending < 0 {
		nextPending = 0
	}
	cp.PendingBalance = nextPending
	return &cp
}

func ApplyAbono(rec Receivable, cust *Customer, abonoCode string, in RegisterAbonoInput, now time.Time) (Receivable, *Customer, AbonoRecord, error) {
	if !money.IsFinite(in.Amount) || money.RoundCents(in.Amount) <= 0 {
		return Receivable{}, nil, AbonoRecord{}, apperr.Validation("El valor del abono debe ser mayor a cero")
	}
	amount := money.RoundCents(in.Amount)
	if amount > rec.PendingBalance+0.009 {
		return Receivable{}, nil, AbonoRecord{}, apperr.Conflict("El valor del abono excede el saldo pendiente de la factura")
	}

	method := strings.TrimSpace(in.Method)
	if method == "" {
		method = "Transferencia Bancaria"
	}

	abono := AbonoRecord{
		ID:     strings.ToUpper(strings.TrimSpace(abonoCode)),
		Date:   now.Format("2006-01-02 15:04"),
		Amount: amount,
		Method: method,
		Note:   strings.TrimSpace(in.Note),
	}

	updatedRec := rec.Clone()
	nextPending := money.RoundCents(updatedRec.PendingBalance - amount)
	if nextPending < 0 {
		nextPending = 0
	}
	updatedRec.PendingBalance = nextPending
	updatedRec.Abonos = append(updatedRec.Abonos, abono)

	var updatedCust *Customer
	if cust != nil {
		cp := cust.Clone()
		nextDebt := money.RoundCents(cp.CurrentDebt - amount)
		if nextDebt < 0 {
			nextDebt = 0
		}
		cp.CurrentDebt = nextDebt
		updatedCust = &cp
	}

	return updatedRec, updatedCust, abono, nil
}

type SeedBundle struct {
	Tariffs     []Tariff
	Contracts   []Contract
	Customers   []Customer
	Receivables []Receivable
}

func InitialSeedBundle(now time.Time) SeedBundle {
	threeDaysAgo := now.AddDate(0, 0, -3).Format("2006-01-02")
	oneDayAgo := now.AddDate(0, 0, -1).Format("2006-01-02")
	abonoDate := now.AddDate(0, 0, -1).Format("2006-01-02") + " 10:30"

	return SeedBundle{
		Tariffs: []Tariff{
			{ID: "trf-101", Code: "TRF-101", Name: "Tarifa Plena General", DiscountPct: 0},
			{ID: "trf-102", Code: "TRF-102", Name: "Convenio Corporativo Preferencial", DiscountPct: 8},
			{ID: "trf-103", Code: "TRF-103", Name: "Distribuidor Mayorista Institucional", DiscountPct: 12},
		},
		Contracts: []Contract{
			{
				ID:               "cnv-201",
				Code:             "CNV-201",
				Name:             "Convenio Suministros Inversiones Andinas",
				EntityNit:        "900.412.889-1",
				TariffID:         "trf-102",
				TariffName:       "Convenio Corporativo Preferencial",
				BudgetCeiling:    25000000,
				ConsumedAmount:   4850000,
				AvailableBalance: 20150000,
			},
			{
				ID:               "cnv-202",
				Code:             "CNV-202",
				Name:             "Acuerdo Marco Distribuidora del Valle",
				EntityNit:        "890.305.114-7",
				TariffID:         "trf-103",
				TariffName:       "Distribuidor Mayorista Institucional",
				BudgetCeiling:    40000000,
				ConsumedAmount:   9200000,
				AvailableBalance: 30800000,
			},
		},
		Customers: []Customer{
			{
				ID:           "cli-101",
				Code:         "CLI-101",
				Name:         "Inversiones Andinas S.A.S.",
				Nit:          "900.412.889-1",
				Phone:        "6017428810",
				Email:        "tesoreria@inversionesandinas.co",
				Address:      "Av. El Dorado # 68C-61 Of. 404, Bogotá D.C.",
				ContractID:   "cnv-201",
				ContractCode: "CNV-201",
				TariffID:     "trf-102",
				TariffName:   "Convenio Corporativo Preferencial",
				CreditLimit:  15000000,
				CurrentDebt:  1850000,
			},
			{
				ID:           "cli-102",
				Code:         "CLI-102",
				Name:         "Distribuidora del Valle Ltda.",
				Nit:          "890.305.114-7",
				Phone:        "6024851920",
				Email:        "cuentasporpagar@distrivalle.com.co",
				Address:      "Calle 18 Norte # 5N-34, Cali",
				ContractID:   "cnv-202",
				ContractCode: "CNV-202",
				TariffID:     "trf-103",
				TariffName:   "Distribuidor Mayorista Institucional",
				CreditLimit:  20000000,
				CurrentDebt:  940000,
			},
			{
				ID:           "cli-103",
				Code:         "CLI-103",
				Name:         "Clínica Metropolitana S.A.",
				Nit:          "800.198.445-6",
				Phone:        "6043209900",
				Email:        "facturacion@clinicametropolitana.co",
				Address:      "Cra. 43A # 14-57, Medellín",
				ContractID:   "",
				ContractCode: "",
				TariffID:     "trf-101",
				TariffName:   "Tarifa Plena General",
				CreditLimit:  8000000,
				CurrentDebt:  0,
			},
		},
		Receivables: []Receivable{
			{
				InvoiceID:      "FV-1041",
				InvoiceNumber:  "FV-1041",
				IssueDate:      threeDaysAgo,
				CustomerID:     "cli-101",
				CustomerName:   "Inversiones Andinas S.A.S.",
				CustomerNit:    "900.412.889-1",
				InvoiceTotal:   2350000,
				PendingBalance: 1850000,
				Abonos: []AbonoRecord{
					{
						ID:     "ABN-501",
						Date:   abonoDate,
						Amount: 500000,
						Method: "Transferencia Bancaria",
						Note:   "Abono parcial transferencia empresarial",
					},
				},
			},
			{
				InvoiceID:      "FV-1048",
				InvoiceNumber:  "FV-1048",
				IssueDate:      oneDayAgo,
				CustomerID:     "cli-102",
				CustomerName:   "Distribuidora del Valle Ltda.",
				CustomerNit:    "890.305.114-7",
				InvoiceTotal:   940000,
				PendingBalance: 940000,
				Abonos:         []AbonoRecord{},
			},
		},
	}
}
