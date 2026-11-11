package domain

import "context"

type InventoryRestockInput struct {
	IdempotencyKey string
	ProductID      string
	Quantity       float64
	UnitCost       float64
	WarehouseID    string
	ReferenceDoc   string
	Actor          string
}

type InventoryRestockPort interface {
	RestockItem(ctx context.Context, in InventoryRestockInput) error
}

type InventoryCompensator interface {
	CompensateRestock(ctx context.Context, in InventoryRestockInput) error
}

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*AllState, error)
	GetSupplierByID(ctx context.Context, dbName, supplierID string) (*Supplier, error)
	CreateSupplier(ctx context.Context, dbName, idemKey string, in CreateSupplierInput) (*Supplier, error)
	DeleteSupplier(ctx context.Context, dbName, supplierID string) error
	PeekNextOrderCode(ctx context.Context, dbName string) (string, error)
	FindIdempotentOrder(ctx context.Context, dbName, idemKey string) (*PurchaseOrder, error)
	CreateOrder(ctx context.Context, dbName, idemKey string, in CreateOrderInput, inventorySynced bool, actor string) (*PurchaseOrder, error)
}
