package facturacion_dian

import (
	"context"

	"ms-facturacion/internal/platform/licensegate"
	"ms-facturacion/internal/domain"
)

func Apply(ctx context.Context, inv *domain.Invoice) {
	if !licensegate.HasModule(ctx, "facturacion_dian") {
		inv.CUFE = ""
		inv.DianStatus = ""
		return
	}

	inv.CUFE = domain.DeterministicCUFE(
		inv.ID,
		inv.IssueDate,
		inv.Subtotal,
		inv.DiscountTotal,
		inv.TaxTotal,
		inv.Total,
		inv.CustomerNIT,
	)
	inv.DianStatus = domain.DianStatusAceptada
}
