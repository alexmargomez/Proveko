package domain

import "context"

type Repository interface {
	GetState(ctx context.Context, dbName string) (WorkshopState, error)
	CreateVehicle(ctx context.Context, dbName, idemKey string, in CreateVehicleInput) (Vehicle, error)
	DeleteVehicle(ctx context.Context, dbName, vehicleID string) error
	CreateWorkOrder(ctx context.Context, dbName, idemKey string, in CreateWorkOrderInput) (WorkOrder, error)
	AdvanceWorkOrderStage(ctx context.Context, dbName, orderID, requestedStatus string) (WorkOrder, error)
	CreateWorker(ctx context.Context, dbName, idemKey string, in CreateWorkerInput) (Worker, error)
	SettleWorker(ctx context.Context, dbName, idemKey, workerID string) (Settlement, error)
	RegisterInvoicedOrderAndCommission(ctx context.Context, dbName string, in InvoiceSyncInput) (InvoiceSyncResult, error)
}
