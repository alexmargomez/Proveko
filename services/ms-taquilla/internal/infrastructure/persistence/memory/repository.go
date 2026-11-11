package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-taquilla/internal/platform/apperr"
	"ms-taquilla/internal/platform/money"
	"ms-taquilla/internal/platform/seqmem"
	"ms-taquilla/internal/domain"
)

type tenantBucket struct {
	events      []*domain.TicketingEvent
	tickets     []*domain.Ticket
	idemEvents  map[string]*domain.TicketingEvent
	idemTickets map[string]*domain.Ticket
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	buckets map[string]*tenantBucket
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		buckets: make(map[string]*tenantBucket),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantBucket {
	if b, ok := r.buckets[dbName]; ok {
		return b
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	evDate := time.Now().UTC().AddDate(0, 0, 7).Format("2006-01-02")

	evCode1 := r.seq.Next(dbName, domain.EventSeqPrefix, domain.EventSeqStart)
	evCode2 := r.seq.Next(dbName, domain.EventSeqPrefix, domain.EventSeqStart)
	tktCode1 := r.seq.Next(dbName, domain.TicketSeqPrefix, domain.TicketSeqStart)

	b := &tenantBucket{
		events: []*domain.TicketingEvent{
			{
				ID:        "evt-demo-1",
				Code:      evCode1,
				Name:      "Gala Sinfónica Principal",
				Venue:     "Auditorio Central",
				EventDate: evDate,
				Zone:      "VIP / Preferencial",
				BasePrice: 85000,
				Capacity:  120,
				SoldCount: 2,
				CreatedAt: now,
			},
			{
				ID:        "evt-demo-2",
				Code:      evCode2,
				Name:      "Pasadía General Centro Recreativo",
				Venue:     "Sede Campestre",
				EventDate: evDate,
				Zone:      "General",
				BasePrice: 35000,
				Capacity:  300,
				SoldCount: 0,
				CreatedAt: now,
			},
		},
		tickets: []*domain.Ticket{
			{
				ID:            tktCode1,
				Code:          tktCode1,
				EventID:       "evt-demo-1",
				EventName:     "Gala Sinfónica Principal",
				Zone:          "VIP / Preferencial",
				CustomerID:    "cli-demo-1",
				CustomerName:  "Comercializadora Andina S.A.S.",
				CustomerNit:   "900.415.220-8",
				Qty:           2,
				UnitPrice:     85000,
				Total:         170000,
				PaymentMethod: "Tarjeta / Datáfono",
				CreatedAt:     now,
			},
		},
		idemEvents:  make(map[string]*domain.TicketingEvent),
		idemTickets: make(map[string]*domain.Ticket),
	}
	r.buckets[dbName] = b
	return b
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.AllState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	events := make([]*domain.TicketingEvent, len(b.events))
	for i, ev := range b.events {
		events[i] = ev.Clone()
	}
	tickets := make([]*domain.Ticket, len(b.tickets))
	for i, tkt := range b.tickets {
		tickets[i] = tkt.Clone()
	}

	return &domain.AllState{
		NextCode:      r.seq.Peek(dbName, domain.TicketSeqPrefix, domain.TicketSeqStart),
		NextEventCode: r.seq.Peek(dbName, domain.EventSeqPrefix, domain.EventSeqStart),
		Events:        events,
		Tickets:       tickets,
	}, nil
}

func (r *Repository) CreateEvent(_ context.Context, dbName, idemKey string, in domain.CreateEventInput) (*domain.TicketingEvent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemEvents[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	// Validate before advancing sequence
	if _, err := domain.NewTicketingEvent("tmp", "TMP", in, now); err != nil {
		return nil, err
	}

	code := r.seq.Next(dbName, domain.EventSeqPrefix, domain.EventSeqStart)
	ev, err := domain.NewTicketingEvent(money.NewID("evt"), code, in, now)
	if err != nil {
		return nil, err
	}

	b.events = append([]*domain.TicketingEvent{ev.Clone()}, b.events...)
	if idemKey != "" {
		b.idemEvents[idemKey] = ev.Clone()
	}
	return ev.Clone(), nil
}

func (r *Repository) CreateTicket(_ context.Context, dbName, idemKey string, in domain.CreateTicketInput) (*domain.Ticket, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemTickets[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	var matchedEvent *domain.TicketingEvent
	evID := strings.TrimSpace(in.EventID)
	evName := strings.TrimSpace(in.EventName)
	zone := strings.TrimSpace(in.Zone)

	if evID != "" {
		for _, ev := range b.events {
			if ev.ID == evID || ev.Code == evID {
				matchedEvent = ev
				break
			}
		}
		if matchedEvent == nil {
			return nil, apperr.NotFound("Evento o función no encontrado")
		}
	} else if evName != "" {
		for _, ev := range b.events {
			if strings.EqualFold(ev.Name, evName) && (zone == "" || strings.EqualFold(ev.Zone, zone)) {
				matchedEvent = ev
				break
			}
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewTicket("TMP", matchedEvent, in, now); err != nil {
		return nil, err
	}

	code := r.seq.Next(dbName, domain.TicketSeqPrefix, domain.TicketSeqStart)
	tkt, err := domain.NewTicket(code, matchedEvent, in, now)
	if err != nil {
		return nil, err
	}

	if matchedEvent != nil {
		matchedEvent.SoldCount += tkt.Qty
	}

	b.tickets = append([]*domain.Ticket{tkt.Clone()}, b.tickets...)
	if idemKey != "" {
		b.idemTickets[idemKey] = tkt.Clone()
	}
	return tkt.Clone(), nil
}
