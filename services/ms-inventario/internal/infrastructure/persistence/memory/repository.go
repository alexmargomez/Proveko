package memory

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"ms-inventario/internal/platform/apperr"
	"ms-inventario/internal/platform/money"
	"ms-inventario/internal/platform/seqmem"
	"ms-inventario/internal/domain"
)

type tenantStore struct {
	warehouses []*domain.Warehouse
	products   []*domain.Product
	kardex     []*domain.KardexMovement
	requests   []*domain.SupplyRequest
	idem       map[string][]byte
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantStore
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantStore),
	}
}

func nowDateStr() string {
	return time.Now().Format("2006-01-02 15:04")
}

func (r *Repository) ensureTenantLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	wh1Code := r.seq.Next(dbName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	wh2Code := r.seq.Next(dbName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	p1Code := r.seq.Next(dbName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	p2Code := r.seq.Next(dbName, domain.ProductSeqPrefix, domain.ProductSeqStart)

	wh1 := &domain.Warehouse{
		ID:       "wh-principal",
		Code:     wh1Code,
		Name:     "Bodega Central Principal",
		Location: "Sede Principal",
		Manager:  "Coordinación Logística",
	}
	wh2 := &domain.Warehouse{
		ID:       "wh-auxiliar",
		Code:     wh2Code,
		Name:     "Bodega Punto de Venta",
		Location: "Mostrador Comercial",
		Manager:  "Jefatura de Sala",
	}
	p1 := &domain.Product{
		ID:            "prd-seed-1",
		Code:          p1Code,
		Name:          "Kit Mantenimiento Preventivo",
		Category:      "Repuestos e Insumos",
		WarehouseID:   wh1.ID,
		WarehouseName: wh1.Name,
		CostPrice:     42000,
		SalePrice:     68000,
		TaxPct:        19,
		Stock:         25,
		MinStock:      5,
		LotCode:       "LT-2026-A",
		ExpiryDate:    "2028-12-31",
	}
	p2 := &domain.Product{
		ID:            "prd-seed-2",
		Code:          p2Code,
		Name:          "Lubricante Sintético Multigrado 1L",
		Category:      "Lubricantes",
		WarehouseID:   wh1.ID,
		WarehouseName: wh1.Name,
		CostPrice:     28000,
		SalePrice:     45000,
		TaxPct:        19,
		Stock:         40,
		MinStock:      8,
		LotCode:       "LT-2026-B",
		ExpiryDate:    "2028-06-30",
	}
	now := nowDateStr()
	st := &tenantStore{
		warehouses: []*domain.Warehouse{wh1, wh2},
		products:   []*domain.Product{p1, p2},
		kardex: []*domain.KardexMovement{
			{
				ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
				Date:          now,
				Type:          domain.MovementSaldoInicial,
				ProductID:     p1.ID,
				ProductCode:   p1.Code,
				ProductName:   p1.Name,
				WarehouseID:   wh1.ID,
				WarehouseName: wh1.Name,
				Qty:           p1.Stock,
				UnitCost:      p1.CostPrice,
				BalanceAfter:  p1.Stock,
				Reference:     "APERTURA INVENTARIO",
				Actor:         "sistema",
			},
			{
				ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
				Date:          now,
				Type:          domain.MovementSaldoInicial,
				ProductID:     p2.ID,
				ProductCode:   p2.Code,
				ProductName:   p2.Name,
				WarehouseID:   wh1.ID,
				WarehouseName: wh1.Name,
				Qty:           p2.Stock,
				UnitCost:      p2.CostPrice,
				BalanceAfter:  p2.Stock,
				Reference:     "APERTURA INVENTARIO",
				Actor:         "sistema",
			},
		},
		requests: []*domain.SupplyRequest{},
		idem:     make(map[string][]byte),
	}
	r.tenants[dbName] = st
	return st
}

func saveIdem[T any](st *tenantStore, key string, val T) {
	if k := strings.TrimSpace(key); k != "" && !strings.HasSuffix(k, ":") {
		if b, err := json.Marshal(val); err == nil {
			st.idem[k] = b
		}
	}
}

func loadIdem[T any](st *tenantStore, key string) (T, bool) {
	var zero T
	k := strings.TrimSpace(key)
	if k == "" || strings.HasSuffix(k, ":") {
		return zero, false
	}
	raw, ok := st.idem[k]
	if !ok {
		return zero, false
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		return zero, false
	}
	return out, true
}

func prependKardex(st *tenantStore, m *domain.KardexMovement) {
	st.kardex = append([]*domain.KardexMovement{m}, st.kardex...)
}

func findWarehouse(st *tenantStore, id string) *domain.Warehouse {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" && len(st.warehouses) > 0 {
		return st.warehouses[0]
	}
	for _, w := range st.warehouses {
		if w.ID == trimmed || strings.EqualFold(w.Code, trimmed) {
			return w
		}
	}
	return nil
}

func findProduct(st *tenantStore, id string) (*domain.Product, int) {
	trimmed := strings.TrimSpace(id)
	for i, p := range st.products {
		if p.ID == trimmed {
			return p, i
		}
	}
	bestIdx := -1
	for i, p := range st.products {
		if strings.EqualFold(p.Code, trimmed) {
			if bestIdx < 0 || p.Stock > st.products[bestIdx].Stock {
				bestIdx = i
			}
		}
	}
	if bestIdx >= 0 {
		return st.products[bestIdx], bestIdx
	}
	return nil, -1
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.InventoryState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	prods := make([]*domain.Product, len(st.products))
	for i, p := range st.products {
		prods[i] = p.Clone()
	}
	whs := make([]*domain.Warehouse, len(st.warehouses))
	for i, w := range st.warehouses {
		whs[i] = w.Clone()
	}
	kdx := make([]*domain.KardexMovement, len(st.kardex))
	for i, k := range st.kardex {
		kdx[i] = k.Clone()
	}
	reqs := make([]*domain.SupplyRequest, len(st.requests))
	for i, rq := range st.requests {
		reqs[i] = rq.Clone()
	}

	return &domain.InventoryState{
		NextProductCode:   r.seq.Peek(dbName, domain.ProductSeqPrefix, domain.ProductSeqStart),
		NextWarehouseCode: r.seq.Peek(dbName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart),
		NextRequestCode:   r.seq.Peek(dbName, domain.RequestSeqPrefix, domain.RequestSeqStart),
		Products:          prods,
		Warehouses:        whs,
		Kardex:            kdx,
		Requests:          reqs,
	}, nil
}

func (r *Repository) CreateProduct(_ context.Context, dbName, idemKey string, in domain.CreateProductInput, actor string) (*domain.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.Product](st, "prod:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}

	wh := findWarehouse(st, in.WarehouseID)
	if wh == nil {
		return nil, apperr.Validation("Debe asociar el producto a una bodega válida")
	}
	code := r.seq.Next(dbName, domain.ProductSeqPrefix, domain.ProductSeqStart)
	prod, err := domain.NewProduct(money.NewID("prd"), code, wh, in)
	if err != nil {
		return nil, err
	}
	st.products = append([]*domain.Product{prod}, st.products...)

	if prod.Stock > 0 {
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          nowDateStr(),
			Type:          domain.MovementSaldoInicial,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   wh.ID,
			WarehouseName: wh.Name,
			Qty:           prod.Stock,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     "ALTA DE PRODUCTO",
			Actor:         actor,
		})
	}
	saveIdem(st, "prod:"+idemKey, prod)
	return prod.Clone(), nil
}

