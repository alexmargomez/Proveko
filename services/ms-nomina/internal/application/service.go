package application

import (
	"context"
	"strings"

	"ms-nomina/internal/platform/apperr"
	"ms-nomina/internal/platform/authguard"
	"ms-nomina/internal/platform/licensegate"
	"ms-nomina/internal/domain"
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
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyPayroll); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateEmployee(ctx context.Context, in domain.CreateEmployeeInput) (*domain.Employee, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyPayroll); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateEmployee(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreatePayroll(ctx context.Context, in domain.CreatePayrollInput) (*domain.PayrollSettlement, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyPayroll); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if in.ResolvedEmployeeID() == "" {
		return nil, apperr.Validation("Debes seleccionar un colaborador para liquidar la nómina")
	}
	if strings.TrimSpace(in.Period) == "" {
		return nil, apperr.Validation("El periodo de liquidación es obligatorio")
	}
	if _, _, _, _, err := domain.ValidatePayrollAmounts(in.BaseSalary, in.Bonuses, in.Deductions); err != nil {
		return nil, err
	}
	return s.repo.CreatePayroll(ctx, tc.DBName, tc.IdempotencyKey, in)
}
