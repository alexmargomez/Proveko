package application

import (
	"context"
	"strings"

	"ms-inventario/internal/platform/apperr"
	"ms-inventario/internal/platform/authguard"
	"ms-inventario/internal/platform/licensegate"
	"ms-inventario/internal/domain"
)

const (
	ModuleProductosStock     = "productos_stock"
	ModuleBodegasTraslados   = "bodegas_traslados"
	ModuleKardexLotes        = "kardex_lotes"
	ModuleSolicitudesInsumos = "solicitudes_insumos"
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
		return authguard.TenantContext{}, apperr.Unauthorized("Contexto de base de datos de empresa no disponible")
	}
	return tc, nil
}

func actorFrom(tc authguard.TenantContext) string {
	if u := strings.TrimSpace(tc.Username); u != "" {
		return u
	}
	return "sistema"
}

func (s *Service) GetAll(ctx context.Context) (*domain.InventoryState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if !licensegate.HasModule(ctx, ModuleProductosStock) &&
		!licensegate.HasModule(ctx, ModuleBodegasTraslados) &&
		!licensegate.HasModule(ctx, ModuleKardexLotes) &&
		!licensegate.HasModule(ctx, ModuleSolicitudesInsumos) {
		return nil, apperr.Forbidden("Ningún módulo de inventario está activo en la suscripción de esta empresa")
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateProduct(ctx context.Context, in domain.CreateProductInput) (*domain.Product, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleProductosStock); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.Name) == "" {
		return nil, apperr.Validation("El nombre del producto es obligatorio")
	}
	return s.repo.CreateProduct(ctx, tc.DBName, tc.IdempotencyKey, in, actorFrom(tc))
}

func (s *Service) DeleteProduct(ctx context.Context, productID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := licensegate.CheckModule(ctx, ModuleProductosStock); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(productID)
	if cleanID == "" {
		return apperr.Validation("El identificador del producto es obligatorio")
	}
	return s.repo.DeleteProduct(ctx, tc.DBName, cleanID)
}

func (s *Service) AdjustProductDelta(ctx context.Context, productID string, in domain.AdjustDeltaInput) (*domain.Product, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleProductosStock); err != nil {
		return nil, err
	}
	cleanID := strings.TrimSpace(productID)
	if cleanID == "" {
		return nil, apperr.Validation("El identificador del producto es obligatorio")
	}
	return s.repo.AdjustProductDelta(ctx, tc.DBName, tc.IdempotencyKey, cleanID, in, actorFrom(tc))
}

func (s *Service) RestockProduct(ctx context.Context, productID string, in domain.RestockProductInput) (*domain.Product, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleProductosStock); err != nil {
		return nil, err
	}
	cleanID := strings.TrimSpace(productID)
	if cleanID == "" {
		return nil, apperr.Validation("El identificador del producto es obligatorio")
	}
	return s.repo.RestockProduct(ctx, tc.DBName, tc.IdempotencyKey, cleanID, in, actorFrom(tc))
}

func (s *Service) TransferProduct(ctx context.Context, productID string, in domain.TransferProductInput) (*domain.Product, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleBodegasTraslados); err != nil {
		return nil, err
	}
	cleanID := strings.TrimSpace(productID)
	if cleanID == "" {
		return nil, apperr.Validation("El identificador del producto es obligatorio")
	}
	if in.EffectiveTargetWarehouseID() == "" {
		return nil, apperr.Validation("Debe seleccionar la bodega destino")
	}
	return s.repo.TransferProduct(ctx, tc.DBName, tc.IdempotencyKey, cleanID, in, actorFrom(tc))
}

func (s *Service) CreateWarehouse(ctx context.Context, in domain.CreateWarehouseInput) (*domain.Warehouse, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleBodegasTraslados); err != nil {
		return nil, err
	}
	if _, err := domain.NewWarehouse("wh-tmp", "BOD-0", in); err != nil {
		return nil, err
	}
	return s.repo.CreateWarehouse(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateSupplyRequest(ctx context.Context, in domain.CreateSupplyRequestInput) (*domain.SupplyRequest, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleSolicitudesInsumos); err != nil {
		return nil, err
	}
	return s.repo.CreateSupplyRequest(ctx, tc.DBName, tc.IdempotencyKey, in, actorFrom(tc))
}

func (s *Service) QuoteProducts(ctx context.Context, productIDs []string) ([]domain.ProductQuote, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return nil, err
	}
	if len(productIDs) == 0 {
		return []domain.ProductQuote{}, nil
	}
	clean := make([]string, 0, len(productIDs))
	for _, id := range productIDs {
		trimmed := strings.TrimSpace(id)
		if trimmed == "" {
			return nil, apperr.Validation("Identificador de producto vacío en solicitud de cotización")
		}
		clean = append(clean, trimmed)
	}
	return s.repo.QuoteProducts(ctx, tc.DBName, clean)
}

func (s *Service) DeductStock(ctx context.Context, idemKey string, items []domain.StockDeltaItem) (int, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return 0, err
	}
	if _, _, err := domain.ValidateDeductItems(items); err != nil {
		return 0, err
	}
	effectiveKey := strings.TrimSpace(idemKey)
	if effectiveKey == "" {
		effectiveKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	return s.repo.DeductStock(ctx, tc.DBName, effectiveKey, items, actorFrom(tc))
}

func (s *Service) RestockItems(ctx context.Context, idemKey string, items []domain.StockDeltaItem) (int, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return 0, err
	}
	if _, err := domain.ValidateRestockItems(items); err != nil {
		return 0, err
	}
	effectiveKey := strings.TrimSpace(idemKey)
	if effectiveKey == "" {
		effectiveKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	return s.repo.RestockItems(ctx, tc.DBName, effectiveKey, items, actorFrom(tc))
}
