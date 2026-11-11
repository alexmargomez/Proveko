package domain

import "context"

type Repository interface {
	GetState(ctx context.Context, dbName string) (GastroState, error)
	CreateTable(ctx context.Context, dbName, idemKey string, in CreateTableInput) (DiningTable, error)
	CreateMenuItem(ctx context.Context, dbName, idemKey string, in CreateMenuItemInput) (MenuItem, error)
	AddItemToTable(ctx context.Context, dbName, idemKey, tableID string, in AddOrderItemInput) (DiningTable, error)
	RemoveItemFromTable(ctx context.Context, dbName, tableID, itemID string) (DiningTable, error)
	SendToKitchen(ctx context.Context, dbName, tableID string) (DiningTable, error)
	MarkReady(ctx context.Context, dbName, tableID string) (DiningTable, error)
	ClearInvoicedTable(ctx context.Context, dbName, idemKey, tableID, invoiceNumber string) (bool, error)
}
