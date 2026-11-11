package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-taquilla/internal/platform/apperr"
	"ms-taquilla/internal/platform/dbpool"
	"ms-taquilla/internal/platform/money"
	"ms-taquilla/internal/platform/sequences"
	"ms-taquilla/internal/domain"
	"ms-taquilla/migrations"
)

const seedMarkerPrefix = "__SEEDED__"

type Repository struct {
	dbMgr  *dbpool.Manager
	mu     sync.RWMutex
	seeded map[string]bool
}

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func (r *Repository) pool(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	p, err := r.dbMgr.OpenServicePool(ctx, dbName, "ms-taquilla", migrations.SchemaSQL)
	if err != nil {
		return nil, err
	}
	if err := r.ensureSeeded(ctx, p, dbName); err != nil {
		return nil, err
	}
	return p, nil
}

func (r *Repository) ensureSeeded(ctx context.Context, p *pgxpool.Pool, dbName string) error {
	r.mu.RLock()
	done := r.seeded[dbName]
	r.mu.RUnlock()
	if done {
		return nil
	}

	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, dbName+"::ms-taquilla::seed"); err != nil {
		return err
	}

	var marker int
	err = tx.QueryRow(ctx, `SELECT current_val FROM ticketing.seq_counters WHERE prefix = $1`, seedMarkerPrefix).Scan(&marker)
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		r.mu.Lock()
		r.seeded[dbName] = true
		r.mu.Unlock()
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	evDate := time.Now().UTC().AddDate(0, 0, 7).Format("2006-01-02")

	evCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EventSeqPrefix, domain.EventSeqStart)
	if err != nil {
		return err
	}
	evCode2, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EventSeqPrefix, domain.EventSeqStart)
	if err != nil {
		return err
	}
	tktCode1, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.TicketSeqPrefix, domain.TicketSeqStart)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO ticketing.events (
			id, code, name, venue, event_date, zone, base_price, capacity, sold_count, created_at
		) VALUES
			('evt-demo-1', $1, 'Gala Sinfónica Principal', 'Auditorio Central', $3, 'VIP / Preferencial', 85000, 120, 2, $4),
			('evt-demo-2', $2, 'Pasadía General Centro Recreativo', 'Sede Campestre', $3, 'General', 35000, 300, 0, $4)
		ON CONFLICT DO NOTHING
	`, evCode1, evCode2, evDate, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO ticketing.tickets (
			id, code, event_id, event_name, zone, customer_id, customer_name, customer_nit,
			qty, unit_price, total, payment_method, created_at
		) VALUES (
			$1, $1, 'evt-demo-1', 'Gala Sinfónica Principal', 'VIP / Preferencial',
			'cli-demo-1', 'Comercializadora Andina S.A.S.', '900.415.220-8',
			2, 85000, 170000, 'Tarjeta / Datáfono', $2
		) ON CONFLICT DO NOTHING
	`, tktCode1, now); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO ticketing.seq_counters (prefix, current_val) VALUES ($1, 1)
		ON CONFLICT (prefix) DO NOTHING
	`, seedMarkerPrefix); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	r.mu.Lock()
	r.seeded[dbName] = true
	r.mu.Unlock()
	return nil
}

func (r *Repository) GetAll(ctx context.Context, dbName string) (*domain.AllState, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}

	nextTkt, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.TicketSeqPrefix, domain.TicketSeqStart)
	if err != nil {
		return nil, err
	}
	nextEvt, err := sequences.PeekSQL(ctx, p, domain.SchemaName, domain.EventSeqPrefix, domain.EventSeqStart)
	if err != nil {
		return nil, err
	}

	eRows, err := p.Query(ctx, `
		SELECT id, code, name, venue, event_date, zone, base_price::float8, capacity, sold_count, created_at
		FROM ticketing.events
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer eRows.Close()

	events := []*domain.TicketingEvent{}
	for eRows.Next() {
		var item domain.TicketingEvent
		if err := eRows.Scan(
			&item.ID, &item.Code, &item.Name, &item.Venue, &item.EventDate,
			&item.Zone, &item.BasePrice, &item.Capacity, &item.SoldCount, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, &item)
	}
	if err := eRows.Err(); err != nil {
		return nil, err
	}

	tRows, err := p.Query(ctx, `
		SELECT id, code, COALESCE(event_id, ''), event_name, zone, customer_id, customer_name, customer_nit,
		       qty, unit_price::float8, total::float8, payment_method, created_at
		FROM ticketing.tickets
		ORDER BY created_at DESC, code DESC
	`)
	if err != nil {
		return nil, err
	}
	defer tRows.Close()

	tickets := []*domain.Ticket{}
	for tRows.Next() {
		var item domain.Ticket
		if err := tRows.Scan(
			&item.ID, &item.Code, &item.EventID, &item.EventName, &item.Zone,
			&item.CustomerID, &item.CustomerName, &item.CustomerNit,
			&item.Qty, &item.UnitPrice, &item.Total, &item.PaymentMethod, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		tickets = append(tickets, &item)
	}
	if err := tRows.Err(); err != nil {
		return nil, err
	}

	return &domain.AllState{
		NextCode:      nextTkt,
		NextEventCode: nextEvt,
		Events:        events,
		Tickets:       tickets,
	}, nil
}

