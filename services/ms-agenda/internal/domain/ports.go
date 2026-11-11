package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*AllState, error)
	CreateResource(ctx context.Context, dbName, idemKey string, in CreateResourceInput) (*ProfResource, error)
	CreateAppointment(ctx context.Context, dbName, idemKey string, in CreateAppointmentInput) (*Appointment, error)
	DeleteAppointment(ctx context.Context, dbName, appointmentID string) error
}
