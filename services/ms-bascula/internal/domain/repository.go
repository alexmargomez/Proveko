package domain

import "context"

type Repository interface {
	GetState(ctx context.Context, dbName string) (ScaleState, error)
	CreateVehicle(ctx context.Context, dbName, idemKey string, in CreateHeavyVehicleInput) (HeavyVehicle, error)
	CreateDriver(ctx context.Context, dbName, idemKey string, in CreateDriverInput) (Driver, error)
	CreateCarrier(ctx context.Context, dbName, idemKey string, in CreateCarrierInput) (Carrier, error)
	CreateRoute(ctx context.Context, dbName, idemKey string, in CreateCargoRouteInput) (CargoRoute, error)
	CreateTicket(ctx context.Context, dbName, idemKey string, in CreateScaleTicketInput) (ScaleTicket, error)
}
