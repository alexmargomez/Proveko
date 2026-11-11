package application

import (
	"context"
	"strings"

	"ms-reportes/internal/platform/apperr"
	"ms-reportes/internal/platform/authguard"
	"ms-reportes/internal/platform/licensegate"
	"ms-reportes/internal/domain"
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

func (s *Service) ListSnapshots(ctx context.Context) (*domain.SnapshotsState, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyReporting); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListSnapshots(ctx, tc.DBName)
}

func (s *Service) CreateSnapshot(ctx context.Context, in domain.CreateSnapshotInput) (*domain.ExecutiveSnapshot, error) {
	if err := licensegate.CheckModule(ctx, domain.ModuleKeyReporting); err != nil {
		return nil, err
	}
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := domain.NewExecutiveSnapshot("TMP", tc.Username, in, ""); err != nil {
		return nil, err
	}
	return s.repo.CreateSnapshot(ctx, tc.DBName, tc.IdempotencyKey, tc.Username, in)
}

func (s *Service) GetExecutiveReport(ctx context.Context) (*domain.ExecutiveReport, error) {
	state, err := s.ListSnapshots(ctx)
	if err != nil {
		return nil, err
	}
	rep := &domain.ExecutiveReport{
		NextCode:         state.NextCode,
		NextSnapshotCode: state.NextSnapshotCode,
		Snapshots:        state.Snapshots,
	}
	if len(state.Snapshots) > 0 {
		latest := state.Snapshots[0]
		rep.TotalSales = latest.TotalSales
		rep.TotalCollected = latest.TotalCollected
		rep.TotalPendingReceivables = latest.TotalPendingReceivables
		rep.TotalExpenses = latest.TotalExpenses
		rep.NetOperatingProfit = latest.NetOperatingProfit
		rep.InventoryCostValue = latest.InventoryCostValue
		rep.InventorySaleValue = latest.InventorySaleValue
		rep.LowStockCount = latest.LowStockCount
		rep.CustomersCount = latest.CustomersCount
	}
	return rep, nil
}
