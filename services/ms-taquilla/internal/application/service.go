package application

import (
	"context"
	"strings"

	"ms-taquilla/internal/platform/apperr"
	"ms-taquilla/internal/platform/authguard"
	"ms-taquilla/internal/platform/licensegate"
	"ms-taquilla/internal/domain"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func requireDBName(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return tc, apperr.Unauthorized("Contexto de base de datos de tenant no disponible")
	}
	return tc, nil
}

func (s *Service) GetAll(ctx context.Context) (*domain.AllState, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyTickets); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateEvent(ctx context.Context, in domain.CreateEventInput) (*domain.TicketingEvent, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyTickets); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateEvent(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateTicket(ctx context.Context, in domain.CreateTicketInput) (*domain.Ticket, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyTickets); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := domain.ValidateTicketQty(in.Qty); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.EventID) == "" && strings.TrimSpace(in.EventName) == "" {
		return nil, apperr.Validation("Debes seleccionar un evento o ingresar el nombre de la función")
	}
	return s.repo.CreateTicket(ctx, tc.DBName, tc.IdempotencyKey, in)
}
