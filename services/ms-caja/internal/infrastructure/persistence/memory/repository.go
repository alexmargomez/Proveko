package memory

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"ms-caja/internal/platform/apperr"
	"ms-caja/internal/platform/seqmem"
	"ms-caja/internal/domain"
)

const (
	baseIncomeSeq  = 302
	baseExpenseSeq = 507
	baseBankSeq    = 207
)

type tenantStore struct {
	incomes       []domain.CashIncome
	expenses      []domain.Expense
	bankMovements []domain.BankMovement
	idempotency   map[string][]byte
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantStore
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantStore),
	}
}

func (r *Repository) ensureSeeded(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	now := time.Now()
	today := now.Format("2006-01-02")
	st := &tenantStore{
		incomes: []domain.CashIncome{
			{
				ID:            "ING-302",
				Date:          today + " 08:30",
				Category:      "Recaudo Cartera",
				Description:   "Abono convenio empresarial transferencia verificada",
				Amount:        240000,
				PaymentMethod: "Transferencia Bancaria",
				Responsible:   "Tesorería General",
			},
			{
				ID:            "ING-301",
				Date:          today + " 07:45",
				Category:      "Base / Apertura de Caja",
				Description:   "Base inicial de efectivo para turno de apertura",
				Amount:        350000,
				PaymentMethod: "Efectivo",
				Responsible:   "Caja Principal",
			},
		},
		expenses: []domain.Expense{
			{
				ID:            "EGR-507",
				Date:          today + " 11:20",
				Category:      "Transporte y Mensajería",
				Description:   "Envío urgente de documentos y repuestos urbanos",
				Amount:        28000,
				PaymentSource: "Efectivo Caja",
				Responsible:   "Caja Principal",
			},
			{
				ID:            "EGR-506",
				Date:          today + " 09:15",
				Category:      "Insumos Operativos",
				Description:   "Compra rollos térmicos 80mm y elementos de cafetería",
				Amount:        46500,
				PaymentSource: "Efectivo Caja",
				Responsible:   "Caja Principal",
			},
		},
		bankMovements: []domain.BankMovement{
			{
				ID:           "BCO-207",
				Date:         today + " 10:40",
				AccountName:  "Nequi Negocios",
				MovementType: domain.MovementIngreso,
				Reference:    "QR-884920",
				Concept:      "Liquidación ventas QR mostrador mañana",
				Amount:       185000,
				Actor:        "Caja Principal",
			},
			{
				ID:           "BCO-206",
				Date:         today + " 08:55",
				AccountName:  "Bancolombia — Cuenta Empresarial",
				MovementType: domain.MovementEgreso,
				Reference:    "ACH-551902",
				Concept:      "Pago anticipo proveedor nacional de suministros",
				Amount:       120000,
				Actor:        "Tesorería General",
			},
		},
		idempotency: make(map[string][]byte),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetSnapshot(_ context.Context, dbName string) (domain.TreasurySnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	incomes := make([]domain.CashIncome, len(st.incomes))
	for i := range st.incomes {
		incomes[i] = st.incomes[i].Clone()
	}
	expenses := make([]domain.Expense, len(st.expenses))
	for i := range st.expenses {
		expenses[i] = st.expenses[i].Clone()
	}
	movements := make([]domain.BankMovement, len(st.bankMovements))
	for i := range st.bankMovements {
		movements[i] = st.bankMovements[i].Clone()
	}

	return domain.TreasurySnapshot{
		NextIncomeCode:  r.seq.Peek(dbName, "ING", baseIncomeSeq),
		NextExpenseCode: r.seq.Peek(dbName, "EGR", baseExpenseSeq),
		NextBankCode:    r.seq.Peek(dbName, "BCO", baseBankSeq),
		Incomes:         incomes,
		Expenses:        expenses,
		BankMovements:   movements,
	}, nil
}

func (r *Repository) CreateIncome(_ context.Context, dbName, idemKey string, in domain.CreateIncomeInput, actor string) (domain.CashIncome, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if raw, ok := st.idempotency["inc:"+cleanKey]; ok {
			var cached domain.CashIncome
			if err := json.Unmarshal(raw, &cached); err == nil {
				return cached.Clone(), nil
			}
		}
	}

	code := r.seq.Next(dbName, "ING", baseIncomeSeq)
	inc, err := domain.BuildCashIncome(code, in, actor, time.Now())
	if err != nil {
		return domain.CashIncome{}, err
	}
	st.incomes = append([]domain.CashIncome{inc}, st.incomes...)
	if cleanKey != "" {
		if raw, err := json.Marshal(inc); err == nil {
			st.idempotency["inc:"+cleanKey] = raw
		}
	}
	return inc.Clone(), nil
}

func (r *Repository) CreateExpense(_ context.Context, dbName, idemKey string, in domain.CreateExpenseInput, actor string) (domain.Expense, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if raw, ok := st.idempotency["exp:"+cleanKey]; ok {
			var cached domain.Expense
			if err := json.Unmarshal(raw, &cached); err == nil {
				return cached.Clone(), nil
			}
		}
	}

	code := r.seq.Next(dbName, "EGR", baseExpenseSeq)
	exp, err := domain.BuildExpense(code, in, actor, time.Now())
	if err != nil {
		return domain.Expense{}, err
	}
	st.expenses = append([]domain.Expense{exp}, st.expenses...)
	if cleanKey != "" {
		if raw, err := json.Marshal(exp); err == nil {
			st.idempotency["exp:"+cleanKey] = raw
		}
	}
	return exp.Clone(), nil
}

func (r *Repository) DeleteExpense(_ context.Context, dbName, expenseID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	idx := -1
	for i := range st.expenses {
		if st.expenses[i].ID == expenseID {
			idx = i
			break
		}
	}
	if idx == -1 {
		return apperr.NotFound("Comprobante de gasto no encontrado")
	}
	st.expenses = append(st.expenses[:idx], st.expenses[idx+1:]...)
	return nil
}

func (r *Repository) CreateBankMovement(_ context.Context, dbName, idemKey string, in domain.CreateBankMovementInput, actor string) (domain.BankMovement, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if raw, ok := st.idempotency["bco:"+cleanKey]; ok {
			var cached domain.BankMovement
			if err := json.Unmarshal(raw, &cached); err == nil {
				return cached.Clone(), nil
			}
		}
	}

	code := r.seq.Next(dbName, "BCO", baseBankSeq)
	mov, err := domain.BuildBankMovement(code, in, actor, time.Now())
	if err != nil {
		return domain.BankMovement{}, err
	}
	st.bankMovements = append([]domain.BankMovement{mov}, st.bankMovements...)
	if cleanKey != "" {
		if raw, err := json.Marshal(mov); err == nil {
			st.idempotency["bco:"+cleanKey] = raw
		}
	}
	return mov.Clone(), nil
}
