package application

import (
	"context"
	"strings"

	"ms-bascula/internal/platform/apperr"
	"ms-bascula/internal/platform/authguard"
	"ms-bascula/internal/platform/licensegate"
	"ms-bascula/internal/domain"
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

func (s *Service) GetState(ctx context.Context) (domain.ScaleState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.ScaleState{}, err
	}
	if !licensegate.HasModule(ctx, "pesaje_camionero") &&
		!licensegate.HasModule(ctx, "flota_conductores") &&
		!licensegate.HasModule(ctx, "rutas_manifiestos") {
		return domain.ScaleState{}, apperr.Forbidden("Ningún módulo de báscula o logística pesada está activo en la suscripción")
	}
	return s.repo.GetState(ctx, tc.DBName)
}

func (s *Service) CreateVehicle(ctx context.Context, in domain.CreateHeavyVehicleInput) (domain.HeavyVehicle, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}
	if !licensegate.HasModule(ctx, "pesaje_camionero") && !licensegate.HasModule(ctx, "flota_conductores") {
		return domain.HeavyVehicle{}, apperr.Forbidden("No tiene módulos habilitados para registrar tractocamiones")
	}
	if _, err := domain.BuildHeavyVehicle("CAM-TMP", in); err != nil {
		return domain.HeavyVehicle{}, err
	}
	return s.repo.CreateVehicle(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateDriver(ctx context.Context, in domain.CreateDriverInput) (domain.Driver, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Driver{}, err
	}
	if !licensegate.HasModule(ctx, "pesaje_camionero") && !licensegate.HasModule(ctx, "flota_conductores") {
		return domain.Driver{}, apperr.Forbidden("No tiene módulos habilitados para registrar conductores")
	}
	if _, err := domain.BuildDriver("COND-TMP", in); err != nil {
		return domain.Driver{}, err
	}
	return s.repo.CreateDriver(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateCarrier(ctx context.Context, in domain.CreateCarrierInput) (domain.Carrier, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Carrier{}, err
	}
	if !licensegate.HasModule(ctx, "pesaje_camionero") && !licensegate.HasModule(ctx, "flota_conductores") {
		return domain.Carrier{}, apperr.Forbidden("No tiene módulos habilitados para registrar transportadoras")
	}
	if _, err := domain.BuildCarrier("TRN-TMP", in); err != nil {
		return domain.Carrier{}, err
	}
	return s.repo.CreateCarrier(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateRoute(ctx context.Context, in domain.CreateCargoRouteInput) (domain.CargoRoute, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CargoRoute{}, err
	}
	if !licensegate.HasModule(ctx, "pesaje_camionero") && !licensegate.HasModule(ctx, "rutas_manifiestos") {
		return domain.CargoRoute{}, apperr.Forbidden("No tiene módulos habilitados para registrar cargas o rutas")
	}
	if _, err := domain.BuildCargoRoute("CAR-TMP", in); err != nil {
		return domain.CargoRoute{}, err
	}
	return s.repo.CreateRoute(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateTicket(ctx context.Context, in domain.CreateScaleTicketInput) (domain.ScaleTicket, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.ScaleTicket{}, err
	}
	if err := licensegate.CheckModule(ctx, "pesaje_camionero"); err != nil {
		return domain.ScaleTicket{}, err
	}
	if _, _, _, err := domain.ValidateWeights(in.GrossKg, in.TareKg); err != nil {
		return domain.ScaleTicket{}, err
	}
	if strings.TrimSpace(in.VehicleID) == "" ||
		strings.TrimSpace(in.DriverID) == "" ||
		strings.TrimSpace(in.CarrierID) == "" ||
		strings.TrimSpace(in.CargoID) == "" {
		return domain.ScaleTicket{}, apperr.Validation("Debes seleccionar tractocamión, conductor, transportadora y ruta/carga")
	}
	return s.repo.CreateTicket(ctx, tc.DBName, tc.IdempotencyKey, in)
}