func (r *Repository) DeleteProduct(_ context.Context, dbName, productID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	_, idx := findProduct(st, productID)
	if idx < 0 {
		return apperr.NotFound("Producto no encontrado")
	}
	st.products = append(st.products[:idx], st.products[idx+1:]...)
	return nil
}

func (r *Repository) AdjustProductDelta(_ context.Context, dbName, idemKey, productID string, in domain.AdjustDeltaInput, actor string) (*domain.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.Product](st, "delta:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}
	prod, _ := findProduct(st, productID)
	movType, cleanDelta, err := domain.ApplyProductDelta(prod, in.Delta)
	if err != nil {
		return nil, err
	}
	qty := cleanDelta
	if qty < 0 {
		qty = -qty
	}
	ref := strings.TrimSpace(in.Reference)
	if ref == "" {
		ref = "AJUSTE MANUAL"
	}
	prependKardex(st, &domain.KardexMovement{
		ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
		Date:          nowDateStr(),
		Type:          movType,
		ProductID:     prod.ID,
		ProductCode:   prod.Code,
		ProductName:   prod.Name,
		WarehouseID:   prod.WarehouseID,
		WarehouseName: prod.WarehouseName,
		Qty:           qty,
		UnitCost:      prod.CostPrice,
		BalanceAfter:  prod.Stock,
		Reference:     ref,
		Actor:         actor,
	})
	saveIdem(st, "delta:"+idemKey, prod)
	return prod.Clone(), nil
}

