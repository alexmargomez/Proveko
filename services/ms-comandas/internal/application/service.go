package application

import (
	"context"
	"strings"

	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/authguard"
	"ms-comandas/internal/platform/licensegate"
	"ms-comandas/internal/domain"
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

func (s *Service) GetState(ctx context.Context) (domain.GastroState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.GastroState{}, err
	}
	if !licensegate.HasModule(ctx, "mapa_mesas") && !licensegate.HasModule(ctx, "monitor_cocina") {
		return domain.GastroState{}, apperr.Forbidden("Ningún módulo gastronómico está activo en la suscripción")
	}
	return s.repo.GetState(ctx, tc.DBName)
}

func (s *Service) CreateTable(ctx context.Context, in domain.CreateTableInput) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	if _, err := domain.BuildDiningTable("TBL-TMP", in); err != nil {
		return domain.DiningTable{}, err
	}
	return s.repo.CreateTable(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateMenuItem(ctx context.Context, in domain.CreateMenuItemInput) (domain.MenuItem, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.MenuItem{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.MenuItem{}, err
	}
	if _, err := domain.BuildMenuItem("MNU-TMP", in); err != nil {
		return domain.MenuItem{}, err
	}
	return s.repo.CreateMenuItem(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) AddItemToTable(ctx context.Context, tableID string, in domain.AddOrderItemInput) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	cleanTableID := strings.TrimSpace(tableID)
	if cleanTableID == "" {
		return domain.DiningTable{}, apperr.Validation("El identificador de la mesa es obligatorio")
	}
	if strings.TrimSpace(in.Note) != "" {
		if err := licensegate.CheckFeature(ctx, "mapa_mesas", "notas_preparacion"); err != nil {
			return domain.DiningTable{}, err
		}
	}
	if in.Qty <= 0 {
		return domain.DiningTable{}, apperr.Validation("La cantidad debe ser estrictamente mayor a cero")
	}
	return s.repo.AddItemToTable(ctx, tc.DBName, tc.IdempotencyKey, cleanTableID, in)
}

func (s *Service) RemoveItemFromTable(ctx context.Context, tableID, itemID string) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	cleanTableID := strings.TrimSpace(tableID)
	cleanItemID := strings.TrimSpace(itemID)
	if cleanTableID == "" || cleanItemID == "" {
		return domain.DiningTable{}, apperr.Validation("Los identificadores de mesa y plato son obligatorios")
	}
	return s.repo.RemoveItemFromTable(ctx, tc.DBName, cleanTableID, cleanItemID)
}

func (s *Service) SendToKitchen(ctx context.Context, tableID string) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	cleanTableID := strings.TrimSpace(tableID)
	if cleanTableID == "" {
		return domain.DiningTable{}, apperr.Validation("El identificador de la mesa es obligatorio")
	}
	return s.repo.SendToKitchen(ctx, tc.DBName, cleanTableID)
}

func (s *Service) MarkReady(ctx context.Context, tableID string) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if !licensegate.HasModule(ctx, "monitor_cocina") && !licensegate.HasModule(ctx, "mapa_mesas") {
		return domain.DiningTable{}, apperr.Forbidden("No tiene módulos habilitados para actualizar comandas de cocina")
	}
	cleanTableID := strings.TrimSpace(tableID)
	if cleanTableID == "" {
		return domain.DiningTable{}, apperr.Validation("El identificador de la mesa es obligatorio")
	}
	return s.repo.MarkReady(ctx, tc.DBName, cleanTableID)
}

func (s *Service) ClearInvoicedTable(ctx context.Context, idemKey, tableID, invoiceNumber string) (bool, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return false, err
	}
	cleanTableID := strings.TrimSpace(tableID)
	if cleanTableID == "" {
		return false, apperr.Validation("El identificador de la mesa es obligatorio")
	}
	effectiveKey := strings.TrimSpace(idemKey)
	if effectiveKey == "" {
		effectiveKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	return s.repo.ClearInvoicedTable(ctx, tc.DBName, effectiveKey, cleanTableID, strings.TrimSpace(invoiceNumber))
}
