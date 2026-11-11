package domain

import "context"

type BrandingRepository interface {
	GetBranding(ctx context.Context, dbName string) (BrandingConfig, error)
	SaveBranding(ctx context.Context, dbName, idemKey string, cfg BrandingConfig) (BrandingConfig, error)
	RecordRenderLog(ctx context.Context, dbName string, req RenderRequest, formatUsed string) error
}

type LayoutStrategy interface {
	VariantKey() string
	Render(branding BrandingConfig, req RenderRequest) (string, error)
}
