package application

import (
	"context"
	"strings"

	"ms-taller/internal/platform/apperr"
	"ms-taller/internal/platform/authguard"
	"ms-taller/internal/platform/licensegate"
	"ms-taller/internal/domain"
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

func (s *Service) GetState(ctx context.Context) (domain.WorkshopState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.WorkshopState{}, err
	}
	if !licensegate.HasModule(ctx, "tablero_ordenes") &&
		!licensegate.HasModule(ctx, "hoja_vida_vehiculos") &&
		!licensegate.HasModule(ctx, "comisiones_tecnicos") {
		return domain.WorkshopState{}, apperr.Forbidden("Ningún módulo de taller está activo en la suscripción")
	}
	return s.repo.GetState(ctx, tc.DBName)
}

func (s *Service) CreateVehicle(ctx context.Context, in domain.CreateVehicleInput) (domain.Vehicle, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Vehicle{}, err
	}
	if !licensegate.HasModule(ctx, "hoja_vida_vehiculos") && !licensegate.HasModule(ctx, "tablero_ordenes") {
		return domain.Vehicle{}, apperr.Forbidden("No tiene módulos habilitados para registrar vehículos")
	}
	if _, err := domain.BuildVehicle("VEH-TMP", in); err != nil {
		return domain.Vehicle{}, err
	}
	return s.repo.CreateVehicle(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) DeleteVehicle(ctx context.Context, vehicleID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if !licensegate.HasModule(ctx, "hoja_vida_vehiculos") && !licensegate.HasModule(ctx, "tablero_ordenes") {
		return apperr.Forbidden("No tiene módulos habilitados para eliminar vehículos")
	}
	cleanID := strings.TrimSpace(vehicleID)
	if cleanID == "" {
		return apperr.Validation("El identificador del vehículo es obligatorio")
	}
	return s.repo.DeleteVehicle(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateWorkOrder(ctx context.Context, in domain.CreateWorkOrderInput) (domain.WorkOrder, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.WorkOrder{}, err
	}
	if err := licensegate.CheckModule(ctx, "tablero_ordenes"); err != nil {
		return domain.WorkOrder{}, err
	}
	if strings.TrimSpace(in.VehicleID) == "" {
		return domain.WorkOrder{}, apperr.Validation("Debes seleccionar la placa del vehículo")
	}
	if strings.TrimSpace(in.ServiceDesc) == "" {
		return domain.WorkOrder{}, apperr.Validation("La descripción del servicio o diagnóstico es obligatoria")
	}
	return s.repo.CreateWorkOrder(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) AdvanceWorkOrderStage(ctx context.Context, orderID, requestedStatus string) (domain.WorkOrder, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.WorkOrder{}, err
	}
	if err := licensegate.CheckModule(ctx, "tablero_ordenes"); err != nil {
		return domain.WorkOrder{}, err
	}
	cleanID := strings.TrimSpace(orderID)
	if cleanID == "" {
		return domain.WorkOrder{}, apperr.Validation("El identificador de la orden de trabajo es obligatorio")
	}
	return s.repo.AdvanceWorkOrderStage(ctx, tc.DBName, cleanID, requestedStatus)
}

func (s *Service) CreateWorker(ctx context.Context, in domain.CreateWorkerInput) (domain.Worker, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Worker{}, err
	}
	if err := licensegate.CheckModule(ctx, "comisiones_tecnicos"); err != nil {
		return domain.Worker{}, err
	}
	if _, err := domain.BuildWorker("TEC-TMP", in); err != nil {
		return domain.Worker{}, err
	}
	return s.repo.CreateWorker(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) SettleWorker(ctx context.Context, workerID string) (domain.Settlement, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Settlement{}, err
	}
	if err := licensegate.CheckModule(ctx, "comisiones_tecnicos"); err != nil {
		return domain.Settlement{}, err
	}
	cleanID := strings.TrimSpace(workerID)
	if cleanID == "" {
		return domain.Settlement{}, apperr.Validation("El identificador del técnico es obligatorio")
	}
	return s.repo.SettleWorker(ctx, tc.DBName, tc.IdempotencyKey, cleanID)
}

func (s *Service) RegisterInvoicedOrderAndCommission(ctx context.Context, in domain.InvoiceSyncInput) (domain.InvoiceSyncResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.InvoiceSyncResult{}, err
	}
	if in.LaborGross < 0 {
		return domain.InvoiceSyncResult{}, apperr.Validation("El valor bruto de mano de obra no puede ser negativo")
	}
	if strings.TrimSpace(in.IdempotencyKey) == "" {
		in.IdempotencyKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	return s.repo.RegisterInvoicedOrderAndCommission(ctx, tc.DBName, in)
}
