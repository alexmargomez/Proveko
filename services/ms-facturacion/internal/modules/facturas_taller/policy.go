package facturas_taller

import (
	"context"
	"strings"

	"ms-facturacion/internal/platform/licensegate"
	"ms-facturacion/internal/platform/money"
	"ms-facturacion/internal/domain"
)

type Input struct {
	VehicleID         string
	Plate             string
	MechanicID        string
	MechanicName      string
	LinkedWorkOrderID string
	WorkshopMeta      domain.WorkshopMetadata
}

type Result struct {
	WorkOrderID         string
	ShouldNotifyOrder   bool
	ShouldPayCommission bool
	LaborGross          float64
}

func Apply(ctx context.Context, inv *domain.Invoice, in Input) Result {
	if !licensegate.HasModule(ctx, "facturas_taller") {
		inv.VehicleID = ""
		inv.Plate = ""
		inv.MechanicID = ""
		inv.MechanicName = ""
		inv.WorkshopMeta = domain.WorkshopMetadata{}
		inv.LayoutVariant = ""
		for i := range inv.Items {
			inv.Items[i].WorkerID = ""
			inv.Items[i].WorkerName = ""
		}
		return Result{}
	}

	inv.VehicleID = strings.TrimSpace(in.VehicleID)
	inv.Plate = strings.ToUpper(strings.TrimSpace(in.Plate))

	workOrderID := strings.TrimSpace(in.LinkedWorkOrderID)
	if workOrderID == "" {
		workOrderID = strings.TrimSpace(in.WorkshopMeta.WorkOrderID)
	}

	inv.WorkshopMeta = domain.WorkshopMetadata{
		VehicleBrand: strings.TrimSpace(in.WorkshopMeta.VehicleBrand),
		CurrentKm:    strings.TrimSpace(in.WorkshopMeta.CurrentKm),
		NextOilKm:    strings.TrimSpace(in.WorkshopMeta.NextOilKm),
		WorkOrderID:  workOrderID,
	}

	canAssignMechanic := licensegate.HasFeature(ctx, "facturas_taller", "asignar_mecanico")
	if canAssignMechanic && strings.TrimSpace(in.MechanicID) != "" {
		inv.MechanicID = strings.TrimSpace(in.MechanicID)
		inv.MechanicName = strings.TrimSpace(in.MechanicName)
	} else {
		inv.MechanicID = ""
		inv.MechanicName = ""
		for i := range inv.Items {
			inv.Items[i].WorkerID = ""
			inv.Items[i].WorkerName = ""
		}
	}

	hasVehicle := inv.Plate != "" || inv.VehicleID != ""
	if licensegate.HasFeature(ctx, "facturas_taller", "factura_taller_pdf") && hasVehicle {
		inv.LayoutVariant = domain.LayoutTaller
	} else if inv.LayoutVariant == domain.LayoutTaller {
		inv.LayoutVariant = ""
	}

	laborGross := 0.0
	for _, it := range inv.Items {
		if strings.EqualFold(it.ItemType, domain.ItemTypeServicio) {
			laborGross += it.Subtotal
		}
	}
	if laborGross == 0 && canAssignMechanic && inv.MechanicID != "" {
		laborGross = inv.Subtotal
	}

	return Result{
		WorkOrderID:         workOrderID,
		ShouldNotifyOrder:   workOrderID != "",
		ShouldPayCommission: canAssignMechanic && inv.MechanicID != "",
		LaborGross:          money.RoundCents(laborGross),
	}
}
