package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*InventoryState, error)
	CreateProduct(ctx context.Context, dbName, idemKey string, in CreateProductInput, actor string) (*Product, error)
	DeleteProduct(ctx context.Context, dbName, productID string) error
	AdjustProductDelta(ctx context.Context, dbName, idemKey, productID string, in AdjustDeltaInput, actor string) (*Product, error)
	RestockProduct(ctx context.Context, dbName, idemKey, productID string, in RestockProductInput, actor string) (*Product, error)
	TransferProduct(ctx context.Context, dbName, idemKey, productID string, in TransferProductInput, actor string) (*Product, error)
	CreateWarehouse(ctx context.Context, dbName, idemKey string, in CreateWarehouseInput) (*Warehouse, error)
	CreateSupplyRequest(ctx context.Context, dbName, idemKey string, in CreateSupplyRequestInput, actor string) (*SupplyRequest, error)
	QuoteProducts(ctx context.Context, dbName string, productIDs []string) ([]ProductQuote, error)
	DeductStock(ctx context.Context, dbName, idemKey string, items []StockDeltaItem, defaultActor string) (int, error)
	RestockItems(ctx context.Context, dbName, idemKey string, items []StockDeltaItem, defaultActor string) (int, error)
}
