package application

import (
	"context"
	"strings"
	"time"

	"ms-caja/internal/platform/apperr"
	"ms-caja/internal/platform/authguard"
	"ms-caja/internal/platform/licensegate"
	"ms-caja/internal/domain"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func requireTenant(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return authguard.TenantContext{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	return tc, nil
}

func (s *Service) GetSummary(ctx context.Context) (domain.TreasurySummary, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.TreasurySummary{}, err
	}
	if !licensegate.HasModule(ctx, "arqueo_gastos") && !licensegate.HasModule(ctx, "bancos_tesoreria") {
		return domain.TreasurySummary{}, apperr.Forbidden("Ningún módulo de caja o tesorería está activo en la suscripción")
	}
	snap, err := s.repo.GetSnapshot(ctx, tc.DBName)
	if err != nil {
		return domain.TreasurySummary{}, err
	}
	return domain.ComputeSummary(snap), nil
}

func (s *Service) CreateIncome(ctx context.Context, in domain.CreateIncomeInput) (domain.CashIncome, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CashIncome{}, err
	}
	if err := licensegate.CheckModule(ctx, "arqueo_gastos"); err != nil {
		return domain.CashIncome{}, err
	}
	if _, err := domain.BuildCashIncome("ING-TMP", in, tc.Username, time.Now()); err != nil {
		return domain.CashIncome{}, err
	}
	return s.repo.CreateIncome(ctx, tc.DBName, tc.IdempotencyKey, in, tc.Username)
}

func (s *Service) CreateExpense(ctx context.Context, in domain.CreateExpenseInput) (domain.Expense, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Expense{}, err
	}
	if err := licensegate.CheckModule(ctx, "arqueo_gastos"); err != nil {
		return domain.Expense{}, err
	}
	if _, err := domain.BuildExpense("EGR-TMP", in, tc.Username, time.Now()); err != nil {
		return domain.Expense{}, err
	}
	return s.repo.CreateExpense(ctx, tc.DBName, tc.IdempotencyKey, in, tc.Username)
}

func (s *Service) DeleteExpense(ctx context.Context, expenseID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := licensegate.CheckModule(ctx, "arqueo_gastos"); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(expenseID)
	if cleanID == "" {
		return apperr.Validation("El identificador del gasto es obligatorio")
	}
	return s.repo.DeleteExpense(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateBankMovement(ctx context.Context, in domain.CreateBankMovementInput) (domain.BankMovement, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.BankMovement{}, err
	}
	if err := licensegate.CheckModule(ctx, "bancos_tesoreria"); err != nil {
		return domain.BankMovement{}, err
	}
	if _, err := domain.BuildBankMovement("BCO-TMP", in, tc.Username, time.Now()); err != nil {
		return domain.BankMovement{}, err
	}
	return s.repo.CreateBankMovement(ctx, tc.DBName, tc.IdempotencyKey, in, tc.Username)
}
