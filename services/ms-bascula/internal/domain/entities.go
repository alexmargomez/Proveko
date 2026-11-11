package domain

import (
	"fmt"
	"strings"
	"time"

	"ms-bascula/internal/platform/apperr"
	"ms-bascula/internal/platform/money"
)

type HeavyVehicle struct {
	ID              string  `json:"id"`
	Code            string  `json:"code"`
	Plate           string  `json:"plate"`
	Brand           string  `json:"brand"`
	AxleConfig      string  `json:"axleConfig"`
	ReferenceTareKg float64 `json:"referenceTareKg"`
}

type Driver struct {
	ID              string `json:"id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	DocNumber       string `json:"docNumber"`
	LicenseCategory string `json:"licenseCategory"`
	Phone           string `json:"phone"`
}

type Carrier struct {
	ID    string `json:"id"`
	Code  string `json:"code"`
	Name  string `json:"name"`
	Nit   string `json:"nit"`
	City  string `json:"city"`
	Phone string `json:"phone"`
}

type CargoRoute struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Description string `json:"description"`
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
}

type ScaleTicket struct {
	ID          string  `json:"id"`
	Date        string  `json:"date"`
	VehicleID   string  `json:"vehicleId"`
	Plate       string  `json:"plate"`
	DriverID    string  `json:"driverId"`
	DriverName  string  `json:"driverName"`
	CarrierID   string  `json:"carrierId"`
	CarrierName string  `json:"carrierName"`
	CargoID     string  `json:"cargoId"`
	CargoDesc   string  `json:"cargoDesc"`
	GrossKg     float64 `json:"grossKg"`
	TareKg      float64 `json:"tareKg"`
	NetKg       float64 `json:"netKg"`
	Status      string  `json:"status"`
}

type CreateHeavyVehicleInput struct {
	Plate           string  `json:"plate"`
	Brand           string  `json:"brand"`
	AxleConfig      string  `json:"axleConfig"`
	ReferenceTareKg float64 `json:"referenceTareKg"`
}

type CreateDriverInput struct {
	Name            string `json:"name"`
	DocNumber       string `json:"docNumber"`
	LicenseCategory string `json:"licenseCategory"`
	Phone           string `json:"phone"`
}

type CreateCarrierInput struct {
	Name  string `json:"name"`
	Nit   string `json:"nit"`
	City  string `json:"city"`
	Phone string `json:"phone"`
}

type CreateCargoRouteInput struct {
	Description string `json:"description"`
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
}

type CreateScaleTicketInput struct {
	VehicleID string  `json:"vehicleId"`
	DriverID  string  `json:"driverId"`
	CarrierID string  `json:"carrierId"`
	CargoID   string  `json:"cargoId"`
	GrossKg   float64 `json:"grossKg"`
	TareKg    float64 `json:"tareKg"`
}

type ScaleState struct {
	NextTicketCode  string         `json:"nextTicketCode"`
	NextVehicleCode string         `json:"nextVehicleCode"`
	NextDriverCode  string         `json:"nextDriverCode"`
	NextCarrierCode string         `json:"nextCarrierCode"`
	NextRouteCode   string         `json:"nextRouteCode"`
	Tickets         []ScaleTicket  `json:"tickets"`
	Vehicles        []HeavyVehicle `json:"vehicles"`
	Drivers         []Driver       `json:"drivers"`
	Carriers        []Carrier      `json:"carriers"`
	Routes          []CargoRoute   `json:"routes"`
}

func NormalizeHeavyPlate(raw string) string {
	clean := strings.ToUpper(strings.TrimSpace(raw))
	return strings.ReplaceAll(clean, " ", "")
}

func BuildHeavyVehicle(code string, in CreateHeavyVehicleInput) (HeavyVehicle, error) {
	plate := NormalizeHeavyPlate(in.Plate)
	if len(plate) < 5 {
		return HeavyVehicle{}, apperr.Validation("La placa del tractocamión o vehículo pesado es obligatoria")
	}
	brand := strings.TrimSpace(in.Brand)
	if brand == "" {
		return HeavyVehicle{}, apperr.Validation("La marca y línea del tractocamión son obligatorias")
	}
	tare := in.ReferenceTareKg
	if tare == 0 {
		tare = 16000
	}
	if !money.IsFinite(tare) || tare <= 0 {
		return HeavyVehicle{}, apperr.Validation("El peso tara de referencia debe ser mayor a cero")
	}
	axle := strings.TrimSpace(in.AxleConfig)
	if axle == "" {
		axle = "C3S3 Tractocamión"
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return HeavyVehicle{
		ID:              strings.ToLower(cleanCode),
		Code:            cleanCode,
		Plate:           plate,
		Brand:           brand,
		AxleConfig:      axle,
		ReferenceTareKg: money.RoundCents(tare),
	}, nil
}

func BuildDriver(code string, in CreateDriverInput) (Driver, error) {
	name := strings.TrimSpace(in.Name)
	doc := strings.TrimSpace(in.DocNumber)
	if name == "" || doc == "" {
		return Driver{}, apperr.Validation("El nombre completo y documento del conductor son obligatorios")
	}
	cat := strings.ToUpper(strings.TrimSpace(in.LicenseCategory))
	if cat == "" {
		cat = "C3"
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return Driver{
		ID:              strings.ToLower(cleanCode),
		Code:            cleanCode,
		Name:            name,
		DocNumber:       doc,
		LicenseCategory: cat,
		Phone:           strings.TrimSpace(in.Phone),
	}, nil
}

func BuildCarrier(code string, in CreateCarrierInput) (Carrier, error) {
	name := strings.TrimSpace(in.Name)
	nit := strings.TrimSpace(in.Nit)
	if name == "" || nit == "" {
		return Carrier{}, apperr.Validation("La razón social y NIT de la empresa transportadora son obligatorios")
	}
	city := strings.TrimSpace(in.City)
	if city == "" {
		city = "Bogotá D.C."
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return Carrier{
		ID:    strings.ToLower(cleanCode),
		Code:  cleanCode,
		Name:  name,
		Nit:   nit,
		City:  city,
		Phone: strings.TrimSpace(in.Phone),
	}, nil
}

func BuildCargoRoute(code string, in CreateCargoRouteInput) (CargoRoute, error) {
	desc := strings.TrimSpace(in.Description)
	if desc == "" {
		return CargoRoute{}, apperr.Validation("La descripción del tipo de carga o ruta es obligatoria")
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return CargoRoute{
		ID:          strings.ToLower(cleanCode),
		Code:        cleanCode,
		Description: desc,
		Origin:      strings.TrimSpace(in.Origin),
		Destination: strings.TrimSpace(in.Destination),
	}, nil
}

func ValidateWeights(grossKg, tareKg float64) (float64, float64, float64, error) {
	if !money.IsFinite(tareKg) || tareKg <= 0 {
		return 0, 0, 0, apperr.Validation("El peso tara debe ser un valor positivo mayor a cero")
	}
	if !money.IsFinite(grossKg) || grossKg <= tareKg {
		return 0, 0, 0, apperr.Validation("El peso bruto debe ser estrictamente mayor al peso tara")
	}
	g := money.RoundCents(grossKg)
	t := money.RoundCents(tareKg)
	n := money.RoundCents(g - t)
	if n <= 0 {
		return 0, 0, 0, apperr.Validation("El peso bruto debe ser estrictamente mayor al peso tara")
	}
	return g, t, n, nil
}

func BuildScaleTicket(
	code string,
	in CreateScaleTicketInput,
	veh HeavyVehicle,
	drv Driver,
	car Carrier,
	rt CargoRoute,
	now time.Time,
) (ScaleTicket, error) {
	gross, tare, net, err := ValidateWeights(in.GrossKg, in.TareKg)
	if err != nil {
		return ScaleTicket{}, err
	}
	cargoDesc := rt.Description
	if rt.Origin != "" && rt.Destination != "" {
		cargoDesc = fmt.Sprintf("%s (%s -> %s)", rt.Description, rt.Origin, rt.Destination)
	}
	return ScaleTicket{
		ID:          strings.ToUpper(strings.TrimSpace(code)),
		Date:        now.Format("2006-01-02 15:04"),
		VehicleID:   veh.ID,
		Plate:       veh.Plate,
		DriverID:    drv.ID,
		DriverName:  drv.Name,
		CarrierID:   car.ID,
		CarrierName: car.Name,
		CargoID:     rt.ID,
		CargoDesc:   cargoDesc,
		GrossKg:     gross,
		TareKg:      tare,
		NetKg:       net,
		Status:      "Pesaje Completado",
	}, nil
}
