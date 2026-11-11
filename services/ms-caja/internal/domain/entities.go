package domain

import (
	"strings"
	"time"

	"ms-caja/internal/platform/apperr"
	"ms-caja/internal/platform/money"
)

const (
	MovementIngreso = "Ingreso"
	MovementEgreso  = "Egreso"
)

type CashIncome struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"paymentMethod"`
	Responsible   string  `json:"responsible"`
}

func (c CashIncome) Clone() CashIncome {
	return c
}

func (c CashIncome) IsDigital() bool {
	return IsDigitalPayment(c.PaymentMethod)
}

type CreateIncomeInput struct {
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"paymentMethod"`
	Responsible   string  `json:"responsible"`
}

func BuildCashIncome(id string, in CreateIncomeInput, fallbackActor string, now time.Time) (CashIncome, error) {
	desc := strings.TrimSpace(in.Description)
	if desc == "" {
		return CashIncome{}, apperr.Validation("La descripción del ingreso de caja es obligatoria")
	}
	if !money.IsFinite(in.Amount) {
		return CashIncome{}, apperr.Validation("El monto del ingreso no es un número válido")
	}
	amt := money.RoundCents(in.Amount)
	if amt <= 0 {
		return CashIncome{}, apperr.Validation("El monto del ingreso debe ser estrictamente mayor a cero")
	}

	cat := strings.TrimSpace(in.Category)
	if cat == "" {
		cat = "Base / Apertura de Caja"
	}
	pm := strings.TrimSpace(in.PaymentMethod)
	if pm == "" {
		pm = "Efectivo"
	}
	resp := strings.TrimSpace(in.Responsible)
	if resp == "" {
		resp = strings.TrimSpace(fallbackActor)
		if resp == "" {
			resp = "Caja Principal"
		}
	}

	return CashIncome{
		ID:            id,
		Date:          now.Format("2006-01-02 15:04"),
		Category:      cat,
		Description:   desc,
		Amount:        amt,
		PaymentMethod: pm,
		Responsible:   resp,
	}, nil
}

type Expense struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentSource string  `json:"paymentSource"`
	Responsible   string  `json:"responsible"`
}

func (e Expense) Clone() Expense {
	return e
}

func (e Expense) AffectsCashDrawer() bool {
	low := strings.ToLower(strings.TrimSpace(e.PaymentSource))
	return low == "" || strings.Contains(low, "efectivo") || strings.Contains(low, "caja")
}

type CreateExpenseInput struct {
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentSource string  `json:"paymentSource"`
	Responsible   string  `json:"responsible"`
}

func BuildExpense(id string, in CreateExpenseInput, fallbackActor string, now time.Time) (Expense, error) {
	desc := strings.TrimSpace(in.Description)
	if desc == "" {
		return Expense{}, apperr.Validation("La descripción o concepto del gasto es obligatorio")
	}
	if !money.IsFinite(in.Amount) {
		return Expense{}, apperr.Validation("El valor del gasto no es un número válido")
	}
	amt := money.RoundCents(in.Amount)
	if amt <= 0 {
		return Expense{}, apperr.Validation("El valor del gasto debe ser estrictamente mayor a cero")
	}

	cat := strings.TrimSpace(in.Category)
	if cat == "" {
		cat = "Insumos Operativos"
	}
	src := strings.TrimSpace(in.PaymentSource)
	if src == "" {
		src = "Efectivo Caja"
	}
	resp := strings.TrimSpace(in.Responsible)
	if resp == "" {
		resp = strings.TrimSpace(fallbackActor)
		if resp == "" {
			resp = "Caja Principal"
		}
	}

	return Expense{
		ID:            id,
		Date:          now.Format("2006-01-02 15:04"),
		Category:      cat,
		Description:   desc,
		Amount:        amt,
		PaymentSource: src,
		Responsible:   resp,
	}, nil
}

type BankMovement struct {
	ID           string  `json:"id"`
	Date         string  `json:"date"`
	AccountName  string  `json:"accountName"`
	MovementType string  `json:"movementType"`
	Reference    string  `json:"reference"`
	Concept      string  `json:"concept"`
	Amount       float64 `json:"amount"`
	Actor        string  `json:"actor"`
}

func (b BankMovement) Clone() BankMovement {
	return b
}

type CreateBankMovementInput struct {
	AccountName  string  `json:"accountName"`
	MovementType string  `json:"movementType"`
	Reference    string  `json:"reference"`
	Concept      string  `json:"concept"`
	Amount       float64 `json:"amount"`
}

