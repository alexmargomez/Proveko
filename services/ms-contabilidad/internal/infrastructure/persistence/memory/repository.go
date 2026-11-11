package memory

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"ms-contabilidad/internal/platform/apperr"
	"ms-contabilidad/internal/platform/money"
	"ms-contabilidad/internal/platform/seqmem"
	"ms-contabilidad/internal/domain"
)

type tenantBucket struct {
	accounts     []*domain.PucAccount
	vouchers     []*domain.AccountingVoucher
	idemAccounts map[string]*domain.PucAccount
	idemVouchers map[string]*domain.AccountingVoucher
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	buckets map[string]*tenantBucket
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		buckets: make(map[string]*tenantBucket),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantBucket {
	if b, ok := r.buckets[dbName]; ok {
		return b
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	cmpCode1 := r.seq.Next(dbName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)

	b := &tenantBucket{
		accounts: []*domain.PucAccount{
			{ID: "puc-110505", Code: "110505", Name: "Caja General", Category: "Activo", CreatedAt: now},
			{ID: "puc-111005", Code: "111005", Name: "Bancos Moneda Nacional", Category: "Activo", CreatedAt: now},
			{ID: "puc-130505", Code: "130505", Name: "Clientes Nacionales", Category: "Activo", CreatedAt: now},
			{ID: "puc-220505", Code: "220505", Name: "Proveedores Nacionales", Category: "Pasivo", CreatedAt: now},
			{ID: "puc-413505", Code: "413505", Name: "Ingresos Operacionales Comercio", Category: "Ingreso", CreatedAt: now},
			{ID: "puc-513530", Code: "513530", Name: "Servicios Públicos y Operación", Category: "Gasto", CreatedAt: now},
		},
		vouchers: []*domain.AccountingVoucher{
			{
				ID:                cmpCode1,
				Code:              cmpCode1,
				DebitAccountID:    "puc-111005",
				DebitAccountCode:  "111005",
				DebitAccountName:  "Bancos Moneda Nacional",
				CreditAccountID:   "puc-413505",
				CreditAccountCode: "413505",
				CreditAccountName: "Ingresos Operacionales Comercio",
				ThirdPartyID:      "cli-demo-1",
				ThirdPartyName:    "Inversiones del Norte S.A.S.",
				ThirdPartyNit:     "900.312.880-2",
				Concept:           "Consignación recaudo operacional del día",
				Amount:            1850000,
				CreatedAt:         now,
			},
		},
		idemAccounts: make(map[string]*domain.PucAccount),
		idemVouchers: make(map[string]*domain.AccountingVoucher),
	}
	r.buckets[dbName] = b
	return b
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.AllState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	accounts := make([]*domain.PucAccount, len(b.accounts))
	for i, acc := range b.accounts {
		accounts[i] = acc.Clone()
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Code < accounts[j].Code
	})

	vouchers := make([]*domain.AccountingVoucher, len(b.vouchers))
	for i, v := range b.vouchers {
		vouchers[i] = v.Clone()
	}

	nextVoucher := r.seq.Peek(dbName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)
	balances := domain.ComputeAccountBalances(accounts, vouchers)

	return &domain.AllState{
		NextCode:        nextVoucher,
		NextVoucherCode: nextVoucher,
		PucAccounts:     accounts,
		Vouchers:        vouchers,
		Balances:        balances,
	}, nil
}

func (r *Repository) CreatePucAccount(_ context.Context, dbName, idemKey string, in domain.CreatePucAccountInput) (*domain.PucAccount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemAccounts[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	acc, err := domain.NewPucAccount(money.NewID("puc"), in, now)
	if err != nil {
		return nil, err
	}

	for _, existing := range b.accounts {
		if existing.Code == acc.Code {
			return nil, apperr.Conflict("La subcuenta PUC " + acc.Code + " ya se encuentra registrada en el catálogo")
		}
	}

	b.accounts = append(b.accounts, acc.Clone())
	if idemKey != "" {
		b.idemAccounts[idemKey] = acc.Clone()
	}
	return acc.Clone(), nil
}

func (r *Repository) CreateVoucher(_ context.Context, dbName, idemKey string, in domain.CreateVoucherInput) (*domain.AccountingVoucher, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemVouchers[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	if err := domain.ValidateVoucherBasics(in); err != nil {
		return nil, err
	}

	debitRef := strings.TrimSpace(in.DebitAccountID)
	creditRef := strings.TrimSpace(in.CreditAccountID)

	var debitAcc, creditAcc *domain.PucAccount
	for _, acc := range b.accounts {
		if acc.ID == debitRef || acc.Code == debitRef {
			debitAcc = acc
		}
		if acc.ID == creditRef || acc.Code == creditRef {
			creditAcc = acc
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewAccountingVoucher("TMP", debitAcc, creditAcc, in, now); err != nil {
		return nil, err
	}

	code := r.seq.Next(dbName, domain.VoucherSeqPrefix, domain.VoucherSeqStart)
	voucher, err := domain.NewAccountingVoucher(code, debitAcc, creditAcc, in, now)
	if err != nil {
		return nil, err
	}

	b.vouchers = append([]*domain.AccountingVoucher{voucher.Clone()}, b.vouchers...)
	if idemKey != "" {
		b.idemVouchers[idemKey] = voucher.Clone()
	}
	return voucher.Clone(), nil
}
