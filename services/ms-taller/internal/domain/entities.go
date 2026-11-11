package domain

import (
	"strings"
	"time"

	"ms-taller/internal/platform/apperr"
	"ms-taller/internal/platform/money"
)

const (
	OrderStatusRecibido   = "Recibido"
	OrderStatusEnProceso  = "En Proceso"
	OrderStatusListo      = "Listo"
	OrderStatusEntregado  = "Entregado"
	OilChangeIntervalInKm = 5000
)

type Vehicle struct {
	ID              string `json:"id"`
	Plate           string `json:"plate"`
	Brand           string `json:"brand"`
	VehicleType     string `json:"vehicleType"`
	CustomerID      string `json:"customerId"`
	CustomerName    string `json:"customerName"`
	CurrentKm       int    `json:"currentKm"`
	NextOilKm       int    `json:"nextOilKm"`
	NextOilChangeKm int    `json:"nextOilChangeKm"`
	SoatExpiry      string `json:"soatExpiry"`
}

type Worker struct {
	ID            string  `json:"id"`
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	DocNumber     string  `json:"docNumber"`
	Specialty     string  `json:"specialty"`
	CommissionPct float64 `json:"commissionPct"`
	Phone         string  `json:"phone"`
	TotalDayGross float64 `json:"totalDayGross"`
}

type WorkOrder struct {
	ID             string  `json:"id"`
	CreatedAt      string  `json:"createdAt"`
	CustomerID     string  `json:"customerId"`
	CustomerName   string  `json:"customerName"`
	VehicleID      string  `json:"vehicleId"`
	Plate          string  `json:"plate"`
	VehicleBrand   string  `json:"vehicleBrand"`
	CurrentKm      int     `json:"currentKm"`
	NextOilKm      int     `json:"nextOilKm"`
	WorkerID       string  `json:"workerId"`
	WorkerName     string  `json:"workerName"`
	Status         string  `json:"status"`
	ServiceDesc    string  `json:"serviceDesc"`
	TotalEstimated float64 `json:"totalEstimated"`
}

type Settlement struct {
	ID               string  `json:"id"`
	Date             string  `json:"date"`
	WorkerID         string  `json:"workerId"`
	WorkerName       string  `json:"workerName"`
	GrossLabor       float64 `json:"grossLabor"`
	CommissionPct    float64 `json:"commissionPct"`
	TechnicianPayout float64 `json:"technicianPayout"`
	CompanyRetention float64 `json:"companyRetention"`
}

type CreateVehicleInput struct {
	Plate        string `json:"plate"`
	Brand        string `json:"brand"`
	VehicleType  string `json:"vehicleType"`
	CustomerID   string `json:"customerId"`
	CustomerName string `json:"customerName"`
	CurrentKm    int    `json:"currentKm"`
	SoatExpiry   string `json:"soatExpiry"`
}

type CreateWorkerInput struct {
	Name          string  `json:"name"`
	DocNumber     string  `json:"docNumber"`
	Specialty     string  `json:"specialty"`
	CommissionPct float64 `json:"commissionPct"`
	Phone         string  `json:"phone"`
}

type CreateWorkOrderInput struct {
	CustomerID     string  `json:"customerId"`
	CustomerName   string  `json:"customerName"`
	VehicleID      string  `json:"vehicleId"`
	WorkerID       string  `json:"workerId"`
	CurrentKm      int     `json:"currentKm"`
	ServiceDesc    string  `json:"serviceDesc"`
	TotalEstimated float64 `json:"totalEstimated"`
}

type InvoiceSyncInput struct {
	IdempotencyKey string
	WorkOrderID    string
	VehicleID      string
	MechanicID     string
	LaborGross     float64
	InvoiceNumber  string
}

type InvoiceSyncResult struct {
	Ok           bool   `json:"ok"`
	Plate        string `json:"plate"`
	VehicleBrand string `json:"vehicleBrand"`
	CurrentKm    int    `json:"currentKm"`
	NextOilKm    int    `json:"nextOilKm"`
	MechanicName string `json:"mechanicName"`
}

