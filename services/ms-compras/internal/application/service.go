package application

import (
	"context"
	"hash/fnv"
	"strings"
	"sync"
	"time"

	"ms-compras/internal/domain"
	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/authguard"
	"ms-compras/internal/platform/licensegate"
	"ms-compras/internal/platform/money"
)

const (
	ModuleSuppliers = "directorio_proveedores"
	ModuleOrders    = "ordenes_compra"
)

type Service struct {
	repo        domain.Repository
	inventory   domain.InventoryRestockPort
	idemStripes [64]sync.Mutex
}

func NewService(repo domain.Repository, inventory domain.InventoryRestockPort) *Service {
	return &Service{
		repo:      repo,
		inventory: inventory,
	}
}

func (s *Service) lockIdemStripe(dbName, idemKey string) func() {
	if idemKey == "" {
		return func() {}
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(dbName + "|" + idemKey))
	mu := &s.idemStripes[h.Sum32()%64]
	mu.Lock()
	return mu.Unlock
}

func requireDBName(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return tc, apperr.Unauthorized("Contexto de base de datos de empresa no disponible")
	}
	return tc, nil
}

func (s *Service) GetAll(ctx context.Context) (*domain.AllState, error) {
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if !licensegate.HasModule(ctx, ModuleSuppliers) && !licensegate.HasModule(ctx, ModuleOrders) {
		return nil, apperr.Forbidden("Ningún módulo de compras se encuentra activo en la suscripción")
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateSupplier(ctx context.Context, in domain.CreateSupplierInput) (*domain.Supplier, error) {
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleSuppliers); err != nil {
		return nil, err
	}
	if _, err := domain.NewSupplier("tmp", "PRV-0", in, ""); err != nil {
		return nil, err
	}
	return s.repo.CreateSupplier(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) DeleteSupplier(ctx context.Context, supplierID string) error {
	tc, err := requireDBName(ctx)
	if err != nil {
		return err
	}
	if err := licensegate.CheckModule(ctx, ModuleSuppliers); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(supplierID)
	if cleanID == "" {
		return apperr.Validation("El identificador del proveedor es obligatorio")
	}
	return s.repo.DeleteSupplier(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateOrder(ctx context.Context, in domain.CreateOrderInput) (*domain.PurchaseOrder, error) {
	tc, err := requireDBName(ctx)
	if err != nil {
		return nil, err
	}
	if err := licensegate.CheckModule(ctx, ModuleOrders); err != nil {
		return nil, err
	}

	unlock := s.lockIdemStripe(tc.DBName, tc.IdempotencyKey)
	defer unlock()

	if tc.IdempotencyKey != "" {
		existing, err := s.repo.FindIdempotentOrder(ctx, tc.DBName, tc.IdempotencyKey)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	supplierID := strings.TrimSpace(in.SupplierID)
	if supplierID == "" {
		return nil, apperr.Validation("Selecciona un proveedor válido")
	}
	supplier, err := s.repo.GetSupplierByID(ctx, tc.DBName, supplierID)
	if err != nil {
		return nil, err
	}

	actor := strings.TrimSpace(tc.Username)
	if actor == "" {
		actor = "compras@empresa.co"
	}

	if _, err := domain.NewPurchaseOrder("OC-0", supplier, in, false, actor, ""); err != nil {
		return nil, err
	}

	inventorySynced := false
	var restockReq domain.InventoryRestockInput
	if s.inventory != nil && licensegate.HasService(ctx, "ms-inventario") {
		productID := strings.TrimSpace(in.ProductID)
		if productID == "" {
			return nil, apperr.Validation("Selecciona un producto del catálogo de inventario para registrar la entrada")
		}
		refCode, peekErr := s.repo.PeekNextOrderCode(ctx, tc.DBName)
		if peekErr != nil || refCode == "" {
			refCode = "OC"
		}
		rpcIdem := tc.IdempotencyKey
		if rpcIdem == "" {
			rpcIdem = money.NewID("idem-oc")
		}
		restockReq = domain.InventoryRestockInput{
			IdempotencyKey: rpcIdem,
			ProductID:      productID,
			Quantity:       money.RoundCents(in.Qty),
			UnitCost:       money.RoundCents(in.UnitCost),
			WarehouseID:    strings.TrimSpace(in.WarehouseID),
			ReferenceDoc:   refCode,
			Actor:          actor,
		}
		if err := s.inventory.RestockItem(ctx, restockReq); err != nil {
			return nil, err
		}
		inventorySynced = true
	}

	order, err := s.repo.CreateOrder(ctx, tc.DBName, tc.IdempotencyKey, in, inventorySynced, actor)
	if err != nil {
		if inventorySynced {
			if comp, ok := s.inventory.(domain.InventoryCompensator); ok {
				compCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 4*time.Second)
				_ = comp.CompensateRestock(compCtx, restockReq)
				cancel()
			}
		}
		return nil, err
	}
	return order, nil
}
