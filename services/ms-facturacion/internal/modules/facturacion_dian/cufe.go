package facturacion_dian

import (
	"context"

	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/licensegate"
)

func Apply(ctx context.Context, inv *domain.Invoice) {
	if !licensegate.HasModule(ctx, "facturacion_dian") {
		inv.CUFE = ""
		inv.DianStatus = ""
		inv.DianStage = domain.DianStageSinEnviar
		inv.Editable = inv.DocStatus != domain.DocStatusAnuladaNC
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
	inv.DianStage = domain.DianStageAceptada
	inv.Editable = false
}
