package domain

import (
	"strings"

	"ms-inventario/internal/platform/apperr"
	"ms-inventario/internal/platform/money"
)

const (
	SchemaName         = "inventory"
	ProductSeqPrefix   = "PRD"
	ProductSeqStart    = 1010
	WarehouseSeqPrefix = "BOD"
	WarehouseSeqStart  = 10
	KardexSeqPrefix    = "KDX"
	KardexSeqStart     = 8000
	RequestSeqPrefix   = "REQ"
	RequestSeqStart    = 500

	MovementSaldoInicial   = "SALDO INICIAL"
	MovementSalidaVenta    = "SALIDA VENTA"
	MovementEntradaCompra  = "ENTRADA COMPRA"
	MovementReversoSaga    = "REVERSO SAGA"
	MovementAjusteEntrada  = "AJUSTE ENTRADA"
	MovementAjusteSalida   = "AJUSTE SALIDA"
	MovementTrasladoBodega = "TRASLADO BODEGA"

	DefaultCategory      = "General"
	DefaultLocation      = "Bogotá D.C."
	DefaultRequestArea   = "Operaciones"
	DefaultRequestStatus = "Pendiente"
)

type Warehouse struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Location string `json:"location"`
	Manager  string `json:"manager"`
}

func (w *Warehouse) Clone() *Warehouse {
	if w == nil {
		return nil
	}
	cp := *w
	return &cp
}

type Product struct {
	ID            string  `json:"id"`
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	Category      string  `json:"category"`
	WarehouseID   string  `json:"warehouseId"`
	WarehouseName string  `json:"warehouseName"`
	SupplierID    string  `json:"supplierId"`
	SupplierName  string  `json:"supplierName"`
	CostPrice     float64 `json:"costPrice"`
	SalePrice     float64 `json:"salePrice"`
	TaxPct        float64 `json:"taxPct"`
	Stock         float64 `json:"stock"`
	MinStock      float64 `json:"minStock"`
	LotCode       string  `json:"lotCode"`
	ExpiryDate    string  `json:"expiryDate"`
}

func (p *Product) Clone() *Product {
	if p == nil {
		return nil
	}
	cp := *p
	return &cp
}

type KardexMovement struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	Type          string  `json:"type"`
	ProductID     string  `json:"productId"`
	ProductCode   string  `json:"productCode"`
	ProductName   string  `json:"productName"`
	WarehouseID   string  `json:"warehouseId,omitempty"`
	WarehouseName string  `json:"warehouseName"`
	Qty           float64 `json:"qty"`
	UnitCost      float64 `json:"unitCost"`
	BalanceAfter  float64 `json:"balanceAfter"`
	Reference     string  `json:"reference"`
	Actor         string  `json:"actor,omitempty"`
}

func (k *KardexMovement) Clone() *KardexMovement {
	if k == nil {
		return nil
	}
	cp := *k
	return &cp
}

type SupplyRequest struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Date        string  `json:"date"`
	Area        string  `json:"area"`
	ProductID   string  `json:"productId"`
	ProductName string  `json:"productName"`
	Qty         float64 `json:"qty"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes"`
}

func (r *SupplyRequest) Clone() *SupplyRequest {
	if r == nil {
		return nil
	}
	cp := *r
	return &cp
}

type ProductQuote struct {
	ProductID      string  `json:"productId"`
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	SalePrice      float64 `json:"salePrice"`
	TaxPct         float64 `json:"taxPct"`
	AvailableStock float64 `json:"availableStock"`
}

type StockDeltaItem struct {
	ProductID    string  `json:"productId"`
	Quantity     float64 `json:"quantity"`
	UnitCost     float64 `json:"unitCost"`
	WarehouseID  string  `json:"warehouseId"`
	MovementType string  `json:"movementType"`
	ReferenceDoc string  `json:"referenceDoc"`
	Actor        string  `json:"actor"`
}

type InventoryState struct {
	NextProductCode   string            `json:"nextProductCode"`
	NextWarehouseCode string            `json:"nextWarehouseCode"`
	NextRequestCode   string            `json:"nextRequestCode"`
	Products          []*Product        `json:"products"`
	Warehouses        []*Warehouse      `json:"warehouses"`
	Kardex            []*KardexMovement `json:"kardex"`
	Requests          []*SupplyRequest  `json:"requests"`
}

type CreateWarehouseInput struct {
	Name     string `json:"name"`
	Location string `json:"location"`
	City     string `json:"city"`
	Manager  string `json:"manager"`
}

