package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-hoteleria/internal/platform/apperr"
	"ms-hoteleria/internal/platform/seqmem"
	"ms-hoteleria/internal/domain"
)

const (
	baseRoomSeq    = 304
	baseCheckInSeq = 405
)

type tenantStore struct {
	rooms        []domain.HotelRoom
	idemRooms    map[string]domain.HotelRoom
	idemCheckIn  map[string]domain.HotelRoom
	idemExtra    map[string]domain.HotelRoom
	idemCheckout map[string]string
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantStore
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantStore),
	}
}

func (r *Repository) ensureTenantLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	today := time.Now().Format("2006-01-02")
	nowStamp := time.Now().Add(-2 * time.Hour).Format("2006-01-02 15:04")
	st := &tenantStore{
		rooms: []domain.HotelRoom{
			{
				ID:          "rm-301",
				RoomNumber:  "Habitación 101",
				RoomType:    "Estándar Sencilla",
				Floor:       "Piso 1",
				NightlyRate: 145000,
				Status:      domain.RoomStatusOcupada,
				CheckInCode: "CHK-405",
				GuestID:     "cli-101",
				GuestName:   "Inversiones Andinas S.A.S.",
				GuestDoc:    "900.412.889-1",
				CheckInDate: today,
				Nights:      2,
				ExtrasTotal: 28000,
				Charges: []domain.RoomCharge{
					{
						ID:          "chg-seed-101",
						CheckInCode: "CHK-405",
						Concept:     "Servicio a la Habitación — Desayuno Ejecutivo",
						Amount:      28000,
						Date:        nowStamp,
					},
				},
			},
			{
				ID:          "rm-302",
				RoomNumber:  "Habitación 102",
				RoomType:    "Estándar Doble",
				Floor:       "Piso 1",
				NightlyRate: 185000,
				Status:      domain.RoomStatusDisponible,
				Charges:     []domain.RoomCharge{},
			},
			{
				ID:          "rm-303",
				RoomNumber:  "Habitación 201",
				RoomType:    "Suite Ejecutiva Doble",
				Floor:       "Piso 2",
				NightlyRate: 240000,
				Status:      domain.RoomStatusDisponible,
				Charges:     []domain.RoomCharge{},
			},
			{
				ID:          "rm-304",
				RoomNumber:  "Suite 301",
				RoomType:    "Suite Presidencial / Familiar",
				Floor:       "Piso 3",
				NightlyRate: 320000,
				Status:      domain.RoomStatusDisponible,
				Charges:     []domain.RoomCharge{},
			},
		},
		idemRooms:    make(map[string]domain.HotelRoom),
		idemCheckIn:  make(map[string]domain.HotelRoom),
		idemExtra:    make(map[string]domain.HotelRoom),
		idemCheckout: make(map[string]string),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetState(_ context.Context, dbName string) (domain.HospitalityState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	rooms := make([]domain.HotelRoom, len(st.rooms))
	for i := range st.rooms {
		rooms[i] = st.rooms[i].Clone()
	}
	return domain.HospitalityState{
		NextCheckInCode: r.seq.Peek(dbName, "CHK", baseCheckInSeq),
		Rooms:           rooms,
	}, nil
}

func (r *Repository) CreateRoom(_ context.Context, dbName, idemKey string, in domain.CreateRoomInput) (domain.HotelRoom, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemRooms[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	normalizedNum := domain.NormalizeRoomNumber(in.RoomNumber)
	for _, existing := range st.rooms {
		if strings.EqualFold(existing.RoomNumber, normalizedNum) {
			return domain.HotelRoom{}, apperr.Conflict("Ya existe una habitación registrada con ese número o identificador")
		}
	}

	seqCode := r.seq.Next(dbName, "RM", baseRoomSeq)
	room, err := domain.BuildHotelRoom(seqCode, in)
	if err != nil {
		return domain.HotelRoom{}, err
	}
	st.rooms = append(st.rooms, room.Clone())
	if cleanKey != "" {
		st.idemRooms[cleanKey] = room.Clone()
	}
	return room.Clone(), nil
}

func (r *Repository) CheckIn(_ context.Context, dbName, idemKey string, in domain.CheckInInput) (domain.HotelRoom, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemCheckIn[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	for i := range st.rooms {
		if st.rooms[i].ID == in.RoomID {
			candidate := st.rooms[i].Clone()
			if candidate.Status == domain.RoomStatusOcupada {
				return domain.HotelRoom{}, apperr.Conflict("La habitación seleccionada ya se encuentra ocupada")
			}
			chkCode := r.seq.Next(dbName, "CHK", baseCheckInSeq)
			if err := candidate.ApplyCheckIn(chkCode, in, time.Now()); err != nil {
				return domain.HotelRoom{}, err
			}
			st.rooms[i] = candidate
			if cleanKey != "" {
				st.idemCheckIn[cleanKey] = candidate.Clone()
			}
			return candidate.Clone(), nil
		}
	}
	return domain.HotelRoom{}, apperr.NotFound("Habitación no encontrada")
}

func (r *Repository) AddExtraCharge(_ context.Context, dbName, idemKey, roomID string, in domain.ExtraChargeInput) (domain.HotelRoom, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemExtra[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	for i := range st.rooms {
		if st.rooms[i].ID == roomID {
			candidate := st.rooms[i].Clone()
			if _, err := candidate.ApplyExtraCharge(in, time.Now()); err != nil {
				return domain.HotelRoom{}, err
			}
			st.rooms[i] = candidate
			if cleanKey != "" {
				st.idemExtra[cleanKey] = candidate.Clone()
			}
			return candidate.Clone(), nil
		}
	}
	return domain.HotelRoom{}, apperr.NotFound("Habitación no encontrada")
}

func (r *Repository) CompleteRoomCheckout(_ context.Context, dbName, idemKey, roomID, _ string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemCheckout[cleanKey]; ok {
			return prev, nil
		}
	}

	for i := range st.rooms {
		if st.rooms[i].ID == roomID || strings.EqualFold(st.rooms[i].RoomNumber, roomID) {
			roomNumber := st.rooms[i].CompleteCheckout()
			if cleanKey != "" {
				st.idemCheckout[cleanKey] = roomNumber
			}
			return roomNumber, nil
		}
	}
	return "", apperr.NotFound("Habitación no encontrada")
}
