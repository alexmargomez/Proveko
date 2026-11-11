package domain

import (
	"strings"

	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/money"
)

const (
	SchemaName          = "procurement"
	SupplierSeqPrefix   = "PRV"
	SupplierSeqStart    = 200
	OrderSeqPrefix      = "OC"
	OrderSeqStart       = 800
	DefaultSupplierCity = "Bogotá D.C."
	DefaultWarehouse    = "Bodega Principal"
	DefaultOrderStatus  = "Recibida en Bodega"
)

type Supplier struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Nit       string `json:"nit"`
	Name      string `json:"name"`
	City      string `json:"city"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	CreatedAt string `json:"createdAt"`
}

func (s *Supplier) Clone() *Supplier {
	if s == nil {
		return nil
	}
	cp := *s
	return &cp
}

type CreateSupplierInput struct {
	Nit   string `json:"nit"`
	Name  string `json:"name"`
	City  string `json:"city"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

func NewSupplier(id, code string, in CreateSupplierInput, createdAt string) (*Supplier, error) {
	nit := strings.TrimSpace(in.Nit)
	name := strings.TrimSpace(in.Name)
	city := strings.TrimSpace(in.City)
	phone := strings.TrimSpace(in.Phone)
	email := strings.ToLower(strings.TrimSpace(in.Email))

	if nit == "" || name == "" {
		return nil, apperr.Validation("El NIT y la razón social del proveedor son obligatorios")
	}
	if city == "" {
		city = DefaultSupplierCity
	}
	if strings.TrimSpace(id) == "" {
		id = money.NewID("sup")
	}
	return &Supplier{
		ID:        id,
		Code:      strings.TrimSpace(code),
		Nit:       nit,
		Name:      name,
		City:      city,
		Phone:     phone,
		Email:     email,
		CreatedAt: createdAt,
	}, nil
}

type PurchaseOrder struct {
	ID              string  `json:"id"`
	Code            string  `json:"code"`
	SupplierID      string  `json:"supplierId"`
	SupplierCode    string  `json:"supplierCode"`
	SupplierName    string  `json:"supplierName"`
	SupplierNit     string  `json:"supplierNit"`
	ProductID       string  `json:"productId"`
	ProductCode     string  `json:"productCode"`
	ProductName     string  `json:"productName"`
	WarehouseID     string  `json:"warehouseId"`
	WarehouseName   string  `json:"warehouseName"`
	Qty             float64 `json:"qty"`
	UnitCost        float64 `json:"unitCost"`
	TotalCost       float64 `json:"totalCost"`
	InventorySynced bool    `json:"inventorySynced"`
	Status          string  `json:"status"`
	CreatedBy       string  `json:"createdBy"`
	CreatedAt       string  `json:"createdAt"`
}

func (o *PurchaseOrder) Clone() *PurchaseOrder {
	if o == nil {
		return nil
	}
	cp := *o
	return &cp
}

type CreateOrderInput struct {
	SupplierID    string  `json:"supplierId"`
	ProductID     string  `json:"productId"`
	ProductCode   string  `json:"productCode"`
	ProductName   string  `json:"productName"`
	WarehouseID   string  `json:"warehouseId"`
	WarehouseName string  `json:"warehouseName"`
	Qty           float64 `json:"qty"`
	UnitCost      float64 `json:"unitCost"`
}

func NewPurchaseOrder(
	code string,
	supplier *Supplier,
	in CreateOrderInput,
	inventorySynced bool,
	actor string,
	createdAt string,
) (*PurchaseOrder, error) {
	if supplier == nil || strings.TrimSpace(supplier.ID) == "" {
		return nil, apperr.Validation("Selecciona un proveedor válido para emitir la orden de compra")
	}
	if !money.IsFinite(in.Qty) || in.Qty <= 0 {
		return nil, apperr.Validation("La cantidad de mercancía a ingresar debe ser mayor a cero")
	}
	if !money.IsFinite(in.UnitCost) || in.UnitCost <= 0 {
		return nil, apperr.Validation("El costo unitario de compra debe ser mayor a cero")
	}

	productID := strings.TrimSpace(in.ProductID)
	productCode := strings.TrimSpace(in.ProductCode)
	productName := strings.TrimSpace(in.ProductName)
	if productName == "" && productID != "" {
		productName = productID
	}
	if productName == "" {
		return nil, apperr.Validation("Indica el producto o la descripción del insumo a comprar")
	}
	if productCode == "" && productID != "" {
		productCode = productID
	}

	warehouseID := strings.TrimSpace(in.WarehouseID)
	warehouseName := strings.TrimSpace(in.WarehouseName)
	if warehouseName == "" {
		if warehouseID != "" {
			warehouseName = warehouseID
		} else {
			warehouseName = DefaultWarehouse
		}
	}

	qty := money.RoundCents(in.Qty)
	unitCost := money.RoundCents(in.UnitCost)
	totalCost := money.RoundCents(qty * unitCost)
	if totalCost <= 0 {
		return nil, apperr.Validation("El total de la orden de compra debe ser mayor a cero")
	}

	cleanCode := strings.TrimSpace(code)
	cleanActor := strings.TrimSpace(actor)
	if cleanActor == "" {
		cleanActor = "sistema"
	}

	return &PurchaseOrder{
		ID:              cleanCode,
		Code:            cleanCode,
		SupplierID:      supplier.ID,
		SupplierCode:    supplier.Code,
		SupplierName:    supplier.Name,
		SupplierNit:     supplier.Nit,
		ProductID:       productID,
		ProductCode:     productCode,
		ProductName:     productName,
		WarehouseID:     warehouseID,
		WarehouseName:   warehouseName,
		Qty:             qty,
		UnitCost:        unitCost,
		TotalCost:       totalCost,
		InventorySynced: inventorySynced,
		Status:          DefaultOrderStatus,
		CreatedBy:       cleanActor,
		CreatedAt:       createdAt,
	}, nil
}

type AllState struct {
	NextSupplierCode string           `json:"nextSupplierCode"`
	NextOrderCode    string           `json:"nextOrderCode"`
	Suppliers        []*Supplier      `json:"suppliers"`
	Orders           []*PurchaseOrder `json:"orders"`
}
