package application

import (
	"context"
	"strings"

	"ms-contabilidad/internal/platform/apperr"
	"ms-contabilidad/internal/platform/authguard"
	"ms-contabilidad/internal/platform/licensegate"
	"ms-contabilidad/internal/domain"
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
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyAccounting); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreatePucAccount(ctx context.Context, in domain.CreatePucAccountInput) (*domain.PucAccount, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyAccounting); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := domain.ValidatePucCode(in.Code); err != nil {
		return nil, err
	}
	return s.repo.CreatePucAccount(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateVoucher(ctx context.Context, in domain.CreateVoucherInput) (*domain.AccountingVoucher, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyAccounting); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if err := domain.ValidateVoucherBasics(in); err != nil {
		return nil, err
	}
	return s.repo.CreateVoucher(ctx, tc.DBName, tc.IdempotencyKey, in)
}
