package domain

import (
	"strings"

	"ms-contabilidad/internal/platform/apperr"
	"ms-contabilidad/internal/platform/money"
)

const (
	SchemaName          = "accounting"
	ModuleKeyAccounting = "comprobantes_puc"

	VoucherSeqPrefix = "CMP"
	VoucherSeqStart  = 900

	DefaultThirdPartyName = "Tercero General"
	DefaultThirdPartyNit  = "222222222222"

	ErrDoubleEntrySameAccountMsg = "La cuenta débito y la cuenta crédito deben ser distintas para cumplir partida doble"
)

type PucAccount struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	CreatedAt string `json:"createdAt"`
}

func (a *PucAccount) Clone() *PucAccount {
	if a == nil {
		return nil
	}
	cp := *a
	return &cp
}

type AccountingVoucher struct {
	ID                string  `json:"id"`
	Code              string  `json:"code"`
	DebitAccountID    string  `json:"debitAccountId"`
	DebitAccountCode  string  `json:"debitAccountCode"`
	DebitAccountName  string  `json:"debitAccountName"`
	CreditAccountID   string  `json:"creditAccountId"`
	CreditAccountCode string  `json:"creditAccountCode"`
	CreditAccountName string  `json:"creditAccountName"`
	ThirdPartyID      string  `json:"thirdPartyId"`
	ThirdPartyName    string  `json:"thirdPartyName"`
	ThirdPartyNit     string  `json:"thirdPartyNit"`
	Concept           string  `json:"concept"`
	Amount            float64 `json:"amount"`
	CreatedAt         string  `json:"createdAt"`
}

func (v *AccountingVoucher) Clone() *AccountingVoucher {
	if v == nil {
		return nil
	}
	cp := *v
	return &cp
}

type AccountBalance struct {
	AccountID    string  `json:"accountId"`
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	TotalDebits  float64 `json:"totalDebits"`
	TotalCredits float64 `json:"totalCredits"`
	NetBalance   float64 `json:"netBalance"`
}

func (b *AccountBalance) Clone() *AccountBalance {
	if b == nil {
		return nil
	}
	cp := *b
	return &cp
}

type CreatePucAccountInput struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

type CreateVoucherInput struct {
	DebitAccountID  string  `json:"debitAccountId"`
	CreditAccountID string  `json:"creditAccountId"`
	ThirdPartyID    string  `json:"thirdPartyId"`
	ThirdPartyName  string  `json:"thirdPartyName"`
	ThirdPartyNit   string  `json:"thirdPartyNit"`
	Concept         string  `json:"concept"`
	Amount          float64 `json:"amount"`
}

func (in CreateVoucherInput) ResolvedThirdPartyName() string {
	if s := strings.TrimSpace(in.ThirdPartyName); s != "" {
		return s
	}
	return DefaultThirdPartyName
}

func (in CreateVoucherInput) ResolvedThirdPartyNit() string {
	if s := strings.TrimSpace(in.ThirdPartyNit); s != "" {
		return s
	}
	return DefaultThirdPartyNit
}

type AllState struct {
	NextCode        string               `json:"nextCode"`
	NextVoucherCode string               `json:"nextVoucherCode"`
	PucAccounts     []*PucAccount        `json:"pucAccounts"`
	Vouchers        []*AccountingVoucher `json:"vouchers"`
	Balances        []*AccountBalance    `json:"balances"`
}

func ValidatePucCode(raw string) (string, error) {
	code := strings.TrimSpace(raw)
	if len(code) < 2 || len(code) > 12 {
		return "", apperr.Validation("El código PUC debe tener entre 2 y 12 dígitos numéricos")
	}
	for i := 0; i < len(code); i++ {
		if code[i] < '0' || code[i] > '9' {
			return "", apperr.Validation("El código PUC debe contener únicamente dígitos numéricos")
		}
	}
	return code, nil
}

func inferCategoryFromCode(code, category string) string {
	cat := strings.TrimSpace(category)
	if cat != "" {
		return cat
	}
	if len(code) == 0 {
		return "Activo"
	}
	switch code[0] {
	case '1':
		return "Activo"
	case '2':
		return "Pasivo"
	case '3':
		return "Patrimonio"
	case '4':
		return "Ingreso"
	case '5':
		return "Gasto"
	case '6', '7':
		return "Costo"
	default:
		return "Activo"
	}
}

