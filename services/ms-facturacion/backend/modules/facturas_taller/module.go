package facturas_taller

import (
	"context"

	"ms-facturacion/internal/domain"
	internalmod "ms-facturacion/internal/modules/facturas_taller"
)

type Input = internalmod.Input
type Result = internalmod.Result

func Apply(ctx context.Context, inv *domain.Invoice, in Input) Result {
	return internalmod.Apply(ctx, inv, in)
}