func (r *Repository) CreateEvent(ctx context.Context, dbName, idemKey string, in domain.CreateEventInput) (*domain.TicketingEvent, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if idemKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `
			SELECT response_json FROM ticketing.idempotency_keys
			WHERE scope = 'event' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.TicketingEvent
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewTicketingEvent("tmp", "TMP", in, now); err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.EventSeqPrefix, domain.EventSeqStart)
	if err != nil {
		return nil, err
	}
	ev, err := domain.NewTicketingEvent(money.NewID("evt"), code, in, now)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO ticketing.events (
			id, code, name, venue, event_date, zone, base_price, capacity, sold_count, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, ev.ID, ev.Code, ev.Name, ev.Venue, ev.EventDate, ev.Zone, ev.BasePrice, ev.Capacity, ev.SoldCount, ev.CreatedAt); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(ev)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ticketing.idempotency_keys (scope, idem_key, response_json)
			VALUES ('event', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ev, nil
}

func (r *Repository) CreateTicket(ctx context.Context, dbName, idemKey string, in domain.CreateTicketInput) (*domain.Ticket, error) {
	p, err := r.pool(ctx, dbName)
	if err != nil {
		return nil, err
	}
	tx, err := p.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if idemKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `
			SELECT response_json FROM ticketing.idempotency_keys
			WHERE scope = 'ticket' AND idem_key = $1
		`, idemKey).Scan(&raw)
		if err == nil {
			var cached domain.Ticket
			if json.Unmarshal(raw, &cached) == nil {
				return &cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	var matchedEvent *domain.TicketingEvent
	evID := strings.TrimSpace(in.EventID)
	evName := strings.TrimSpace(in.EventName)
	zone := strings.TrimSpace(in.Zone)

	if evID != "" {
		var ev domain.TicketingEvent
		err := tx.QueryRow(ctx, `
			SELECT id, code, name, venue, event_date, zone, base_price::float8, capacity, sold_count, created_at
			FROM ticketing.events
			WHERE id = $1 OR code = $1
			FOR UPDATE
		`, evID).Scan(
			&ev.ID, &ev.Code, &ev.Name, &ev.Venue, &ev.EventDate,
			&ev.Zone, &ev.BasePrice, &ev.Capacity, &ev.SoldCount, &ev.CreatedAt,
		)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("Evento o función no encontrado")
		}
		if err != nil {
			return nil, err
		}
		matchedEvent = &ev
	} else if evName != "" {
		var ev domain.TicketingEvent
		err := tx.QueryRow(ctx, `
			SELECT id, code, name, venue, event_date, zone, base_price::float8, capacity, sold_count, created_at
			FROM ticketing.events
			WHERE LOWER(name) = LOWER($1) AND ($2 = '' OR LOWER(zone) = LOWER($2))
			ORDER BY created_at DESC
			LIMIT 1
			FOR UPDATE
		`, evName, zone).Scan(
			&ev.ID, &ev.Code, &ev.Name, &ev.Venue, &ev.EventDate,
			&ev.Zone, &ev.BasePrice, &ev.Capacity, &ev.SoldCount, &ev.CreatedAt,
		)
		if err == nil {
			matchedEvent = &ev
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewTicket("TMP", matchedEvent, in, now); err != nil {
		return nil, err
	}

	code, err := sequences.NextSQL(ctx, tx, domain.SchemaName, domain.TicketSeqPrefix, domain.TicketSeqStart)
	if err != nil {
		return nil, err
	}
	tkt, err := domain.NewTicket(code, matchedEvent, in, now)
	if err != nil {
		return nil, err
	}

	if matchedEvent != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE ticketing.events
			SET sold_count = sold_count + $1
			WHERE id = $2
		`, tkt.Qty, matchedEvent.ID); err != nil {
			return nil, err
		}
	}

	var eventIDNullable any
	if tkt.EventID != "" {
		eventIDNullable = tkt.EventID
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO ticketing.tickets (
			id, code, event_id, event_name, zone, customer_id, customer_name, customer_nit,
			qty, unit_price, total, payment_method, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`,
		tkt.ID, tkt.Code, eventIDNullable, tkt.EventName, tkt.Zone,
		tkt.CustomerID, tkt.CustomerName, tkt.CustomerNit,
		tkt.Qty, tkt.UnitPrice, tkt.Total, tkt.PaymentMethod, tkt.CreatedAt,
	); err != nil {
		return nil, err
	}

	if idemKey != "" {
		raw, err := json.Marshal(tkt)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO ticketing.idempotency_keys (scope, idem_key, response_json)
			VALUES ('ticket', $1, $2)
		`, idemKey, raw); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return tkt, nil
}