func NewPucAccount(id string, in CreatePucAccountInput, createdAt string) (*PucAccount, error) {
	code, err := ValidatePucCode(in.Code)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation("La denominación de la cuenta PUC es obligatoria")
	}
	return &PucAccount{
		ID:        id,
		Code:      code,
		Name:      name,
		Category:  inferCategoryFromCode(code, in.Category),
		CreatedAt: createdAt,
	}, nil
}

func ValidateVoucherBasics(in CreateVoucherInput) error {
	debitID := strings.TrimSpace(in.DebitAccountID)
	creditID := strings.TrimSpace(in.CreditAccountID)
	if debitID == "" || creditID == "" {
		return apperr.Validation("Debes seleccionar la cuenta débito y la cuenta crédito")
	}
	if strings.EqualFold(debitID, creditID) {
		return apperr.Validation(ErrDoubleEntrySameAccountMsg)
	}
	if strings.TrimSpace(in.Concept) == "" {
		return apperr.Validation("El concepto contable es obligatorio")
	}
	if !money.IsFinite(in.Amount) || in.Amount <= 0 {
		return apperr.Validation("El valor del comprobante contable debe ser mayor a cero")
	}
	return nil
}

func NewAccountingVoucher(code string, debitAcc, creditAcc *PucAccount, in CreateVoucherInput, createdAt string) (*AccountingVoucher, error) {
	if err := ValidateVoucherBasics(in); err != nil {
		return nil, err
	}
	if debitAcc == nil {
		return nil, apperr.NotFound("La cuenta PUC débito seleccionada no existe en el catálogo")
	}
	if creditAcc == nil {
		return nil, apperr.NotFound("La cuenta PUC crédito seleccionada no existe en el catálogo")
	}
	if debitAcc.ID == creditAcc.ID || debitAcc.Code == creditAcc.Code {
		return nil, apperr.Validation(ErrDoubleEntrySameAccountMsg)
	}
	amount := money.RoundCents(in.Amount)
	if amount <= 0 {
		return nil, apperr.Validation("El valor del comprobante contable debe ser mayor a cero")
	}
	return &AccountingVoucher{
		ID:                code,
		Code:              code,
		DebitAccountID:    debitAcc.ID,
		DebitAccountCode:  debitAcc.Code,
		DebitAccountName:  debitAcc.Name,
		CreditAccountID:   creditAcc.ID,
		CreditAccountCode: creditAcc.Code,
		CreditAccountName: creditAcc.Name,
		ThirdPartyID:      strings.TrimSpace(in.ThirdPartyID),
		ThirdPartyName:    in.ResolvedThirdPartyName(),
		ThirdPartyNit:     in.ResolvedThirdPartyNit(),
		Concept:           strings.TrimSpace(in.Concept),
		Amount:            amount,
		CreatedAt:         createdAt,
	}, nil
}

func ComputeAccountBalances(accounts []*PucAccount, vouchers []*AccountingVoucher) []*AccountBalance {
	debits := make(map[string]float64, len(accounts))
	credits := make(map[string]float64, len(accounts))
	for _, v := range vouchers {
		debits[v.DebitAccountID] = money.RoundCents(debits[v.DebitAccountID] + v.Amount)
		credits[v.CreditAccountID] = money.RoundCents(credits[v.CreditAccountID] + v.Amount)
	}

	out := make([]*AccountBalance, 0, len(accounts))
	for _, acc := range accounts {
		d := debits[acc.ID]
		c := credits[acc.ID]
		catLower := strings.ToLower(acc.Category)
		isCreditNature := strings.Contains(catLower, "pasivo") ||
			strings.Contains(catLower, "patrimonio") ||
			strings.Contains(catLower, "ingreso")
		net := money.RoundCents(d - c)
		if isCreditNature {
			net = money.RoundCents(c - d)
		}
		out = append(out, &AccountBalance{
			AccountID:    acc.ID,
			Code:         acc.Code,
			Name:         acc.Name,
			Category:     acc.Category,
			TotalDebits:  d,
			TotalCredits: c,
			NetBalance:   net,
		})
	}
	return out
}
