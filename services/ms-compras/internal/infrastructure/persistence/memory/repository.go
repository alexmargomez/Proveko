package memory

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/money"
	"ms-compras/internal/platform/seqmem"
	"ms-compras/internal/domain"
)

type tenantBucket struct {
	suppliers   []*domain.Supplier
	orders      []*domain.PurchaseOrder
	idempotency map[string][]byte
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantBucket
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantBucket),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantBucket {
	if b, ok := r.tenants[dbName]; ok {
		return b
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	code1 := r.seq.Next(dbName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	code2 := r.seq.Next(dbName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	ordCode1 := r.seq.Next(dbName, domain.OrderSeqPrefix, domain.OrderSeqStart)

	s1 := &domain.Supplier{
		ID:        "sup-demo-1",
		Code:      code1,
		Nit:       "860.512.390-1",
		Name:      "Distribuidora Industrial Andina S.A.S.",
		City:      "Bogotá D.C.",
		Phone:     "6017428890",
		Email:     "ventas@industrialandina.co",
		CreatedAt: now,
	}
	s2 := &domain.Supplier{
		ID:        "sup-demo-2",
		Code:      code2,
		Nit:       "900.741.228-5",
		Name:      "Importadora Mayorista del Pacífico Ltda.",
		City:      "Cali",
		Phone:     "6024851120",
		Email:     "comercial@mayoristapacifico.co",
		CreatedAt: now,
	}
	o1 := &domain.PurchaseOrder{
		ID:              ordCode1,
		Code:            ordCode1,
		SupplierID:      s1.ID,
		SupplierCode:    s1.Code,
		SupplierName:    s1.Name,
		SupplierNit:     s1.Nit,
		ProductID:       "prd-demo-1",
		ProductCode:     "PRD-101",
		ProductName:     "Insumo Corporativo Estándar",
		WarehouseID:     "wh-demo-1",
		WarehouseName:   "Bodega Principal",
		Qty:             25,
		UnitCost:        18500,
		TotalCost:       462500,
		InventorySynced: false,
		Status:          domain.DefaultOrderStatus,
		CreatedBy:       "admin@empresa.co",
		CreatedAt:       now,
	}

	b := &tenantBucket{
		suppliers:   []*domain.Supplier{s1, s2},
		orders:      []*domain.PurchaseOrder{o1},
		idempotency: make(map[string][]byte),
	}
	r.tenants[dbName] = b
	return b
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.AllState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	suppliers := make([]*domain.Supplier, len(b.suppliers))
	for i, s := range b.suppliers {
		suppliers[i] = s.Clone()
	}
	orders := make([]*domain.PurchaseOrder, len(b.orders))
	for i, o := range b.orders {
		orders[i] = o.Clone()
	}

	return &domain.AllState{
		NextSupplierCode: r.seq.Peek(dbName, domain.SupplierSeqPrefix, domain.SupplierSeqStart),
		NextOrderCode:    r.seq.Peek(dbName, domain.OrderSeqPrefix, domain.OrderSeqStart),
		Suppliers:        suppliers,
		Orders:           orders,
	}, nil
}

func (r *Repository) GetSupplierByID(_ context.Context, dbName, supplierID string) (*domain.Supplier, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	for _, s := range b.suppliers {
		if s.ID == supplierID {
			return s.Clone(), nil
		}
	}
	return nil, apperr.NotFound("Proveedor no encontrado")
}

func (r *Repository) CreateSupplier(_ context.Context, dbName, idemKey string, in domain.CreateSupplierInput) (*domain.Supplier, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if raw, ok := b.idempotency["supplier:"+idemKey]; ok {
			var cached domain.Supplier
			if err := json.Unmarshal(raw, &cached); err == nil {
				return cached.Clone(), nil
			}
		}
	}

	normNit := strings.TrimSpace(in.Nit)
	for _, existing := range b.suppliers {
		if strings.EqualFold(existing.Nit, normNit) {
			return nil, apperr.Conflict("Ya existe un proveedor registrado con ese NIT")
		}
	}

	code := r.seq.Next(dbName, domain.SupplierSeqPrefix, domain.SupplierSeqStart)
	now := time.Now().UTC().Format("2006-01-02 15:04")
	sup, err := domain.NewSupplier(money.NewID("sup"), code, in, now)
	if err != nil {
		return nil, err
	}

	b.suppliers = append([]*domain.Supplier{sup}, b.suppliers...)
	if idemKey != "" {
		if raw, err := json.Marshal(sup); err == nil {
			b.idempotency["supplier:"+idemKey] = raw
		}
	}
	return sup.Clone(), nil
}

func (r *Repository) DeleteSupplier(_ context.Context, dbName, supplierID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	idx := -1
	for i, s := range b.suppliers {
		if s.ID == supplierID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return apperr.NotFound("Proveedor no encontrado")
	}
	for _, o := range b.orders {
		if o.SupplierID == supplierID {
			return apperr.Conflict("No es posible eliminar el proveedor porque registra órdenes de compra asociadas")
		}
	}
	b.suppliers = append(b.suppliers[:idx], b.suppliers[idx+1:]...)
	return nil
}

func (r *Repository) PeekNextOrderCode(_ context.Context, dbName string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.ensureSeededLocked(dbName)
	return r.seq.Peek(dbName, domain.OrderSeqPrefix, domain.OrderSeqStart), nil
}

func (r *Repository) FindIdempotentOrder(_ context.Context, dbName, idemKey string) (*domain.PurchaseOrder, error) {
	if idemKey == "" {
		return nil, nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	raw, ok := b.idempotency["order:"+idemKey]
	if !ok {
		return nil, nil
	}
	var cached domain.PurchaseOrder
	if err := json.Unmarshal(raw, &cached); err != nil {
		return nil, nil
	}
	return cached.Clone(), nil
}

func (r *Repository) CreateOrder(
	_ context.Context,
	dbName, idemKey string,
	in domain.CreateOrderInput,
	inventorySynced bool,
	actor string,
) (*domain.PurchaseOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if raw, ok := b.idempotency["order:"+idemKey]; ok {
			var cached domain.PurchaseOrder
			if err := json.Unmarshal(raw, &cached); err == nil {
				return cached.Clone(), nil
			}
		}
	}

	var sup *domain.Supplier
	for _, s := range b.suppliers {
		if s.ID == strings.TrimSpace(in.SupplierID) {
			sup = s
			break
		}
	}
	if sup == nil {
		return nil, apperr.NotFound("Proveedor no encontrado")
	}

	code := r.seq.Next(dbName, domain.OrderSeqPrefix, domain.OrderSeqStart)
	now := time.Now().UTC().Format("2006-01-02 15:04")
	ord, err := domain.NewPurchaseOrder(code, sup, in, inventorySynced, actor, now)
	if err != nil {
		return nil, err
	}

	b.orders = append([]*domain.PurchaseOrder{ord}, b.orders...)
	if idemKey != "" {
		if raw, err := json.Marshal(ord); err == nil {
			b.idempotency["order:"+idemKey] = raw
		}
	}
	return ord.Clone(), nil
}
