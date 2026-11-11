package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*AllState, error)
	CreateEvent(ctx context.Context, dbName, idemKey string, in CreateEventInput) (*TicketingEvent, error)
	CreateTicket(ctx context.Context, dbName, idemKey string, in CreateTicketInput) (*Ticket, error)
}
