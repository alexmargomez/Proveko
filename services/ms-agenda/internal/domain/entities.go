package domain

import (
	"strings"
	"time"

	"ms-agenda/internal/platform/apperr"
	"ms-agenda/internal/platform/money"
)

const (
	SchemaName            = "scheduling"
	ResourceSeqPrefix     = "RES"
	ResourceSeqStart      = 100
	AppointmentSeqPrefix  = "CIT"
	AppointmentSeqStart   = 600
	DefaultSpecialty      = "Especialista General"
	DefaultAppointStatus  = "Programada"
)

type ProfResource struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Specialty string `json:"specialty"`
	Phone     string `json:"phone"`
	Active    bool   `json:"active"`
	CreatedAt string `json:"createdAt"`
}

func (r *ProfResource) Clone() *ProfResource {
	if r == nil {
		return nil
	}
	cp := *r
	return &cp
}

type CreateResourceInput struct {
	Name      string `json:"name"`
	Specialty string `json:"specialty"`
	Phone     string `json:"phone"`
}

func NewProfResource(id, code string, in CreateResourceInput, createdAt string) (*ProfResource, error) {
	name := strings.TrimSpace(in.Name)
	specialty := strings.TrimSpace(in.Specialty)
	phone := strings.TrimSpace(in.Phone)

	if name == "" {
		return nil, apperr.Validation("El nombre del profesional o recurso es obligatorio")
	}
	if specialty == "" {
		specialty = DefaultSpecialty
	}
	if strings.TrimSpace(id) == "" {
		id = money.NewID("res")
	}
	return &ProfResource{
		ID:        id,
		Code:      strings.TrimSpace(code),
		Name:      name,
		Specialty: specialty,
		Phone:     phone,
		Active:    true,
		CreatedAt: createdAt,
	}, nil
}

type Appointment struct {
	ID                string `json:"id"`
	Code              string `json:"code"`
	ResourceID        string `json:"resourceId"`
	ResourceName      string `json:"resourceName"`
	ResourceSpecialty string `json:"resourceSpecialty"`
	CustomerID        string `json:"customerId"`
	CustomerName      string `json:"customerName"`
	CustomerNit       string `json:"customerNit"`
	CustomerPhone     string `json:"customerPhone"`
	DateTime          string `json:"dateTime"`
	ServiceName       string `json:"serviceName"`
	Notes             string `json:"notes"`
	Status            string `json:"status"`
	CreatedAt         string `json:"createdAt"`
}

func (a *Appointment) Clone() *Appointment {
	if a == nil {
		return nil
	}
	cp := *a
	return &cp
}

type CreateAppointmentInput struct {
	ResourceID    string `json:"resourceId"`
	WorkerID      string `json:"workerId"`
	CustomerID    string `json:"customerId"`
	CustomerName  string `json:"customerName"`
	CustomerNit   string `json:"customerNit"`
	CustomerPhone string `json:"customerPhone"`
	DateTime      string `json:"dateTime"`
	ServiceName   string `json:"serviceName"`
	Notes         string `json:"notes"`
}

func (in CreateAppointmentInput) ResolvedResourceID() string {
	if id := strings.TrimSpace(in.ResourceID); id != "" {
		return id
	}
	return strings.TrimSpace(in.WorkerID)
}

func NormalizeDateTime(raw string) (string, error) {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return "", apperr.Validation("La fecha y hora de la cita son obligatorias")
	}
	layouts := []string{
		"2006-01-02T15:04",
		"2006-01-02 15:04",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		time.RFC3339,
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, clean); err == nil {
			return t.Format("2006-01-02 15:04"), nil
		}
	}
	replaced := strings.Join(strings.Fields(strings.ReplaceAll(clean, "T", " ")), " ")
	if len(replaced) < 10 {
		return "", apperr.Validation("El formato de fecha y hora de la cita es inválido")
	}
	return replaced, nil
}

func NewAppointment(code string, resource *ProfResource, in CreateAppointmentInput, createdAt string) (*Appointment, error) {
	if resource == nil || strings.TrimSpace(resource.ID) == "" {
		return nil, apperr.Validation("Selecciona un profesional o recurso válido para agendar la cita")
	}
	normDT, err := NormalizeDateTime(in.DateTime)
	if err != nil {
		return nil, err
	}
	serviceName := strings.TrimSpace(in.ServiceName)
	if serviceName == "" {
		return nil, apperr.Validation("El motivo o servicio solicitado es obligatorio")
	}

	customerID := strings.TrimSpace(in.CustomerID)
	customerName := strings.TrimSpace(in.CustomerName)
	if customerName == "" && customerID != "" {
		customerName = "Cliente " + customerID
	}
	if customerName == "" {
		return nil, apperr.Validation("Ingresa o selecciona el nombre del cliente o paciente")
	}

	cleanCode := strings.TrimSpace(code)
	return &Appointment{
		ID:                cleanCode,
		Code:              cleanCode,
		ResourceID:        resource.ID,
		ResourceName:      resource.Name,
		ResourceSpecialty: resource.Specialty,
		CustomerID:        customerID,
		CustomerName:      customerName,
		CustomerNit:       strings.TrimSpace(in.CustomerNit),
		CustomerPhone:     strings.TrimSpace(in.CustomerPhone),
		DateTime:          normDT,
		ServiceName:       serviceName,
		Notes:             strings.TrimSpace(in.Notes),
		Status:            DefaultAppointStatus,
		CreatedAt:         createdAt,
	}, nil
}

type AllState struct {
	NextCode         string          `json:"nextCode"`
	NextResourceCode string          `json:"nextResourceCode"`
	Resources        []*ProfResource `json:"resources"`
	Appointments     []*Appointment  `json:"appointments"`
}
