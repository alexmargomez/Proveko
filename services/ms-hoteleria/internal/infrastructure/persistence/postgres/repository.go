package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"ms-hoteleria/internal/platform/apperr"
	"ms-hoteleria/internal/platform/dbpool"
	"ms-hoteleria/internal/platform/sequences"
	"ms-hoteleria/internal/domain"
	"ms-hoteleria/migrations"
)

const (
	schemaName     = "hospitality"
	serviceKey     = "ms-hoteleria"
	baseRoomSeq    = 304
	baseCheckInSeq = 405
)

type Repository struct {
	dbMgr  *dbpool.Manager
	seedMu sync.RWMutex
	seeded map[string]bool
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository(dbMgr *dbpool.Manager) *Repository {
	return &Repository{
		dbMgr:  dbMgr,
		seeded: make(map[string]bool),
	}
}

func (r *Repository) openAndSeed(ctx context.Context, dbName string) (*pgxpool.Pool, error) {
	pool, err := r.dbMgr.OpenServicePool(ctx, dbName, serviceKey, migrations.SchemaSQL)
	if err != nil {
		return nil, err
	}

	r.seedMu.RLock()
	done := r.seeded[dbName]
	r.seedMu.RUnlock()
	if done {
		return pool, nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "seed::"+serviceKey+"::"+dbName); err != nil {
		return nil, err
	}

	var hasAny bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM hospitality.rooms)`).Scan(&hasAny); err != nil {
		return nil, err
	}

	if !hasAny {
		today := time.Now().Format("2006-01-02")
		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.rooms (
				id, room_number, room_type, floor, nightly_rate, status,
				check_in_code, guest_id, guest_name, guest_doc, check_in_date, nights, extras_total
			)
			VALUES
				('rm-301', 'Habitación 101', 'Estándar Sencilla', 'Piso 1', 145000, 'Ocupada', 'CHK-405', 'cli-101', 'Inversiones Andinas S.A.S.', '900.412.889-1', $1, 2, 28000),
				('rm-302', 'Habitación 102', 'Estándar Doble', 'Piso 1', 185000, 'Disponible', '', '', '', '', '', 0, 0),
				('rm-303', 'Habitación 201', 'Suite Ejecutiva Doble', 'Piso 2', 240000, 'Disponible', '', '', '', '', '', 0, 0),
				('rm-304', 'Suite 301', 'Suite Presidencial / Familiar', 'Piso 3', 320000, 'Disponible', '', '', '', '', '', 0, 0)
			ON CONFLICT (id) DO NOTHING
		`, today); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.room_charges (id, room_id, check_in_code, concept, amount, recorded_at)
			VALUES ('chg-seed-101', 'rm-301', 'CHK-405', 'Servicio a la Habitación — Desayuno Ejecutivo', 28000, $1)
			ON CONFLICT (id) DO NOTHING
		`, time.Now().Add(-2*time.Hour)); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	r.seedMu.Lock()
	r.seeded[dbName] = true
	r.seedMu.Unlock()
	return pool, nil
}

func (r *Repository) GetState(ctx context.Context, dbName string) (domain.HospitalityState, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.HospitalityState{}, err
	}

	nextChk, err := sequences.PeekSQL(ctx, pool, schemaName, "CHK", baseCheckInSeq)
	if err != nil {
		return domain.HospitalityState{}, err
	}

	rows, err := pool.Query(ctx, `
		SELECT id, room_number, room_type, floor, nightly_rate::float8, status,
		       check_in_code, guest_id, guest_name, guest_doc, check_in_date, nights, extras_total::float8
		FROM hospitality.rooms
		ORDER BY room_number ASC, id ASC
	`)
	if err != nil {
		return domain.HospitalityState{}, err
	}
	defer rows.Close()

	rooms := []domain.HotelRoom{}
	idxByID := make(map[string]int)
	for rows.Next() {
		var rm domain.HotelRoom
		if err := rows.Scan(
			&rm.ID, &rm.RoomNumber, &rm.RoomType, &rm.Floor, &rm.NightlyRate, &rm.Status,
			&rm.CheckInCode, &rm.GuestID, &rm.GuestName, &rm.GuestDoc, &rm.CheckInDate, &rm.Nights, &rm.ExtrasTotal,
		); err != nil {
			return domain.HospitalityState{}, err
		}
		rm.Charges = []domain.RoomCharge{}
		idxByID[rm.ID] = len(rooms)
		rooms = append(rooms, rm)
	}
	if err := rows.Err(); err != nil {
		return domain.HospitalityState{}, err
	}

	chRows, err := pool.Query(ctx, `
		SELECT id, room_id, check_in_code, concept, amount::float8, to_char(recorded_at, 'YYYY-MM-DD HH24:MI')
		FROM hospitality.room_charges
		ORDER BY recorded_at ASC, id ASC
	`)
	if err != nil {
		return domain.HospitalityState{}, err
	}
	defer chRows.Close()

	for chRows.Next() {
		var (
			roomID string
			ch     domain.RoomCharge
		)
		if err := chRows.Scan(&ch.ID, &roomID, &ch.CheckInCode, &ch.Concept, &ch.Amount, &ch.Date); err != nil {
			return domain.HospitalityState{}, err
		}
		if pos, ok := idxByID[roomID]; ok {
			rooms[pos].Charges = append(rooms[pos].Charges, ch)
		}
	}
	if err := chRows.Err(); err != nil {
		return domain.HospitalityState{}, err
	}

	return domain.HospitalityState{
		NextCheckInCode: nextChk,
		Rooms:           rooms,
	}, nil
}

func loadRoomForUpdate(ctx context.Context, tx pgx.Tx, roomID string) (domain.HotelRoom, error) {
	var rm domain.HotelRoom
	err := tx.QueryRow(ctx, `
		SELECT id, room_number, room_type, floor, nightly_rate::float8, status,
		       check_in_code, guest_id, guest_name, guest_doc, check_in_date, nights, extras_total::float8
		FROM hospitality.rooms
		WHERE id = $1
		FOR UPDATE
	`, roomID).Scan(
		&rm.ID, &rm.RoomNumber, &rm.RoomType, &rm.Floor, &rm.NightlyRate, &rm.Status,
		&rm.CheckInCode, &rm.GuestID, &rm.GuestName, &rm.GuestDoc, &rm.CheckInDate, &rm.Nights, &rm.ExtrasTotal,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.HotelRoom{}, apperr.NotFound("Habitación no encontrada")
	}
	if err != nil {
		return domain.HotelRoom{}, err
	}

	rows, err := tx.Query(ctx, `
		SELECT id, check_in_code, concept, amount::float8, to_char(recorded_at, 'YYYY-MM-DD HH24:MI')
		FROM hospitality.room_charges
		WHERE room_id = $1
		ORDER BY recorded_at ASC, id ASC
	`, rm.ID)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	defer rows.Close()

	rm.Charges = []domain.RoomCharge{}
	for rows.Next() {
		var ch domain.RoomCharge
		if err := rows.Scan(&ch.ID, &ch.CheckInCode, &ch.Concept, &ch.Amount, &ch.Date); err != nil {
			return domain.HotelRoom{}, err
		}
		rm.Charges = append(rm.Charges, ch)
	}
	if err := rows.Err(); err != nil {
		return domain.HotelRoom{}, err
	}
	return rm, nil
}

func (r *Repository) CreateRoom(ctx context.Context, dbName, idemKey string, in domain.CreateRoomInput) (domain.HotelRoom, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.HotelRoom{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM hospitality.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "rm:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.HotelRoom
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.HotelRoom{}, err
		}
	}

	normalizedNum := domain.NormalizeRoomNumber(in.RoomNumber)
	var dup bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM hospitality.rooms WHERE lower(room_number) = lower($1))`, normalizedNum).Scan(&dup); err != nil {
		return domain.HotelRoom{}, err
	}
	if dup {
		return domain.HotelRoom{}, apperr.Conflict("Ya existe una habitación registrada con ese número o identificador")
	}

	code, err := sequences.NextSQL(ctx, tx, schemaName, "RM", baseRoomSeq)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	rm, err := domain.BuildHotelRoom(code, in)
	if err != nil {
		return domain.HotelRoom{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO hospitality.rooms (id, room_number, room_type, floor, nightly_rate, status)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, rm.ID, rm.RoomNumber, rm.RoomType, rm.Floor, rm.NightlyRate, rm.Status); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return domain.HotelRoom{}, apperr.Conflict("Ya existe una habitación registrada con ese número o identificador")
		}
		return domain.HotelRoom{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(rm)
		if err != nil {
			return domain.HotelRoom{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "rm:"+cleanKey, raw); err != nil {
			return domain.HotelRoom{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.HotelRoom{}, err
	}
	return rm, nil
}

func (r *Repository) CheckIn(ctx context.Context, dbName, idemKey string, in domain.CheckInInput) (domain.HotelRoom, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.HotelRoom{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM hospitality.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "chk:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.HotelRoom
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.HotelRoom{}, err
		}
	}

	rm, err := loadRoomForUpdate(ctx, tx, in.RoomID)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	if rm.Status == domain.RoomStatusOcupada {
		return domain.HotelRoom{}, apperr.Conflict("La habitación seleccionada ya se encuentra ocupada")
	}

	chkCode, err := sequences.NextSQL(ctx, tx, schemaName, "CHK", baseCheckInSeq)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	if err := rm.ApplyCheckIn(chkCode, in, time.Now()); err != nil {
		return domain.HotelRoom{}, err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM hospitality.room_charges WHERE room_id = $1`, rm.ID); err != nil {
		return domain.HotelRoom{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE hospitality.rooms
		SET status = $1, check_in_code = $2, guest_id = $3, guest_name = $4, guest_doc = $5,
		    check_in_date = $6, nights = $7, extras_total = 0, updated_at = NOW()
		WHERE id = $8
	`, rm.Status, rm.CheckInCode, rm.GuestID, rm.GuestName, rm.GuestDoc, rm.CheckInDate, rm.Nights, rm.ID); err != nil {
		return domain.HotelRoom{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(rm)
		if err != nil {
			return domain.HotelRoom{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "chk:"+cleanKey, raw); err != nil {
			return domain.HotelRoom{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.HotelRoom{}, err
	}
	return rm, nil
}

func (r *Repository) AddExtraCharge(ctx context.Context, dbName, idemKey, roomID string, in domain.ExtraChargeInput) (domain.HotelRoom, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return domain.HotelRoom{}, err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM hospitality.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "ext:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached domain.HotelRoom
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return domain.HotelRoom{}, err
		}
	}

	rm, err := loadRoomForUpdate(ctx, tx, roomID)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	now := time.Now()
	charge, err := rm.ApplyExtraCharge(in, now)
	if err != nil {
		return domain.HotelRoom{}, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO hospitality.room_charges (id, room_id, check_in_code, concept, amount, recorded_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, charge.ID, rm.ID, charge.CheckInCode, charge.Concept, charge.Amount, now); err != nil {
		return domain.HotelRoom{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE hospitality.rooms
		SET extras_total = $1, updated_at = NOW()
		WHERE id = $2
	`, rm.ExtrasTotal, rm.ID); err != nil {
		return domain.HotelRoom{}, err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(rm)
		if err != nil {
			return domain.HotelRoom{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "ext:"+cleanKey, raw); err != nil {
			return domain.HotelRoom{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.HotelRoom{}, err
	}
	return rm, nil
}

func (r *Repository) CompleteRoomCheckout(ctx context.Context, dbName, idemKey, roomID, _ string) (string, error) {
	pool, err := r.openAndSeed(ctx, dbName)
	if err != nil {
		return "", err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		var raw []byte
		err := tx.QueryRow(ctx, `SELECT response_json FROM hospitality.idempotency_keys WHERE idem_key = $1 FOR UPDATE`, "out:"+cleanKey).Scan(&raw)
		if err == nil {
			var cached struct {
				RoomNumber string `json:"roomNumber"`
			}
			if jsonErr := json.Unmarshal(raw, &cached); jsonErr == nil {
				return cached.RoomNumber, nil
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return "", err
		}
	}

	var matchedID, roomNumber string
	err = tx.QueryRow(ctx, `
		SELECT id, room_number FROM hospitality.rooms
		WHERE id = $1 OR lower(room_number) = lower($1)
		FOR UPDATE
	`, roomID).Scan(&matchedID, &roomNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", apperr.NotFound("Habitación no encontrada")
	}
	if err != nil {
		return "", err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM hospitality.room_charges WHERE room_id = $1`, matchedID); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE hospitality.rooms
		SET status = $1, check_in_code = '', guest_id = '', guest_name = '', guest_doc = '',
		    check_in_date = '', nights = 0, extras_total = 0, updated_at = NOW()
		WHERE id = $2
	`, domain.RoomStatusDisponible, matchedID); err != nil {
		return "", err
	}

	if cleanKey != "" {
		raw, err := json.Marshal(map[string]string{"roomNumber": roomNumber})
		if err != nil {
			return "", err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO hospitality.idempotency_keys (idem_key, response_json) VALUES ($1, $2)
			ON CONFLICT (idem_key) DO NOTHING
		`, "out:"+cleanKey, raw); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return roomNumber, nil
}
