package memory

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"ms-agenda/internal/platform/apperr"
	"ms-agenda/internal/platform/money"
	"ms-agenda/internal/platform/seqmem"
	"ms-agenda/internal/domain"
)

type tenantBucket struct {
	resources    []*domain.ProfResource
	appointments []*domain.Appointment
	idempotency  map[string][]byte
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantBucket
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantBucket),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantBucket {
	if b, ok := r.tenants[dbName]; ok {
		return b
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	slot := time.Now().UTC().Add(2 * time.Hour).Format("2006-01-02") + " 10:00"

	resCode1 := r.seq.Next(dbName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	resCode2 := r.seq.Next(dbName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	aptCode1 := r.seq.Next(dbName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart)

	res1 := &domain.ProfResource{
		ID:        "res-demo-1",
		Code:      resCode1,
		Name:      "Dra. Camila Restrepo",
		Specialty: "Consultoría Especializada",
		Phone:     "3158402210",
		Active:    true,
		CreatedAt: now,
	}
	res2 := &domain.ProfResource{
		ID:        "res-demo-2",
		Code:      resCode2,
		Name:      "Ing. Sebastián Morales",
		Specialty: "Diagnóstico Técnico",
		Phone:     "3106904415",
		Active:    true,
		CreatedAt: now,
	}
	apt1 := &domain.Appointment{
		ID:                aptCode1,
		Code:              aptCode1,
		ResourceID:        res1.ID,
		ResourceName:      res1.Name,
		ResourceSpecialty: res1.Specialty,
		CustomerID:        "cli-demo-1",
		CustomerName:      "Inversiones del Norte S.A.S.",
		CustomerNit:       "900.312.880-2",
		CustomerPhone:     "6014402290",
		DateTime:          slot,
		ServiceName:       "Valoración inicial y plan de atención",
		Notes:             "Confirmada vía telefónica",
		Status:            domain.DefaultAppointStatus,
		CreatedAt:         now,
	}

	b := &tenantBucket{
		resources:    []*domain.ProfResource{res1, res2},
		appointments: []*domain.Appointment{apt1},
		idempotency:  make(map[string][]byte),
	}
	r.tenants[dbName] = b
	return b
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.AllState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	resources := make([]*domain.ProfResource, len(b.resources))
	for i, item := range b.resources {
		resources[i] = item.Clone()
	}
	appointments := make([]*domain.Appointment, len(b.appointments))
	for i, item := range b.appointments {
		appointments[i] = item.Clone()
	}

	return &domain.AllState{
		NextCode:         r.seq.Peek(dbName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart),
		NextResourceCode: r.seq.Peek(dbName, domain.ResourceSeqPrefix, domain.ResourceSeqStart),
		Resources:        resources,
		Appointments:     appointments,
	}, nil
}

func (r *Repository) CreateResource(_ context.Context, dbName, idemKey string, in domain.CreateResourceInput) (*domain.ProfResource, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if raw, ok := b.idempotency["resource:"+idemKey]; ok {
			var cached domain.ProfResource
			if json.Unmarshal(raw, &cached) == nil {
				return cached.Clone(), nil
			}
		}
	}

	code := r.seq.Next(dbName, domain.ResourceSeqPrefix, domain.ResourceSeqStart)
	now := time.Now().UTC().Format("2006-01-02 15:04")
	res, err := domain.NewProfResource(money.NewID("res"), code, in, now)
	if err != nil {
		return nil, err
	}

	b.resources = append([]*domain.ProfResource{res}, b.resources...)
	if idemKey != "" {
		if raw, err := json.Marshal(res); err == nil {
			b.idempotency["resource:"+idemKey] = raw
		}
	}
	return res.Clone(), nil
}

func (r *Repository) CreateAppointment(_ context.Context, dbName, idemKey string, in domain.CreateAppointmentInput) (*domain.Appointment, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if raw, ok := b.idempotency["appointment:"+idemKey]; ok {
			var cached domain.Appointment
			if json.Unmarshal(raw, &cached) == nil {
				return cached.Clone(), nil
			}
		}
	}

	resID := in.ResolvedResourceID()
	var res *domain.ProfResource
	for _, item := range b.resources {
		if item.ID == resID {
			res = item
			break
		}
	}
	if res == nil {
		return nil, apperr.NotFound("Profesional o recurso de agenda no encontrado")
	}

	normDT, err := domain.NormalizeDateTime(in.DateTime)
	if err != nil {
		return nil, err
	}
	for _, existing := range b.appointments {
		if existing.ResourceID == res.ID && existing.DateTime == normDT {
			return nil, apperr.Conflict("El profesional o recurso seleccionado ya tiene una cita asignada en esa fecha y hora")
		}
	}

	code := r.seq.Next(dbName, domain.AppointmentSeqPrefix, domain.AppointmentSeqStart)
	now := time.Now().UTC().Format("2006-01-02 15:04")
	apt, err := domain.NewAppointment(code, res, in, now)
	if err != nil {
		return nil, err
	}

	b.appointments = append([]*domain.Appointment{apt}, b.appointments...)
	if idemKey != "" {
		if raw, err := json.Marshal(apt); err == nil {
			b.idempotency["appointment:"+idemKey] = raw
		}
	}
	return apt.Clone(), nil
}

func (r *Repository) DeleteAppointment(_ context.Context, dbName, appointmentID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	idx := -1
	for i, item := range b.appointments {
		if item.ID == appointmentID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return apperr.NotFound("Cita no encontrada")
	}
	b.appointments = append(b.appointments[:idx], b.appointments[idx+1:]...)
	return nil
}
