package domain

import "context"

type Repository interface {
	GetState(ctx context.Context, dbName string) (GastroState, error)
	CreateTable(ctx context.Context, dbName, idemKey string, in CreateTableInput) (DiningTable, error)
	UpdateTable(ctx context.Context, dbName, tableID string, in UpdateTableInput) (DiningTable, error)
	DeleteTable(ctx context.Context, dbName, tableID string) error
	CreateMenuItem(ctx context.Context, dbName, idemKey string, in CreateMenuItemInput) (MenuItem, error)
	UpdateMenuItem(ctx context.Context, dbName, itemID string, in UpdateMenuItemInput) (MenuItem, error)
	DeleteMenuItem(ctx context.Context, dbName, itemID string) error
	CreateWaiter(ctx context.Context, dbName, idemKey string, in CreateWaiterInput) (Waiter, error)
	UpdateWaiter(ctx context.Context, dbName, waiterID string, in UpdateWaiterInput) (Waiter, error)
	DeleteWaiter(ctx context.Context, dbName, waiterID string) error
	CreateOrder(ctx context.Context, dbName, idemKey string, in CreateOrderInput) (DiningTable, error)
	AddItemToTable(ctx context.Context, dbName, idemKey, tableID string, in AddOrderItemInput) (DiningTable, error)
	RemoveItemFromTable(ctx context.Context, dbName, tableID, itemID string) (DiningTable, error)
	SendToKitchen(ctx context.Context, dbName, tableID string) (DiningTable, error)
	MarkReady(ctx context.Context, dbName, tableID string) (DiningTable, error)
	AdvanceStage(ctx context.Context, dbName, tableID, stage string) (DiningTable, error)
	ClearInvoicedTable(ctx context.Context, dbName, idemKey, tableID, invoiceNumber string) (bool, error)
}