func BuildBankMovement(id string, in CreateBankMovementInput, actor string, now time.Time) (BankMovement, error) {
	concept := strings.TrimSpace(in.Concept)
	if concept == "" {
		return BankMovement{}, apperr.Validation("El concepto del movimiento bancario es obligatorio")
	}
	if !money.IsFinite(in.Amount) {
		return BankMovement{}, apperr.Validation("El monto del movimiento bancario no es un número válido")
	}
	amt := money.RoundCents(in.Amount)
	if amt <= 0 {
		return BankMovement{}, apperr.Validation("El monto del movimiento bancario debe ser estrictamente mayor a cero")
	}

	movType := strings.TrimSpace(in.MovementType)
	if movType == "" {
		movType = MovementIngreso
	}
	if movType != MovementIngreso && movType != MovementEgreso {
		return BankMovement{}, apperr.Validation("El tipo de movimiento bancario debe ser Ingreso o Egreso")
	}

	acc := strings.TrimSpace(in.AccountName)
	if acc == "" {
		acc = "Bancolombia — Cuenta Empresarial"
	}

	return BankMovement{
		ID:           id,
		Date:         now.Format("2006-01-02 15:04"),
		AccountName:  acc,
		MovementType: movType,
		Reference:    strings.TrimSpace(in.Reference),
		Concept:      concept,
		Amount:       amt,
		Actor:        strings.TrimSpace(actor),
	}, nil
}

type TreasurySnapshot struct {
	NextIncomeCode  string         `json:"nextIncomeCode"`
	NextExpenseCode string         `json:"nextExpenseCode"`
	NextBankCode    string         `json:"nextBankCode"`
	Incomes         []CashIncome   `json:"incomes"`
	Expenses        []Expense      `json:"expenses"`
	BankMovements   []BankMovement `json:"bankMovements"`
}

type TreasurySummary struct {
	CashIncomes     float64        `json:"cashIncomes"`
	DigitalIncomes  float64        `json:"digitalIncomes"`
	CashSales       float64        `json:"cashSales"`
	DigitalSales    float64        `json:"digitalSales"`
	TotalExpenses   float64        `json:"totalExpenses"`
	CashExpenses    float64        `json:"cashExpenses"`
	NetCash         float64        `json:"netCash"`
	BankInTotal     float64        `json:"bankInTotal"`
	BankOutTotal    float64        `json:"bankOutTotal"`
	NextIncomeCode  string         `json:"nextIncomeCode"`
	NextExpenseCode string         `json:"nextExpenseCode"`
	NextBankCode    string         `json:"nextBankCode"`
	Incomes         []CashIncome   `json:"incomes"`
	Expenses        []Expense      `json:"expenses"`
	BankMovements   []BankMovement `json:"bankMovements"`
}

func ComputeSummary(snap TreasurySnapshot) TreasurySummary {
	var cashIn, digIn, totalExp, cashExp, bankIn, bankOut float64
	for _, inc := range snap.Incomes {
		if inc.IsDigital() {
			digIn += inc.Amount
		} else {
			cashIn += inc.Amount
		}
	}
	for _, exp := range snap.Expenses {
		totalExp += exp.Amount
		if exp.AffectsCashDrawer() {
			cashExp += exp.Amount
		}
	}
	for _, bm := range snap.BankMovements {
		if bm.MovementType == MovementIngreso {
			bankIn += bm.Amount
		} else {
			bankOut += bm.Amount
		}
	}

	cashIn = money.RoundCents(cashIn)
	digIn = money.RoundCents(digIn)
	totalExp = money.RoundCents(totalExp)
	cashExp = money.RoundCents(cashExp)
	bankIn = money.RoundCents(bankIn)
	bankOut = money.RoundCents(bankOut)

	incomes := snap.Incomes
	if incomes == nil {
		incomes = []CashIncome{}
	}
	expenses := snap.Expenses
	if expenses == nil {
		expenses = []Expense{}
	}
	movements := snap.BankMovements
	if movements == nil {
		movements = []BankMovement{}
	}

	return TreasurySummary{
		CashIncomes:     cashIn,
		DigitalIncomes:  digIn,
		CashSales:       cashIn,
		DigitalSales:    digIn,
		TotalExpenses:   totalExp,
		CashExpenses:    cashExp,
		NetCash:         money.RoundCents(cashIn - cashExp),
		BankInTotal:     bankIn,
		BankOutTotal:    bankOut,
		NextIncomeCode:  snap.NextIncomeCode,
		NextExpenseCode: snap.NextExpenseCode,
		NextBankCode:    snap.NextBankCode,
		Incomes:         incomes,
		Expenses:        expenses,
		BankMovements:   movements,
	}
}

func IsDigitalPayment(method string) bool {
	low := strings.ToLower(strings.TrimSpace(method))
	return strings.Contains(low, "transferencia") ||
		strings.Contains(low, "tarjeta") ||
		strings.Contains(low, "nequi") ||
		strings.Contains(low, "daviplata") ||
		strings.Contains(low, "pse") ||
		strings.Contains(low, "qr") ||
		strings.Contains(low, "digital")
}
