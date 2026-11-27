package application

import (
	"context"
	"strings"

	"ms-comandas/internal/domain"
	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/authguard"
	"ms-comandas/internal/platform/licensegate"
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

func hasAnyGastroModule(ctx context.Context) bool {
	return licensegate.HasModule(ctx, "mapa_mesas") ||
		licensegate.HasModule(ctx, "monitor_cocina") ||
		licensegate.HasModule(ctx, "catalogo_mesas") ||
		licensegate.HasModule(ctx, "carta_servicios") ||
		licensegate.HasModule(ctx, "directorio_meseros")
}

func checkModuleOrSalon(ctx context.Context, moduleKey string) error {
	if licensegate.HasModule(ctx, moduleKey) || licensegate.HasModule(ctx, "mapa_mesas") {
		return nil
	}
	return licensegate.CheckModule(ctx, moduleKey)
}

func (s *Service) GetState(ctx context.Context) (domain.GastroState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.GastroState{}, err
	}
	if !hasAnyGastroModule(ctx) {
		return domain.GastroState{}, apperr.Forbidden("Ningún módulo gastronómico está activo en la suscripción")
	}
	return s.repo.GetState(ctx, tc.DBName)
}

func (s *Service) CreateTable(ctx context.Context, in domain.CreateTableInput) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := checkModuleOrSalon(ctx, "catalogo_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	if _, err := domain.BuildDiningTable("TBL-TMP", in); err != nil {
		return domain.DiningTable{}, err
	}
	return s.repo.CreateTable(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) UpdateTable(ctx context.Context, tableID string, in domain.UpdateTableInput) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := checkModuleOrSalon(ctx, "catalogo_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	cleanID := strings.TrimSpace(tableID)
	if cleanID == "" {
		return domain.DiningTable{}, apperr.Validation("El identificador de la mesa es obligatorio")
	}
	return s.repo.UpdateTable(ctx, tc.DBName, cleanID, in)
}

func (s *Service) DeleteTable(ctx context.Context, tableID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := checkModuleOrSalon(ctx, "catalogo_mesas"); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(tableID)
	if cleanID == "" {
		return apperr.Validation("El identificador de la mesa es obligatorio")
	}
	return s.repo.DeleteTable(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateMenuItem(ctx context.Context, in domain.CreateMenuItemInput) (domain.MenuItem, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.MenuItem{}, err
	}
	if err := checkModuleOrSalon(ctx, "carta_servicios"); err != nil {
		return domain.MenuItem{}, err
	}
	if _, err := domain.BuildMenuItem("MNU-TMP", in); err != nil {
		return domain.MenuItem{}, err
	}
	return s.repo.CreateMenuItem(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) UpdateMenuItem(ctx context.Context, itemID string, in domain.UpdateMenuItemInput) (domain.MenuItem, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.MenuItem{}, err
	}
	if err := checkModuleOrSalon(ctx, "carta_servicios"); err != nil {
		return domain.MenuItem{}, err
	}
	cleanID := strings.TrimSpace(itemID)
	if cleanID == "" {
		return domain.MenuItem{}, apperr.Validation("El identificador del plato o servicio es obligatorio")
	}
	return s.repo.UpdateMenuItem(ctx, tc.DBName, cleanID, in)
}

func (s *Service) DeleteMenuItem(ctx context.Context, itemID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := checkModuleOrSalon(ctx, "carta_servicios"); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(itemID)
	if cleanID == "" {
		return apperr.Validation("El identificador del plato o servicio es obligatorio")
	}
	return s.repo.DeleteMenuItem(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateWaiter(ctx context.Context, in domain.CreateWaiterInput) (domain.Waiter, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Waiter{}, err
	}
	if err := checkModuleOrSalon(ctx, "directorio_meseros"); err != nil {
		return domain.Waiter{}, err
	}
	if _, err := domain.BuildWaiter("MSR-TMP", in); err != nil {
		return domain.Waiter{}, err
	}
	return s.repo.CreateWaiter(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) UpdateWaiter(ctx context.Context, waiterID string, in domain.UpdateWaiterInput) (domain.Waiter, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Waiter{}, err
	}
	if err := checkModuleOrSalon(ctx, "directorio_meseros"); err != nil {
		return domain.Waiter{}, err
	}
	cleanID := strings.TrimSpace(waiterID)
	if cleanID == "" {
		return domain.Waiter{}, apperr.Validation("El identificador del mesero es obligatorio")
	}
	return s.repo.UpdateWaiter(ctx, tc.DBName, cleanID, in)
}

func (s *Service) DeleteWaiter(ctx context.Context, waiterID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := checkModuleOrSalon(ctx, "directorio_meseros"); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(waiterID)
	if cleanID == "" {
		return apperr.Validation("El identificador del mesero es obligatorio")
	}
	return s.repo.DeleteWaiter(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateOrder(ctx context.Context, in domain.CreateOrderInput) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if err := licensegate.CheckModule(ctx, "mapa_mesas"); err != nil {
		return domain.DiningTable{}, err
	}
	norm, err := domain.ValidateCreateOrderInput(in)
	if err != nil {
		return domain.DiningTable{}, err
	}
	for _, it := range norm.Items {
		if strings.TrimSpace(it.Note) != "" {
			if err := licensegate.CheckFeature(ctx, "mapa_mesas", "notas_preparacion"); err != nil {
				return domain.DiningTable{}, err
			}
			break
		}
	}
	return s.repo.CreateOrder(ctx, tc.DBName, tc.IdempotencyKey, norm)
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

func (s *Service) AdvanceStage(ctx context.Context, tableID, stage string) (domain.DiningTable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DiningTable{}, err
	}
	if !licensegate.HasModule(ctx, "monitor_cocina") && !licensegate.HasModule(ctx, "mapa_mesas") {
		return domain.DiningTable{}, apperr.Forbidden("No tiene módulos habilitados para actualizar etapas de comanda")
	}
	cleanTableID := strings.TrimSpace(tableID)
	if cleanTableID == "" {
		return domain.DiningTable{}, apperr.Validation("El identificador de la comanda o mesa es obligatorio")
	}
	cleanStage := strings.ToUpper(strings.TrimSpace(stage))
	if cleanStage == "" {
		return domain.DiningTable{}, apperr.Validation("La etapa destino de la comanda es obligatoria")
	}
	return s.repo.AdvanceStage(ctx, tc.DBName, cleanTableID, cleanStage)
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