func (r *Repository) RestockProduct(_ context.Context, dbName, idemKey, productID string, in domain.RestockProductInput, actor string) (*domain.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.Product](st, "restock-one:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}
	prod, _ := findProduct(st, productID)
	inQty, effCost, err := domain.ApplyProductRestock(prod, in.EffectiveQty(), in.UnitCost, in.LotCode, in.ExpiryDate)
	if err != nil {
		return nil, err
	}
	ref := strings.TrimSpace(in.Reference)
	if ref == "" {
		ref = "SURTIDO DIRECTO"
	}
	prependKardex(st, &domain.KardexMovement{
		ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
		Date:          nowDateStr(),
		Type:          domain.NormalizeRestockMovementType(in.MovementType),
		ProductID:     prod.ID,
		ProductCode:   prod.Code,
		ProductName:   prod.Name,
		WarehouseID:   prod.WarehouseID,
		WarehouseName: prod.WarehouseName,
		Qty:           inQty,
		UnitCost:      effCost,
		BalanceAfter:  prod.Stock,
		Reference:     ref,
		Actor:         actor,
	})
	saveIdem(st, "restock-one:"+idemKey, prod)
	return prod.Clone(), nil
}

func (r *Repository) TransferProduct(_ context.Context, dbName, idemKey, productID string, in domain.TransferProductInput, actor string) (*domain.Product, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.Product](st, "transfer:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}
	prod, _ := findProduct(st, productID)
	targetWh := findWarehouse(st, in.EffectiveTargetWarehouseID())
	qty, err := domain.ValidateTransferRequest(prod, targetWh, in.EffectiveQty())
	if err != nil {
		return nil, err
	}

	originID := prod.WarehouseID
	originName := prod.WarehouseName
	note := in.EffectiveNote()
	if note == "" {
		note = originName + " -> " + targetWh.Name
	}

	if money.RoundCents(prod.Stock-qty) == 0 {
		prod.WarehouseID = targetWh.ID
		prod.WarehouseName = targetWh.Name
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          nowDateStr(),
			Type:          domain.MovementTrasladoBodega,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   targetWh.ID,
			WarehouseName: targetWh.Name,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     note,
			Actor:         actor,
		})
	} else {
		prod.Stock = money.RoundCents(prod.Stock - qty)
		now := nowDateStr()
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          now,
			Type:          domain.MovementTrasladoBodega,
			ProductID:     prod.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   originID,
			WarehouseName: originName,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  prod.Stock,
			Reference:     note,
			Actor:         actor,
		})

		var destProd *domain.Product
		for _, p := range st.products {
			if strings.EqualFold(p.Code, prod.Code) && p.WarehouseID == targetWh.ID {
				destProd = p
				break
			}
		}
		if destProd != nil {
			destProd.Stock = money.RoundCents(destProd.Stock + qty)
		} else {
			destProd = prod.Clone()
			destProd.ID = money.NewID("prd")
			destProd.WarehouseID = targetWh.ID
			destProd.WarehouseName = targetWh.Name
			destProd.Stock = qty
			st.products = append([]*domain.Product{destProd}, st.products...)
		}
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          now,
			Type:          domain.MovementTrasladoBodega,
			ProductID:     destProd.ID,
			ProductCode:   prod.Code,
			ProductName:   prod.Name,
			WarehouseID:   targetWh.ID,
			WarehouseName: targetWh.Name,
			Qty:           qty,
			UnitCost:      prod.CostPrice,
			BalanceAfter:  destProd.Stock,
			Reference:     note,
			Actor:         actor,
		})
	}

	saveIdem(st, "transfer:"+idemKey, prod)
	return prod.Clone(), nil
}

func (r *Repository) CreateWarehouse(_ context.Context, dbName, idemKey string, in domain.CreateWarehouseInput) (*domain.Warehouse, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.Warehouse](st, "wh:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}
	code := r.seq.Next(dbName, domain.WarehouseSeqPrefix, domain.WarehouseSeqStart)
	wh, err := domain.NewWarehouse(money.NewID("wh"), code, in)
	if err != nil {
		return nil, err
	}
	st.warehouses = append(st.warehouses, wh)
	saveIdem(st, "wh:"+idemKey, wh)
	return wh.Clone(), nil
}

func (r *Repository) CreateSupplyRequest(_ context.Context, dbName, idemKey string, in domain.CreateSupplyRequestInput, _ string) (*domain.SupplyRequest, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cached, ok := loadIdem[*domain.SupplyRequest](st, "req:"+idemKey); ok && cached != nil {
		return cached.Clone(), nil
	}
	resolvedName := ""
	if p, _ := findProduct(st, in.ProductID); p != nil {
		resolvedName = p.Name
	}
	code := r.seq.Next(dbName, domain.RequestSeqPrefix, domain.RequestSeqStart)
	req, err := domain.NewSupplyRequest(money.NewID("req"), code, nowDateStr(), in, resolvedName)
	if err != nil {
		return nil, err
	}
	st.requests = append([]*domain.SupplyRequest{req}, st.requests...)
	saveIdem(st, "req:"+idemKey, req)
	return req.Clone(), nil
}