type WorkshopState struct {
	NextOrderCode   string       `json:"nextOrderCode"`
	NextWorkerCode  string       `json:"nextWorkerCode"`
	NextVehicleCode string       `json:"nextVehicleCode"`
	Orders          []WorkOrder  `json:"orders"`
	Workers         []Worker     `json:"workers"`
	Settlements     []Settlement `json:"settlements"`
	Vehicles        []Vehicle    `json:"vehicles"`
}

func NormalizePlate(raw string) string {
	clean := strings.ToUpper(strings.TrimSpace(raw))
	clean = strings.ReplaceAll(clean, " ", "")
	return clean
}

func BuildVehicle(id string, in CreateVehicleInput) (Vehicle, error) {
	plate := NormalizePlate(in.Plate)
	if len(plate) < 5 {
		return Vehicle{}, apperr.Validation("La placa del vehículo es obligatoria y debe tener formato válido")
	}
	brand := strings.TrimSpace(in.Brand)
	if brand == "" {
		return Vehicle{}, apperr.Validation("La marca y línea del vehículo son obligatorias")
	}
	if in.CurrentKm < 0 {
		return Vehicle{}, apperr.Validation("El kilometraje actual no puede ser negativo")
	}
	vType := strings.TrimSpace(in.VehicleType)
	if vType == "" {
		vType = "Automóvil"
	}
	custName := strings.TrimSpace(in.CustomerName)
	if custName == "" {
		custName = "Propietario General"
	}
	nextOil := in.CurrentKm + OilChangeIntervalInKm
	return Vehicle{
		ID:              strings.ToLower(strings.TrimSpace(id)),
		Plate:           plate,
		Brand:           brand,
		VehicleType:     vType,
		CustomerID:      strings.TrimSpace(in.CustomerID),
		CustomerName:    custName,
		CurrentKm:       in.CurrentKm,
		NextOilKm:       nextOil,
		NextOilChangeKm: nextOil,
		SoatExpiry:      strings.TrimSpace(in.SoatExpiry),
	}, nil
}

func BuildWorker(code string, in CreateWorkerInput) (Worker, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return Worker{}, apperr.Validation("El nombre del técnico especialista es obligatorio")
	}
	if !money.IsFinite(in.CommissionPct) || in.CommissionPct < 0 || in.CommissionPct > 100 {
		return Worker{}, apperr.Validation("El porcentaje de comisión debe estar entre 0% y 100%")
	}
	specialty := strings.TrimSpace(in.Specialty)
	if specialty == "" {
		specialty = "Mecánica Automotriz General"
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return Worker{
		ID:            strings.ToLower(cleanCode),
		Code:          cleanCode,
		Name:          name,
		DocNumber:     strings.TrimSpace(in.DocNumber),
		Specialty:     specialty,
		CommissionPct: money.RoundCents(in.CommissionPct),
		Phone:         strings.TrimSpace(in.Phone),
		TotalDayGross: 0,
	}, nil
}

