package memory

import (
	"context"
	"sync"
	"time"

	"ms-reportes/internal/platform/seqmem"
	"ms-reportes/internal/domain"
)

type tenantBucket struct {
	snapshots     []*domain.ExecutiveSnapshot
	idemSnapshots map[string]*domain.ExecutiveSnapshot
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
	rptCode1 := r.seq.Next(dbName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)

	b := &tenantBucket{
		snapshots: []*domain.ExecutiveSnapshot{
			{
				ID:                      rptCode1,
				Code:                    rptCode1,
				TotalSales:              6450000,
				TotalCollected:          5120000,
				TotalPendingReceivables: 1330000,
				TotalExpenses:           1480000,
				NetOperatingProfit:      4970000,
				InventoryCostValue:      8920000,
				InventorySaleValue:      13450000,
				LowStockCount:           2,
				CustomersCount:          4,
				Notes:                   "Corte ejecutivo inicial de referencia",
				CreatedBy:               "gerencia",
				CreatedAt:               now,
			},
		},
		idemSnapshots: make(map[string]*domain.ExecutiveSnapshot),
	}
	r.buckets[dbName] = b
	return b
}

func (r *Repository) ListSnapshots(_ context.Context, dbName string) (*domain.SnapshotsState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	snapshots := make([]*domain.ExecutiveSnapshot, len(b.snapshots))
	for i, snap := range b.snapshots {
		snapshots[i] = snap.Clone()
	}
	nextCode := r.seq.Peek(dbName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)

	return &domain.SnapshotsState{
		NextCode:         nextCode,
		NextSnapshotCode: nextCode,
		Snapshots:        snapshots,
	}, nil
}

func (r *Repository) CreateSnapshot(_ context.Context, dbName, idemKey, createdBy string, in domain.CreateSnapshotInput) (*domain.ExecutiveSnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemSnapshots[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewExecutiveSnapshot("TMP", createdBy, in, now); err != nil {
		return nil, err
	}

	code := r.seq.Next(dbName, domain.SnapshotSeqPrefix, domain.SnapshotSeqStart)
	snap, err := domain.NewExecutiveSnapshot(code, createdBy, in, now)
	if err != nil {
		return nil, err
	}

	b.snapshots = append([]*domain.ExecutiveSnapshot{snap.Clone()}, b.snapshots...)
	if idemKey != "" {
		b.idemSnapshots[idemKey] = snap.Clone()
	}
	return snap.Clone(), nil
}
