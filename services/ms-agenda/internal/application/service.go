package application

import (
	"context"
	"strings"

	"ms-agenda/internal/platform/apperr"
	"ms-agenda/internal/platform/authguard"
	"ms-agenda/internal/platform/licensegate"
	"ms-agenda/internal/domain"
)

const ModuleCalendar = "calendario_citas"

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func authorize(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return tc, apperr.Unauthorized("Contexto de base de datos de empresa no disponible")
	}
	if err := licensegate.CheckModule(ctx, ModuleCalendar); err != nil {
		return tc, err
	}
	return tc, nil
}

func (s *Service) GetAll(ctx context.Context) (*domain.AllState, error) {
	tc, err := authorize(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateResource(ctx context.Context, in domain.CreateResourceInput) (*domain.ProfResource, error) {
	tc, err := authorize(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := domain.NewProfResource("tmp", "RES-0", in, ""); err != nil {
		return nil, err
	}
	return s.repo.CreateResource(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateAppointment(ctx context.Context, in domain.CreateAppointmentInput) (*domain.Appointment, error) {
	tc, err := authorize(ctx)
	if err != nil {
		return nil, err
	}
	if in.ResolvedResourceID() == "" {
		return nil, apperr.Validation("Selecciona un profesional o recurso para la cita")
	}
	if _, err := domain.NormalizeDateTime(in.DateTime); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.ServiceName) == "" {
		return nil, apperr.Validation("El motivo o servicio solicitado es obligatorio")
	}
	if strings.TrimSpace(in.CustomerName) == "" && strings.TrimSpace(in.CustomerID) == "" {
		return nil, apperr.Validation("Ingresa o selecciona el cliente o paciente")
	}
	return s.repo.CreateAppointment(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) DeleteAppointment(ctx context.Context, appointmentID string) error {
	tc, err := authorize(ctx)
	if err != nil {
		return err
	}
	cleanID := strings.TrimSpace(appointmentID)
	if cleanID == "" {
		return apperr.Validation("El identificador de la cita es obligatorio")
	}
	return s.repo.DeleteAppointment(ctx, tc.DBName, cleanID)
}
