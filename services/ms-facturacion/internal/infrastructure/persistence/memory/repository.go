package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/seqmem"
)

const (
	demoTenantDB    = "db_demo_empresa"
	baseInvoiceSeq  = 9012
	baseQuoteSeq    = 3011
	baseDraftInvSeq = 1000
	baseCreditSeq   = 1000
	baseDebitSeq    = 2000
	baseDraftNCSeq  = 100
	baseDraftNDSeq  = 200
)

func seqBasesForDB(dbName string) (invBase, quoteBase, draftInvBase, ncBase, ndBase int) {
	if strings.TrimSpace(dbName) == demoTenantDB {
		return baseInvoiceSeq, baseQuoteSeq, 1001, 1001, baseDebitSeq
	}
	return 0, 0, baseDraftInvSeq, baseCreditSeq, baseDebitSeq
}

type tenantStore struct {
	invoices          []domain.Invoice
	quotes            []domain.Quote
	notes             []domain.AdjustmentNote
	transmissions     map[string]domain.DianTransmission
	transmissionOrder []string
	idemKeys          map[string]string
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

func txKey(kind, id string) string {
	return strings.ToUpper(strings.TrimSpace(kind)) + "::" + strings.TrimSpace(id)
}

func (r *Repository) ensureTenantLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	invoices := []domain.Invoice{}
	quotes := []domain.Quote{}
	notes := []domain.AdjustmentNote{}
	txMap := make(map[string]domain.DianTransmission)
	txOrder := []string{}

	if strings.TrimSpace(dbName) == demoTenantDB {
		now := time.Now()
		invoices, quotes = domain.DefaultSeedData(now)
		seedNotes, seedTxs := domain.DefaultSeedFiscalData(now, invoices)
		notes = seedNotes
		for _, dt := range seedTxs {
			k := txKey(dt.DocumentKind, dt.DocumentID)
			txMap[k] = dt.Clone()
			txOrder = append(txOrder, k)
		}
	}

	st := &tenantStore{
		invoices:          invoices,
		quotes:            quotes,
		notes:             notes,
		transmissions:     txMap,
		transmissionOrder: txOrder,
		idemKeys:          make(map[string]string),
	}
	r.tenants[dbName] = st
	return st
}

func hydrateInvoiceFromStore(st *tenantStore, inv domain.Invoice) domain.Invoice {
	cp := inv.Clone()
	var dtPtr *domain.DianTransmission
	if dt, ok := st.transmissions[txKey(domain.DocKindInvoice, cp.ID)]; ok {
		dtCopy := dt.Clone()
		dtPtr = &dtCopy
	}
	domain.HydrateInvoiceState(&cp, dtPtr)
	return cp
}

func hydrateNoteFromStore(st *tenantStore, note domain.AdjustmentNote) domain.AdjustmentNote {
	cp := note.Clone()
	docKind := domain.DocumentKindForNoteKind(cp.NoteKind)
	var dtPtr *domain.DianTransmission
	if dt, ok := st.transmissions[txKey(docKind, cp.ID)]; ok {
		dtCopy := dt.Clone()
		dtPtr = &dtCopy
	}
	domain.HydrateAdjustmentNoteState(&cp, dtPtr)
	return cp
}

func (r *Repository) PeekSequences(_ context.Context, dbName string) (string, string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	invBase, quoteBase, _, _, _ := seqBasesForDB(dbName)
	nextInv := r.seq.Peek(dbName, "FEVP", invBase)
	nextQuote := r.seq.Peek(dbName, "COT", quoteBase)
	return nextInv, nextQuote, nil
}

func (r *Repository) PeekNoteSequences(_ context.Context, dbName string) (string, string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	_, _, _, ncBase, ndBase := seqBasesForDB(dbName)
	nextNC := r.seq.Peek(dbName, "NC", ncBase)
	nextND := r.seq.Peek(dbName, "ND", ndBase)
	return nextNC, nextND, nil
}

func (r *Repository) ReserveInvoiceNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	invBase, _, _, _, _ := seqBasesForDB(dbName)
	return r.seq.Next(dbName, "FEVP", invBase), nil
}

func (r *Repository) ReserveDraftInvoiceNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	_, _, draftInvBase, _, _ := seqBasesForDB(dbName)
	return r.seq.Next(dbName, "BOR", draftInvBase), nil
}

func (r *Repository) ReserveQuoteNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	_, quoteBase, _, _, _ := seqBasesForDB(dbName)
	return r.seq.Next(dbName, "COT", quoteBase), nil
}

func (r *Repository) ReserveCreditNoteNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	_, _, _, ncBase, _ := seqBasesForDB(dbName)
	return r.seq.Next(dbName, "NC", ncBase), nil
}

func (r *Repository) ReserveDebitNoteNumber(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	_, _, _, _, ndBase := seqBasesForDB(dbName)
	return r.seq.Next(dbName, "ND", ndBase), nil
}