func NewWarehouse(id, code string, in CreateWarehouseInput) (*Warehouse, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation("El nombre de la bodega es obligatorio")
	}
	loc := strings.TrimSpace(in.Location)
	if loc == "" {
		loc = strings.TrimSpace(in.City)
	}
	if loc == "" {
		loc = DefaultLocation
	}
	if strings.TrimSpace(id) == "" {
		id = money.NewID("wh")
	}
	return &Warehouse{
		ID:       id,
		Code:     strings.TrimSpace(code),
		Name:     name,
		Location: loc,
		Manager:  strings.TrimSpace(in.Manager),
	}, nil
}

type CreateProductInput struct {
	Name          string  `json:"name"`
	Category      string  `json:"category"`
	WarehouseID   string  `json:"warehouseId"`
	WarehouseName string  `json:"warehouseName"`
	SupplierID    string  `json:"supplierId"`
	SupplierName  string  `json:"supplierName"`
	CostPrice     float64 `json:"costPrice"`
	SalePrice     float64 `json:"salePrice"`
	TaxPct        float64 `json:"taxPct"`
	Stock         float64 `json:"stock"`
	MinStock      float64 `json:"minStock"`
	LotCode       string  `json:"lotCode"`
	ExpiryDate    string  `json:"expiryDate"`
}

func NewProduct(id, code string, wh *Warehouse, in CreateProductInput) (*Product, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation("El nombre del producto es obligatorio")
	}
	if wh == nil || strings.TrimSpace(wh.ID) == "" {
		return nil, apperr.Validation("Debe asociar el producto a una bodega válida")
	}
	if !money.IsFinite(in.CostPrice) || in.CostPrice < 0 {
		return nil, apperr.Validation("El costo unitario no puede ser negativo")
	}
	if !money.IsFinite(in.SalePrice) || in.SalePrice < 0 {
		return nil, apperr.Validation("El precio de venta no puede ser negativo")
	}
	if !money.IsFinite(in.TaxPct) || in.TaxPct < 0 || in.TaxPct > 100 {
		return nil, apperr.Validation("El porcentaje de impuesto debe estar entre 0 y 100")
	}
	if !money.IsFinite(in.Stock) || in.Stock < 0 {
		return nil, apperr.Validation("La existencia inicial no puede ser negativa")
	}
	if !money.IsFinite(in.MinStock) || in.MinStock < 0 {
		return nil, apperr.Validation("El stock mínimo no puede ser negativo")
	}

	cat := strings.TrimSpace(in.Category)
	if cat == "" {
		cat = DefaultCategory
	}
	if strings.TrimSpace(id) == "" {
		id = money.NewID("prd")
	}

	return &Product{
		ID:            id,
		Code:          strings.TrimSpace(code),
		Name:          name,
		Category:      cat,
		WarehouseID:   wh.ID,
		WarehouseName: wh.Name,
		SupplierID:    strings.TrimSpace(in.SupplierID),
		SupplierName:  strings.TrimSpace(in.SupplierName),
		CostPrice:     money.RoundCents(in.CostPrice),
		SalePrice:     money.RoundCents(in.SalePrice),
		TaxPct:        money.RoundCents(in.TaxPct),
		Stock:         money.RoundCents(in.Stock),
		MinStock:      money.RoundCents(in.MinStock),
		LotCode:       strings.TrimSpace(in.LotCode),
		ExpiryDate:    strings.TrimSpace(in.ExpiryDate),
	}, nil
}

type AdjustDeltaInput struct {
	Delta     float64 `json:"delta"`
	Reference string  `json:"reference"`
}

func ApplyProductDelta(p *Product, delta float64) (string, float64, error) {
	if p == nil {
		return "", 0, apperr.NotFound("Producto no encontrado")
	}
	if !money.IsFinite(delta) {
		return "", 0, apperr.Validation("El ajuste de stock no es un número válido")
	}
	cleanDelta := money.RoundCents(delta)
	if cleanDelta == 0 {
		return "", 0, apperr.Validation("El ajuste de stock debe ser distinto de cero")
	}
	newStock := money.RoundCents(p.Stock + cleanDelta)
	if cleanDelta < 0 && newStock < 0 {
		return "", 0, apperr.Conflict("Stock insuficiente para ajuste de salida")
	}
	p.Stock = newStock
	if cleanDelta > 0 {
		return MovementAjusteEntrada, cleanDelta, nil
	}
	return MovementAjusteSalida, cleanDelta, nil
}