func (r *Repository) QuoteProducts(_ context.Context, dbName string, productIDs []string) ([]domain.ProductQuote, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	quotes := make([]domain.ProductQuote, 0, len(productIDs))
	for _, pid := range productIDs {
		p, _ := findProduct(st, pid)
		if p == nil {
			return nil, apperr.NotFound("Producto no encontrado en inventario: " + pid)
		}
		quotes = append(quotes, domain.ProductQuote{
			ProductID:      p.ID,
			Code:           p.Code,
			Name:           p.Name,
			SalePrice:      p.SalePrice,
			TaxPct:         p.TaxPct,
			AvailableStock: p.Stock,
		})
	}
	return quotes, nil
}

func (r *Repository) DeductStock(_ context.Context, dbName, idemKey string, items []domain.StockDeltaItem, defaultActor string) (int, error) {
	normalized, required, err := domain.ValidateDeductItems(items)
	if err != nil {
		return 0, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cnt, ok := loadIdem[int](st, "deduct:"+idemKey); ok {
		return cnt, nil
	}

	// Phase 1: atomic validation across ALL requested products before mutating any state
	for pid, neededQty := range required {
		p, _ := findProduct(st, pid)
		if p == nil {
			return 0, apperr.NotFound("Producto no encontrado: " + pid)
		}
		if money.RoundCents(p.Stock-neededQty) < 0 {
			return 0, apperr.Conflict("Stock insuficiente para " + p.Name)
		}
	}

	// Phase 2: apply deductions and record Kardex entries
	now := nowDateStr()
	for _, it := range normalized {
		p, _ := findProduct(st, it.ProductID)
		p.Stock = money.RoundCents(p.Stock - it.Quantity)
		actor := it.Actor
		if actor == "" {
			actor = defaultActor
		}
		ref := it.ReferenceDoc
		if ref == "" {
			ref = "VENTA POS"
		}
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          now,
			Type:          domain.MovementSalidaVenta,
			ProductID:     p.ID,
			ProductCode:   p.Code,
			ProductName:   p.Name,
			WarehouseID:   p.WarehouseID,
			WarehouseName: p.WarehouseName,
			Qty:           it.Quantity,
			UnitCost:      p.CostPrice,
			BalanceAfter:  p.Stock,
			Reference:     ref,
			Actor:         actor,
		})
	}
	saveIdem(st, "deduct:"+idemKey, len(normalized))
	return len(normalized), nil
}

func (r *Repository) RestockItems(_ context.Context, dbName, idemKey string, items []domain.StockDeltaItem, defaultActor string) (int, error) {
	normalized, err := domain.ValidateRestockItems(items)
	if err != nil {
		return 0, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	if cnt, ok := loadIdem[int](st, "restock-batch:"+idemKey); ok {
		return cnt, nil
	}

	for _, it := range normalized {
		if p, _ := findProduct(st, it.ProductID); p == nil {
			return 0, apperr.NotFound("Producto no encontrado: " + it.ProductID)
		}
	}

	now := nowDateStr()
	for _, it := range normalized {
		p, _ := findProduct(st, it.ProductID)
		inQty, effCost, applyErr := domain.ApplyProductRestock(p, it.Quantity, it.UnitCost, "", "")
		if applyErr != nil {
			return 0, applyErr
		}
		actor := it.Actor
		if actor == "" {
			actor = defaultActor
		}
		ref := it.ReferenceDoc
		if ref == "" {
			ref = "ENTRADA INVENTARIO"
		}
		prependKardex(st, &domain.KardexMovement{
			ID:            r.seq.Next(dbName, domain.KardexSeqPrefix, domain.KardexSeqStart),
			Date:          now,
			Type:          it.MovementType,
			ProductID:     p.ID,
			ProductCode:   p.Code,
			ProductName:   p.Name,
			WarehouseID:   p.WarehouseID,
			WarehouseName: p.WarehouseName,
			Qty:           inQty,
			UnitCost:      effCost,
			BalanceAfter:  p.Stock,
			Reference:     ref,
			Actor:         actor,
		})
	}
	saveIdem(st, "restock-batch:"+idemKey, len(normalized))
	return len(normalized), nil
}