func (r *Repository) ReserveDraftNoteNumber(_ context.Context, dbName string, noteKind string) (string, error) {
	r.mu.Lock()
	_ = r.ensureTenantLocked(dbName)
	r.mu.Unlock()

	if strings.EqualFold(strings.TrimSpace(noteKind), domain.NoteKindDebit) {
		return r.seq.Next(dbName, "BND", baseDraftNDSeq), nil
	}
	return r.seq.Next(dbName, "BNC", baseDraftNCSeq), nil
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
			cp := hydrateInvoiceFromStore(st, inv)
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *Repository) GetInvoiceByID(_ context.Context, dbName, id string) (*domain.Invoice, error) {
	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, nil
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	for _, inv := range st.invoices {
		if inv.ID == cleanID {
			cp := hydrateInvoiceFromStore(st, inv)
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

func (r *Repository) ReplaceInvoice(_ context.Context, dbName, oldID string, inv domain.Invoice) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	cp := inv.Clone()
	cleanOld := strings.TrimSpace(oldID)
	replaced := false

	for i := range st.invoices {
		if (cleanOld != "" && st.invoices[i].ID == cleanOld) || st.invoices[i].ID == cp.ID {
			st.invoices[i] = cp
			replaced = true
			break
		}
	}
	if !replaced {
		st.invoices = append([]domain.Invoice{cp}, st.invoices...)
	}

	if cleanOld != "" && cleanOld != cp.ID {
		oldTxKey := txKey(domain.DocKindInvoice, cleanOld)
		delete(st.transmissions, oldTxKey)
		filteredOrder := make([]string, 0, len(st.transmissionOrder))
		for _, k := range st.transmissionOrder {
			if k != oldTxKey {
				filteredOrder = append(filteredOrder, k)
			}
		}
		st.transmissionOrder = filteredOrder
		for k, v := range st.idemKeys {
			if v == cleanOld {
				st.idemKeys[k] = cp.ID
			}
		}
	}
	return nil
}

func (r *Repository) ListInvoices(_ context.Context, dbName string) ([]domain.Invoice, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	out := make([]domain.Invoice, len(st.invoices))
	for i, inv := range st.invoices {
		out[i] = hydrateInvoiceFromStore(st, inv)
	}
	return out, nil
}

func (r *Repository) GetAdjustmentNoteByID(_ context.Context, dbName, id string) (*domain.AdjustmentNote, error) {
	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, nil
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	for _, n := range st.notes {
		if n.ID == cleanID {
			cp := hydrateNoteFromStore(st, n)
			return &cp, nil
		}
	}
	return nil, nil
}

func (r *Repository) SaveAdjustmentNote(_ context.Context, dbName, oldID string, note domain.AdjustmentNote) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	cp := note.Clone()
	cleanOld := strings.TrimSpace(oldID)
	replaced := false
	for i := range st.notes {
		if (cleanOld != "" && st.notes[i].ID == cleanOld) || st.notes[i].ID == cp.ID {
			st.notes[i] = cp
			replaced = true
			break
		}
	}
	if !replaced {
		st.notes = append([]domain.AdjustmentNote{cp}, st.notes...)
	}

	if cleanOld != "" && cleanOld != cp.ID {
		docKind := domain.DocumentKindForNoteKind(cp.NoteKind)
		oldTxKey := txKey(docKind, cleanOld)
		delete(st.transmissions, oldTxKey)
		filteredOrder := make([]string, 0, len(st.transmissionOrder))
		for _, k := range st.transmissionOrder {
			if k != oldTxKey {
				filteredOrder = append(filteredOrder, k)
			}
		}
		st.transmissionOrder = filteredOrder
	}
	return nil
}

func (r *Repository) ListAdjustmentNotes(_ context.Context, dbName string) ([]domain.AdjustmentNote, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	out := make([]domain.AdjustmentNote, len(st.notes))
	for i, n := range st.notes {
		out[i] = hydrateNoteFromStore(st, n)
	}
	return out, nil
}

func (r *Repository) GetDianTransmission(_ context.Context, dbName, documentKind, documentID string) (*domain.DianTransmission, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	if dt, ok := st.transmissions[txKey(documentKind, documentID)]; ok {
		cp := dt.Clone()
		return &cp, nil
	}
	return nil, nil
}

func (r *Repository) UpsertDianTransmission(_ context.Context, dbName string, dt domain.DianTransmission) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	cp := dt.Clone()
	cp.DocumentKind = strings.ToUpper(strings.TrimSpace(cp.DocumentKind))
	cp.DocumentID = strings.TrimSpace(cp.DocumentID)
	if cp.Environment == "" {
		cp.Environment = "PRODUCCION"
	}
	k := txKey(cp.DocumentKind, cp.DocumentID)
	if _, exists := st.transmissions[k]; !exists {
		st.transmissionOrder = append([]string{k}, st.transmissionOrder...)
	}
	st.transmissions[k] = cp
	return nil
}

func (r *Repository) ListDianTransmissions(_ context.Context, dbName string) ([]domain.DianTransmission, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st := r.ensureTenantLocked(dbName)

	out := make([]domain.DianTransmission, 0, len(st.transmissions))
	for _, k := range st.transmissionOrder {
		if dt, ok := st.transmissions[k]; ok {
			out = append(out, dt.Clone())
		}
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
	invoices, err := r.ListInvoices(context.Background(), dbName)
	if err != nil {
		return domain.SalesSummary{}, err
	}
	r.mu.Lock()
	st := r.ensureTenantLocked(dbName)
	quoteCount := len(st.quotes)
	r.mu.Unlock()

	return domain.ComputeSummary(invoices, quoteCount), nil
}