type RestockProductInput struct {
	Qty          float64 `json:"qty"`
	Quantity     float64 `json:"quantity"`
	UnitCost     float64 `json:"unitCost"`
	LotCode      string  `json:"lotCode"`
	ExpiryDate   string  `json:"expiryDate"`
	MovementType string  `json:"movementType"`
	Reference    string  `json:"reference"`
}

func (in RestockProductInput) EffectiveQty() float64 {
	if in.Qty != 0 {
		return in.Qty
	}
	return in.Quantity
}

func NormalizeRestockMovementType(raw string) string {
	upper := strings.ToUpper(strings.TrimSpace(raw))
	upper = strings.ReplaceAll(upper, "_", " ")
	if strings.Contains(upper, "SAGA") || strings.Contains(upper, "REVERSO") || strings.Contains(upper, "COMPENS") {
		return MovementReversoSaga
	}
	return MovementEntradaCompra
}

func ApplyProductRestock(p *Product, qty, unitCost float64, lotCode, expiryDate string) (float64, float64, error) {
	if p == nil {
		return 0, 0, apperr.NotFound("Producto no encontrado")
	}
	if !money.IsFinite(qty) || qty <= 0 {
		return 0, 0, apperr.Validation("La cantidad a ingresar debe ser mayor a cero")
	}
	inQty := money.RoundCents(qty)
	if inQty <= 0 {
		return 0, 0, apperr.Validation("La cantidad a ingresar debe ser mayor a cero")
	}
	if !money.IsFinite(unitCost) || unitCost < 0 {
		return 0, 0, apperr.Validation("El costo unitario no puede ser negativo")
	}
	inCost := money.RoundCents(unitCost)

	effectiveUnitCost := p.CostPrice
	if inCost > 0 {
		p.CostPrice = money.WeightedAverageCost(p.Stock, p.CostPrice, inQty, inCost)
		effectiveUnitCost = inCost
	}
	p.Stock = money.RoundCents(p.Stock + inQty)

	if cleanLot := strings.TrimSpace(lotCode); cleanLot != "" {
		p.LotCode = cleanLot
	}
	if cleanExp := strings.TrimSpace(expiryDate); cleanExp != "" {
		p.ExpiryDate = cleanExp
	}
	return inQty, effectiveUnitCost, nil
}

type TransferProductInput struct {
	TargetWarehouseID string  `json:"targetWarehouseId"`
	ToWarehouseID     string  `json:"toWarehouseId"`
	Qty               float64 `json:"qty"`
	Quantity          float64 `json:"quantity"`
	Note              string  `json:"note"`
	Notes             string  `json:"notes"`
}

func (in TransferProductInput) EffectiveTargetWarehouseID() string {
	if v := strings.TrimSpace(in.TargetWarehouseID); v != "" {
		return v
	}
	return strings.TrimSpace(in.ToWarehouseID)
}

func (in TransferProductInput) EffectiveQty() float64 {
	if in.Qty != 0 {
		return in.Qty
	}
	return in.Quantity
}

func (in TransferProductInput) EffectiveNote() string {
	if v := strings.TrimSpace(in.Note); v != "" {
		return v
	}
	return strings.TrimSpace(in.Notes)
}

func ValidateTransferRequest(src *Product, targetWh *Warehouse, rawQty float64) (float64, error) {
	if src == nil {
		return 0, apperr.NotFound("Producto origen no encontrado")
	}
	if targetWh == nil || strings.TrimSpace(targetWh.ID) == "" {
		return 0, apperr.NotFound("Bodega destino no encontrada")
	}
	if src.WarehouseID == targetWh.ID {
		return 0, apperr.Validation("La bodega destino debe ser diferente a la bodega de origen")
	}
	if !money.IsFinite(rawQty) || rawQty <= 0 {
		return 0, apperr.Validation("La cantidad a trasladar debe ser mayor a cero")
	}
	qty := money.RoundCents(rawQty)
	if qty <= 0 {
		return 0, apperr.Validation("La cantidad a trasladar debe ser mayor a cero")
	}
	if money.RoundCents(src.Stock-qty) < 0 {
		return 0, apperr.Conflict("Stock insuficiente para trasladar " + src.Name)
	}
	return qty, nil
}

type CreateSupplyRequestInput struct {
	Area        string  `json:"area"`
	Requester   string  `json:"requester"`
	ProductID   string  `json:"productId"`
	ProductName string  `json:"productName"`
	Qty         float64 `json:"qty"`
	Status      string  `json:"status"`
	Notes       string  `json:"notes"`
}

