package facturas_taller

import (
	"context"
	"strings"

	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
)

type Input struct {
	VehicleID         string
	Plate             string
	MechanicID        string
	LinkedWorkOrderID string
	WorkshopMeta      map[string]string
}

type Result struct {
	WorkOrderID         string
	ShouldNotifyOrder   bool
	ShouldPayCommission bool
	LaborGross          float64
}

// Apply valida la jerarquía Nivel 3 (módulo facturas_taller) y Nivel 4 (funcionalidades
// asignar_mecanico y factura_taller_pdf) sobre la factura antes de persistirla.
func Apply(
	ctx context.Context,
	vehicles []tenantdb.Vehicle,
	workers []tenantdb.Worker,
	inv *tenantdb.Invoice,
	in Input,
) Result {
	if !licensegate.HasModule(ctx, "facturas_taller") {
		inv.VehicleID = ""
		inv.Plate = ""
		inv.MechanicID = ""
		inv.MechanicName = ""
		inv.WorkshopMeta = nil
		if inv.LayoutVariant == "factura_taller" {
			inv.LayoutVariant = ""
		}
		for i := range inv.Items {
			inv.Items[i].WorkerID = ""
			inv.Items[i].WorkerName = ""
		}
		return Result{}
	}

	meta := map[string]string{}
	for k, v := range in.WorkshopMeta {
		if strings.TrimSpace(v) != "" {
			meta[k] = strings.TrimSpace(v)
		}
	}

	inv.VehicleID = strings.TrimSpace(in.VehicleID)
	inv.Plate = strings.ToUpper(strings.TrimSpace(in.Plate))

	for _, v := range vehicles {
		if (inv.VehicleID != "" && v.ID == inv.VehicleID) || (inv.Plate != "" && strings.EqualFold(v.Plate, inv.Plate)) {
			inv.VehicleID = v.ID
			inv.Plate = v.Plate
			if meta["vehicleBrand"] == "" {
				meta["vehicleBrand"] = strings.TrimSpace(v.Brand + " " + v.ModelYear)
			}
			if meta["currentKm"] == "" && v.CurrentKm > 0 {
				meta["currentKm"] = formatKm(v.CurrentKm)
			}
			if meta["nextOilKm"] == "" && v.NextOilChangeKm > 0 {
				meta["nextOilKm"] = formatKm(v.NextOilChangeKm)
			}
			break
		}
	}

	workOrderID := strings.TrimSpace(in.LinkedWorkOrderID)
	if workOrderID == "" {
		workOrderID = strings.TrimSpace(meta["workOrderId"])
	}
	if workOrderID != "" {
		meta["workOrderId"] = workOrderID
		meta["Orden de Servicio"] = workOrderID
	}
	if inv.Plate != "" {
		meta["Placa"] = inv.Plate
	}
	if meta["vehicleBrand"] != "" {
		meta["Vehículo"] = meta["vehicleBrand"]
	}
	if meta["currentKm"] != "" {
		meta["Kilometraje"] = meta["currentKm"]
	}
	if meta["nextOilKm"] != "" {
		meta["Próximo Aceite"] = meta["nextOilKm"]
	}

	// Funcionalidad dependiente 1: asignar_mecanico (DependsOnModule: "facturas_taller")
	canAssignMechanic := licensegate.HasFeature(ctx, "facturas_taller", "asignar_mecanico")
	if canAssignMechanic && strings.TrimSpace(in.MechanicID) != "" {
		inv.MechanicID = strings.TrimSpace(in.MechanicID)
		for _, w := range workers {
			if w.ID == inv.MechanicID {
				inv.MechanicName = w.Name
				break
			}
		}
		if inv.MechanicName != "" {
			meta["Técnico / Mecánico"] = inv.MechanicName
		}
	} else {
		inv.MechanicID = ""
		inv.MechanicName = ""
		delete(meta, "Técnico / Mecánico")
		delete(meta, "Mecánico")
		delete(meta, "mechanicName")
		for i := range inv.Items {
			inv.Items[i].WorkerID = ""
			inv.Items[i].WorkerName = ""
		}
	}

	if len(meta) > 0 {
		inv.WorkshopMeta = meta
	} else {
		inv.WorkshopMeta = nil
	}

	// Funcionalidad dependiente 2: factura_taller_pdf (DependsOnModule: "facturas_taller")
	hasVehicle := inv.Plate != "" || inv.VehicleID != ""
	if licensegate.HasFeature(ctx, "facturas_taller", "factura_taller_pdf") && hasVehicle {
		inv.LayoutVariant = "factura_taller"
	} else if inv.LayoutVariant == "factura_taller" {
		inv.LayoutVariant = ""
	}

	laborGross := 0.0
	for _, it := range inv.Items {
		if strings.EqualFold(it.Kind, "SERVICIO") {
			laborGross += it.Qty * it.Price
		}
	}
	if laborGross == 0 && canAssignMechanic && inv.MechanicID != "" {
		laborGross = inv.Subtotal
	}

	return Result{
		WorkOrderID:         workOrderID,
		ShouldNotifyOrder:   workOrderID != "",
		ShouldPayCommission: canAssignMechanic && inv.MechanicID != "",
		LaborGross:          laborGross,
	}
}

func formatKm(km int) string {
	raw := strings.TrimSpace(intToStr(km))
	return raw + " km"
}

func intToStr(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var digits []byte
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	s := string(digits)
	var parts []string
	for len(s) > 3 {
		parts = append([]string{s[len(s)-3:]}, parts...)
		s = s[:len(s)-3]
	}
	parts = append([]string{s}, parts...)
	if neg {
		return "-" + strings.Join(parts, ".")
	}
	return strings.Join(parts, ".")
}
