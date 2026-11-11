package facturacion_dian

import (
	"context"

	"ms-facturacion/internal/domain"
	internalmod "ms-facturacion/internal/modules/facturacion_dian"
)

func Apply(ctx context.Context, inv *domain.Invoice) {
	internalmod.Apply(ctx, inv)
}
