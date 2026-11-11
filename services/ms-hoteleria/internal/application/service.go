package application

import (
	"context"
	"strings"

	"ms-hoteleria/internal/platform/apperr"
	"ms-hoteleria/internal/platform/authguard"
	"ms-hoteleria/internal/platform/licensegate"
	"ms-hoteleria/internal/domain"
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

func (s *Service) GetState(ctx context.Context) (domain.HospitalityState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.HospitalityState{}, err
	}
	if !licensegate.HasModule(ctx, "recepcion_habitaciones") && !licensegate.HasModule(ctx, "tarifas_temporadas") {
		return domain.HospitalityState{}, apperr.Forbidden("Ningún módulo hotelero está activo en la suscripción")
	}
	return s.repo.GetState(ctx, tc.DBName)
}

func (s *Service) CreateRoom(ctx context.Context, in domain.CreateRoomInput) (domain.HotelRoom, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	if !licensegate.HasModule(ctx, "recepcion_habitaciones") && !licensegate.HasModule(ctx, "tarifas_temporadas") {
		return domain.HotelRoom{}, apperr.Forbidden("No tiene módulos hoteleros habilitados para crear habitaciones")
	}
	if _, err := domain.BuildHotelRoom("RM-TMP", in); err != nil {
		return domain.HotelRoom{}, err
	}
	return s.repo.CreateRoom(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CheckIn(ctx context.Context, in domain.CheckInInput) (domain.HotelRoom, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	if err := licensegate.CheckModule(ctx, "recepcion_habitaciones"); err != nil {
		return domain.HotelRoom{}, err
	}
	norm, err := domain.ValidateCheckInInput(in)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	return s.repo.CheckIn(ctx, tc.DBName, tc.IdempotencyKey, norm)
}

func (s *Service) AddExtraCharge(ctx context.Context, roomID string, in domain.ExtraChargeInput) (domain.HotelRoom, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	if err := licensegate.CheckFeature(ctx, "recepcion_habitaciones", "cargos_habitacion"); err != nil {
		return domain.HotelRoom{}, err
	}
	cleanRoomID := strings.TrimSpace(roomID)
	if cleanRoomID == "" {
		return domain.HotelRoom{}, apperr.Validation("El identificador de la habitación es obligatorio")
	}
	return s.repo.AddExtraCharge(ctx, tc.DBName, tc.IdempotencyKey, cleanRoomID, in)
}

func (s *Service) CompleteRoomCheckout(ctx context.Context, idemKey, roomID, invoiceNumber string) (string, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return "", err
	}
	cleanRoomID := strings.TrimSpace(roomID)
	if cleanRoomID == "" {
		return "", apperr.Validation("El identificador de la habitación es obligatorio")
	}
	effectiveKey := strings.TrimSpace(idemKey)
	if effectiveKey == "" {
		effectiveKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	return s.repo.CompleteRoomCheckout(ctx, tc.DBName, effectiveKey, cleanRoomID, strings.TrimSpace(invoiceNumber))
}
