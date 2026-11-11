package domain

import (
	"math"
	"strings"

	"ms-taquilla/internal/platform/apperr"
	"ms-taquilla/internal/platform/money"
)

const (
	SchemaName       = "ticketing"
	ModuleKeyTickets = "venta_boletas"

	EventSeqPrefix  = "EVT"
	EventSeqStart   = 3000
	TicketSeqPrefix = "TKT"
	TicketSeqStart  = 5000

	DefaultCustomerName  = "Comprador Mostrador"
	DefaultCustomerNit   = "222222222222"
	DefaultZone          = "General"
	DefaultPaymentMethod = "Efectivo"

	ErrCapacityExceededMsg = "Aforo agotado o insuficiente para la localidad seleccionada"
)

type TicketingEvent struct {
	ID        string  `json:"id"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Venue     string  `json:"venue"`
	EventDate string  `json:"eventDate"`
	Zone      string  `json:"zone"`
	BasePrice float64 `json:"basePrice"`
	Capacity  int     `json:"capacity"`
	SoldCount int     `json:"soldCount"`
	CreatedAt string  `json:"createdAt"`
}

func (e *TicketingEvent) Clone() *TicketingEvent {
	if e == nil {
		return nil
	}
	cp := *e
	return &cp
}

func (e *TicketingEvent) AvailableSeats() int {
	if e == nil || e.Capacity <= 0 {
		return 0
	}
	rem := e.Capacity - e.SoldCount
	if rem < 0 {
		return 0
	}
	return rem
}

type Ticket struct {
	ID            string  `json:"id"`
	Code          string  `json:"code"`
	EventID       string  `json:"eventId"`
	EventName     string  `json:"eventName"`
	Zone          string  `json:"zone"`
	CustomerID    string  `json:"customerId"`
	CustomerName  string  `json:"customerName"`
	CustomerNit   string  `json:"customerNit"`
	Qty           int     `json:"qty"`
	UnitPrice     float64 `json:"unitPrice"`
	Total         float64 `json:"total"`
	PaymentMethod string  `json:"paymentMethod"`
	CreatedAt     string  `json:"createdAt"`
}

func (t *Ticket) Clone() *Ticket {
	if t == nil {
		return nil
	}
	cp := *t
	return &cp
}

type CreateEventInput struct {
	Name      string   `json:"name"`
	Venue     string   `json:"venue"`
	EventDate string   `json:"eventDate"`
	Zone      string   `json:"zone"`
	BasePrice *float64 `json:"basePrice"`
	UnitPrice *float64 `json:"unitPrice"`
	Capacity  int      `json:"capacity"`
}

func (in CreateEventInput) ResolvedBasePrice() float64 {
	if in.BasePrice != nil {
		return *in.BasePrice
	}
	if in.UnitPrice != nil {
		return *in.UnitPrice
	}
	return 0
}

type CreateTicketInput struct {
	EventID       string   `json:"eventId"`
	EventName     string   `json:"eventName"`
	Zone          string   `json:"zone"`
	CustomerID    string   `json:"customerId"`
	CustomerName  string   `json:"customerName"`
	BuyerName     string   `json:"buyerName"`
	CustomerNit   string   `json:"customerNit"`
	BuyerDoc      string   `json:"buyerDoc"`
	Qty           float64  `json:"qty"`
	UnitPrice     *float64 `json:"unitPrice"`
	PaymentMethod string   `json:"paymentMethod"`
}

func (in CreateTicketInput) ResolvedCustomerName() string {
	if s := strings.TrimSpace(in.CustomerName); s != "" {
		return s
	}
	if s := strings.TrimSpace(in.BuyerName); s != "" {
		return s
	}
	return DefaultCustomerName
}

func (in CreateTicketInput) ResolvedCustomerNit() string {
	if s := strings.TrimSpace(in.CustomerNit); s != "" {
		return s
	}
	if s := strings.TrimSpace(in.BuyerDoc); s != "" {
		return s
	}
	return DefaultCustomerNit
}

type AllState struct {
	NextCode      string            `json:"nextCode"`
	NextEventCode string            `json:"nextEventCode"`
	Events        []*TicketingEvent `json:"events"`
	Tickets       []*Ticket         `json:"tickets"`
}

func NewTicketingEvent(id, code string, in CreateEventInput, createdAt string) (*TicketingEvent, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.Validation("El nombre del evento o función es obligatorio")
	}
	rawPrice := in.ResolvedBasePrice()
	if !money.IsFinite(rawPrice) || rawPrice < 0 {
		return nil, apperr.Validation("El precio base del evento debe ser mayor o igual a cero")
	}
	if in.Capacity < 0 {
		return nil, apperr.Validation("El aforo máximo del evento no puede ser negativo")
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = DefaultZone
	}
	return &TicketingEvent{
		ID:        id,
		Code:      code,
		Name:      name,
		Venue:     strings.TrimSpace(in.Venue),
		EventDate: strings.TrimSpace(in.EventDate),
		Zone:      zone,
		BasePrice: money.RoundCents(rawPrice),
		Capacity:  in.Capacity,
		SoldCount: 0,
		CreatedAt: createdAt,
	}, nil
}

func ValidateTicketQty(rawQty float64) (int, error) {
	if !money.IsFinite(rawQty) || rawQty < 1 || math.Trunc(rawQty) != rawQty {
		return 0, apperr.Validation("La cantidad de entradas debe ser un número entero mayor o igual a 1")
	}
	return int(rawQty), nil
}

func CheckEventCapacity(ev *TicketingEvent, qty int) error {
	if ev == nil {
		return nil
	}
	if ev.Capacity > 0 && ev.SoldCount+qty > ev.Capacity {
		return apperr.Conflict(ErrCapacityExceededMsg)
	}
	return nil
}

func NewTicket(code string, ev *TicketingEvent, in CreateTicketInput, createdAt string) (*Ticket, error) {
	qty, err := ValidateTicketQty(in.Qty)
	if err != nil {
		return nil, err
	}

	var eventID, eventName, zone string
	var price float64

	if ev != nil {
		if err := CheckEventCapacity(ev, qty); err != nil {
			return nil, err
		}
		eventID = ev.ID
		eventName = ev.Name
		zone = ev.Zone
		price = ev.BasePrice
	} else {
		eventName = strings.TrimSpace(in.EventName)
		if eventName == "" {
			return nil, apperr.Validation("Debes seleccionar un evento o ingresar el nombre de la función")
		}
		zone = DefaultZone
	}

	if customZone := strings.TrimSpace(in.Zone); customZone != "" {
		zone = customZone
	}
	if in.UnitPrice != nil {
		if !money.IsFinite(*in.UnitPrice) || *in.UnitPrice < 0 {
			return nil, apperr.Validation("El precio unitario de la boleta debe ser mayor o igual a cero")
		}
		price = money.RoundCents(*in.UnitPrice)
	} else {
		price = money.RoundCents(price)
	}

	total := money.RoundCents(float64(qty) * price)
	if !money.IsFinite(total) || total < 0 {
		return nil, apperr.Validation("Total de boleta inválido")
	}

	payMethod := strings.TrimSpace(in.PaymentMethod)
	if payMethod == "" {
		payMethod = DefaultPaymentMethod
	}

	return &Ticket{
		ID:            code,
		Code:          code,
		EventID:       eventID,
		EventName:     eventName,
		Zone:          zone,
		CustomerID:    strings.TrimSpace(in.CustomerID),
		CustomerName:  in.ResolvedCustomerName(),
		CustomerNit:   in.ResolvedCustomerNit(),
		Qty:           qty,
		UnitPrice:     price,
		Total:         total,
		PaymentMethod: payMethod,
		CreatedAt:     createdAt,
	}, nil
}
