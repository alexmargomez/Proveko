package application

import (
	"context"
	"fmt"
	"strings"

	"ms-impresiones/internal/platform/apperr"
	"ms-impresiones/internal/platform/authguard"
	"ms-impresiones/internal/platform/licensegate"
	"ms-impresiones/internal/domain"
)

type PrintUseCase struct {
	repo       domain.BrandingRepository
	strategies map[string]domain.LayoutStrategy
}

func NewPrintUseCase(repo domain.BrandingRepository, strategies map[string]domain.LayoutStrategy) *PrintUseCase {
	if strategies == nil {
		strategies = make(map[string]domain.LayoutStrategy)
	}
	return &PrintUseCase{
		repo:       repo,
		strategies: strategies,
	}
}

func (uc *PrintUseCase) GetBranding(ctx context.Context) (domain.BrandingConfig, error) {
	if err := licensegate.CheckModule(ctx, "config_membretes"); err != nil {
		return domain.BrandingConfig{}, err
	}
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return domain.BrandingConfig{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	cfg, err := uc.repo.GetBranding(ctx, tc.DBName)
	if err != nil {
		return domain.BrandingConfig{}, err
	}
	return domain.NormalizeBranding(cfg, false)
}

func (uc *PrintUseCase) UpdateBranding(ctx context.Context, input domain.BrandingConfig) (domain.BrandingConfig, error) {
	if err := licensegate.CheckModule(ctx, "config_membretes"); err != nil {
		return domain.BrandingConfig{}, err
	}
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return domain.BrandingConfig{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	normalized, err := domain.NormalizeBranding(input, true)
	if err != nil {
		return domain.BrandingConfig{}, err
	}
	return uc.repo.SaveBranding(ctx, tc.DBName, tc.IdempotencyKey, normalized)
}

func (uc *PrintUseCase) RenderDocument(ctx context.Context, raw domain.RenderRequest) (domain.RenderOutput, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return domain.RenderOutput{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	req, err := domain.NormalizeRenderRequest(raw)
	if err != nil {
		return domain.RenderOutput{}, err
	}
	if req.Actor == "" {
		req.Actor = tc.Username
	}

	branding, err := uc.repo.GetBranding(ctx, tc.DBName)
	if err != nil {
		return domain.RenderOutput{}, err
	}
	branding, _ = domain.NormalizeBranding(branding, false)

	variantKey := req.LayoutVariant
	if variantKey == "" {
		variantKey = branding.DefaultFormat
	}
	strategy, ok := uc.strategies[variantKey]
	if !ok {
		variantKey = branding.DefaultFormat
		strategy, ok = uc.strategies[variantKey]
		if !ok {
			variantKey = domain.FormatCarta
			strategy = uc.strategies[domain.FormatCarta]
		}
	}
	if strategy == nil {
		return domain.RenderOutput{}, apperr.Internal("Estrategia de impresión no registrada")
	}

	htmlOut, err := strategy.Render(branding, req)
	if err != nil {
		return domain.RenderOutput{}, err
	}

	if logErr := uc.repo.RecordRenderLog(ctx, tc.DBName, req, variantKey); logErr != nil {
		return domain.RenderOutput{}, logErr
	}

	title := fmt.Sprintf("%s %s — %s", req.DocumentType, req.DocumentNumber, branding.CompanyName)
	return domain.RenderOutput{
		Title:         title,
		Format:        variantKey,
		HTMLPrintable: htmlOut,
	}, nil
}
