package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-facturacion/internal/platform/seqmem"
	"ms-facturacion/internal/domain"
)

const (
	baseInvoiceSeq = 9012
	baseQuoteSeq   = 3011
)

type tenantStore struct {
	invoices []domain.Invoice
	quotes   []domain.Quote
	idemKeys map[string]string
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

func (r *Repository) ensureTenantLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	seedInvoices, seedQuotes := domain.DefaultSeedData(time.Now())
	st := &tenantStore{
		invoices: seedInvoices,
		quotes:   seedQuotes,
		idemKeys: make(map[string]string),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) PeekSequences(_ context.Context, dbName string) (string, string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	nextInv := r.seq.Peek(dbName, "FEVP", baseInvoiceSeq)
	nextQuote := r.seq.Peek(dbName, "COT", baseQuoteSeq)
	return nextInv, nextQuote, nil
}

func (r *Repository) ReserveInvoiceNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	return r.seq.Next(dbName, "FEVP", baseInvoiceSeq), nil
}

func (r *Repository) ReserveQuoteNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	return r.seq.Next(dbName, "COT", baseQuoteSeq), nil
}

func (r *Repository) FindInvoiceByIdempotencyKey(_ context.Context, dbName, idemKey string) (*domain.Invoice, error) {
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey == "" {
		return nil, nil
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	invID, ok := st.idemKeys[cleanKey]
	if !ok {
		return nil, nil
	}
	for _, inv := range st.invoices {
		if inv.ID == invID {
			cp := inv.Clone()
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *Repository) SaveInvoice(_ context.Context, dbName string, inv domain.Invoice, idemKey string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	cp := inv.Clone()
	replaced := false
	for i := range st.invoices {
		if st.invoices[i].ID == cp.ID {
			st.invoices[i] = cp
			replaced = true
			break
		}
	}
	if !replaced {
		st.invoices = append([]domain.Invoice{cp}, st.invoices...)
	}

	if cleanKey := strings.TrimSpace(idemKey); cleanKey != "" {
		st.idemKeys[cleanKey] = cp.ID
	}
	return nil
}

func (r *Repository) ListInvoices(_ context.Context, dbName string) ([]domain.Invoice, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	out := make([]domain.Invoice, len(st.invoices))
	for i, inv := range st.invoices {
		out[i] = inv.Clone()
	}
	return out, nil
}

func (r *Repository) CreateQuote(_ context.Context, dbName string, quote domain.Quote) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	cp := quote.Clone()
	st.quotes = append([]domain.Quote{cp}, st.quotes...)
	return nil
}

func (r *Repository) ListQuotes(_ context.Context, dbName string) ([]domain.Quote, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	out := make([]domain.Quote, len(st.quotes))
	for i, q := range st.quotes {
		out[i] = q.Clone()
	}
	return out, nil
}

func (r *Repository) GetSummary(_ context.Context, dbName string) (domain.SalesSummary, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	return domain.ComputeSummary(st.invoices, len(st.quotes)), nil
}
