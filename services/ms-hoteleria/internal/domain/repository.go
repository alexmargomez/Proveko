package domain

import "context"

type Repository interface {
	GetState(ctx context.Context, dbName string) (HospitalityState, error)
	CreateRoom(ctx context.Context, dbName, idemKey string, in CreateRoomInput) (HotelRoom, error)
	CheckIn(ctx context.Context, dbName, idemKey string, in CheckInInput) (HotelRoom, error)
	AddExtraCharge(ctx context.Context, dbName, idemKey, roomID string, in ExtraChargeInput) (HotelRoom, error)
	CompleteRoomCheckout(ctx context.Context, dbName, idemKey, roomID, invoiceNumber string) (string, error)
}