func BuildWorkOrder(code string, in CreateWorkOrderInput, veh *Vehicle, workerName string, now time.Time) (WorkOrder, error) {
	if veh == nil {
		return WorkOrder{}, apperr.NotFound("Vehículo no encontrado")
	}
	desc := strings.TrimSpace(in.ServiceDesc)
	if desc == "" {
		return WorkOrder{}, apperr.Validation("La descripción del trabajo o diagnóstico es obligatoria")
	}
	if !money.IsFinite(in.TotalEstimated) || in.TotalEstimated < 0 {
		return WorkOrder{}, apperr.Validation("El valor estimado de la orden no puede ser negativo")
	}
	if in.CurrentKm < 0 {
		return WorkOrder{}, apperr.Validation("El kilometraje de ingreso no puede ser negativo")
	}
	km := in.CurrentKm
	if km == 0 {
		km = veh.CurrentKm
	} else if km < veh.CurrentKm {
		return WorkOrder{}, apperr.Validation("El kilometraje de ingreso no puede ser inferior al kilometraje histórico del vehículo")
	}

	veh.CurrentKm = km
	veh.NextOilKm = km + OilChangeIntervalInKm
	veh.NextOilChangeKm = veh.NextOilKm

	custID := strings.TrimSpace(in.CustomerID)
	if custID == "" {
		custID = veh.CustomerID
	}
	custName := strings.TrimSpace(in.CustomerName)
	if custName == "" {
		custName = veh.CustomerName
	}
	if custName == "" {
		custName = "Cliente Mostrador"
	}

	return WorkOrder{
		ID:             strings.ToUpper(strings.TrimSpace(code)),
		CreatedAt:      now.Format("2006-01-02 15:04"),
		CustomerID:     custID,
		CustomerName:   custName,
		VehicleID:      veh.ID,
		Plate:          veh.Plate,
		VehicleBrand:   veh.Brand,
		CurrentKm:      km,
		NextOilKm:      veh.NextOilKm,
		WorkerID:       strings.TrimSpace(in.WorkerID),
		WorkerName:     strings.TrimSpace(workerName),
		Status:         OrderStatusRecibido,
		ServiceDesc:    desc,
		TotalEstimated: money.RoundCents(in.TotalEstimated),
	}, nil
}

func stageRank(status string) (int, bool) {
	switch status {
	case OrderStatusRecibido:
		return 1, true
	case OrderStatusEnProceso:
		return 2, true
	case OrderStatusListo:
		return 3, true
	case OrderStatusEntregado:
		return 4, true
	default:
		return 0, false
	}
}

func nextStage(status string) (string, error) {
	switch status {
	case OrderStatusRecibido:
		return OrderStatusEnProceso, nil
	case OrderStatusEnProceso:
		return OrderStatusListo, nil
	case OrderStatusListo:
		return OrderStatusEntregado, nil
	case OrderStatusEntregado:
		return "", apperr.Conflict("La orden de trabajo ya se encuentra en estado Entregado")
	default:
		return "", apperr.Validation("Estado actual de la orden inválido")
	}
}

func (o *WorkOrder) AdvanceStage(requested string) error {
	clean := strings.TrimSpace(requested)
	if clean == "Listo para Entrega" {
		clean = OrderStatusListo
	}
	if clean == "" {
		nxt, err := nextStage(o.Status)
		if err != nil {
			return err
		}
		o.Status = nxt
		return nil
	}
	targetRank, ok := stageRank(clean)
	if !ok {
		return apperr.Validation("Estado de orden de trabajo inválido")
	}
	curRank, ok := stageRank(o.Status)
	if !ok {
		return apperr.Validation("Estado actual de orden inválido")
	}
	if targetRank <= curRank {
		return apperr.Validation("Transición de etapa inválida para la orden de trabajo")
	}
	o.Status = clean
	return nil
}

func (w *Worker) Settle(code string, now time.Time) (Settlement, error) {
	if !money.IsFinite(w.TotalDayGross) || w.TotalDayGross <= 0 {
		return Settlement{}, apperr.Conflict("El técnico no registra mano de obra pendiente por liquidar")
	}
	gross := money.RoundCents(w.TotalDayGross)
	payout := money.RoundCents(gross * w.CommissionPct / 100.0)
	retention := money.RoundCents(gross - payout)
	s := Settlement{
		ID:               strings.ToUpper(strings.TrimSpace(code)),
		Date:             now.Format("2006-01-02 15:04"),
		WorkerID:         w.ID,
		WorkerName:       w.Name,
		GrossLabor:       gross,
		CommissionPct:    w.CommissionPct,
		TechnicianPayout: payout,
		CompanyRetention: retention,
	}
	w.TotalDayGross = 0
	return s, nil
}