func NewSupplyRequest(id, code, date string, in CreateSupplyRequestInput, resolvedProductName string) (*SupplyRequest, error) {
	prodName := strings.TrimSpace(resolvedProductName)
	if prodName == "" {
		prodName = strings.TrimSpace(in.ProductName)
	}
	if prodName == "" {
		return nil, apperr.Validation("Debe seleccionar o especificar el insumo solicitado")
	}
	if !money.IsFinite(in.Qty) || in.Qty <= 0 {
		return nil, apperr.Validation("La cantidad solicitada debe ser mayor a cero")
	}
	qty := money.RoundCents(in.Qty)
	if qty <= 0 {
		return nil, apperr.Validation("La cantidad solicitada debe ser mayor a cero")
	}
	area := strings.TrimSpace(in.Area)
	if area == "" {
		area = strings.TrimSpace(in.Requester)
	}
	if area == "" {
		area = DefaultRequestArea
	}
	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = DefaultRequestStatus
	}
	if strings.TrimSpace(id) == "" {
		id = money.NewID("req")
	}
	return &SupplyRequest{
		ID:          id,
		Code:        strings.TrimSpace(code),
		Date:        date,
		Area:        area,
		ProductID:   strings.TrimSpace(in.ProductID),
		ProductName: prodName,
		Qty:         qty,
		Status:      status,
		Notes:       strings.TrimSpace(in.Notes),
	}, nil
}

func ValidateDeductItems(items []StockDeltaItem) ([]StockDeltaItem, map[string]float64, error) {
	if len(items) == 0 {
		return nil, nil, apperr.Validation("Debe indicar al menos un producto para descontar inventario")
	}
	normalized := make([]StockDeltaItem, 0, len(items))
	required := make(map[string]float64, len(items))

	for _, raw := range items {
		pid := strings.TrimSpace(raw.ProductID)
		if pid == "" {
			return nil, nil, apperr.Validation("El identificador del producto es obligatorio")
		}
		if !money.IsFinite(raw.Quantity) || raw.Quantity <= 0 {
			return nil, nil, apperr.Validation("La cantidad a descontar debe ser un número finito mayor a cero")
		}
		qty := money.RoundCents(raw.Quantity)
		if qty <= 0 {
			return nil, nil, apperr.Validation("La cantidad a descontar debe ser mayor a cero")
		}
		required[pid] = money.RoundCents(required[pid] + qty)
		normalized = append(normalized, StockDeltaItem{
			ProductID:    pid,
			Quantity:     qty,
			UnitCost:     raw.UnitCost,
			WarehouseID:  strings.TrimSpace(raw.WarehouseID),
			MovementType: MovementSalidaVenta,
			ReferenceDoc: strings.TrimSpace(raw.ReferenceDoc),
			Actor:        strings.TrimSpace(raw.Actor),
		})
	}
	return normalized, required, nil
}

func ValidateRestockItems(items []StockDeltaItem) ([]StockDeltaItem, error) {
	if len(items) == 0 {
		return nil, apperr.Validation("Debe indicar al menos un producto para reabastecer inventario")
	}
	normalized := make([]StockDeltaItem, 0, len(items))
	for _, raw := range items {
		pid := strings.TrimSpace(raw.ProductID)
		if pid == "" {
			return nil, apperr.Validation("El identificador del producto es obligatorio")
		}
		if !money.IsFinite(raw.Quantity) || raw.Quantity <= 0 {
			return nil, apperr.Validation("La cantidad a ingresar debe ser un número finito mayor a cero")
		}
		qty := money.RoundCents(raw.Quantity)
		if qty <= 0 {
			return nil, apperr.Validation("La cantidad a ingresar debe ser mayor a cero")
		}
		if !money.IsFinite(raw.UnitCost) || raw.UnitCost < 0 {
			return nil, apperr.Validation("El costo unitario no puede ser negativo")
		}
		normalized = append(normalized, StockDeltaItem{
			ProductID:    pid,
			Quantity:     qty,
			UnitCost:     money.RoundCents(raw.UnitCost),
			WarehouseID:  strings.TrimSpace(raw.WarehouseID),
			MovementType: NormalizeRestockMovementType(raw.MovementType),
			ReferenceDoc: strings.TrimSpace(raw.ReferenceDoc),
			Actor:        strings.TrimSpace(raw.Actor),
		})
	}
	return normalized, nil
}
