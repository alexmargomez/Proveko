package backend

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	hospitalityv1 "github.com/alexmargomez/proveko/proto/hospitality/v1"
	"github.com/alexmargomez/proveko/services/ms-hoteleria/migrations"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

var _ hospitalityv1.HospitalityServiceServer = (*Service)(nil)

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	if db != nil {
		db.RegisterServiceMigration("ms-hoteleria", migrations.SchemaSQL)
	}
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	hospitalityv1.RegisterHospitalityServiceServer(srv, s)
}

func (s *Service) CompleteRoomCheckout(ctx context.Context, req *hospitalityv1.RoomCheckoutEvent) (*hospitalityv1.RoomCheckoutResponse, error) {
	if req == nil || strings.TrimSpace(req.RoomID) == "" {
		return &hospitalityv1.RoomCheckoutResponse{Ok: false}, nil
	}
	tc := authguard.FromContext(ctx)
	targetID := strings.TrimSpace(req.RoomID)
	var roomNumber string

	err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.HotelRooms {
			if d.HotelRooms[i].ID == targetID || strings.EqualFold(d.HotelRooms[i].RoomNumber, targetID) {
				roomNumber = d.HotelRooms[i].RoomNumber
				d.HotelRooms[i].Status = "Disponible"
				d.HotelRooms[i].CheckInCode = ""
				d.HotelRooms[i].GuestID = ""
				d.HotelRooms[i].GuestName = ""
				d.HotelRooms[i].CheckInDate = ""
				d.HotelRooms[i].Nights = 0
				d.HotelRooms[i].ExtrasTotal = 0
				break
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &hospitalityv1.RoomCheckoutResponse{
		Ok:         true,
		RoomNumber: roomNumber,
	}, nil
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/rooms", s.handleGetRooms)
	r.Post("/rooms", s.handleCreateRoom)
	r.With(licensegate.RequireModule("recepcion_habitaciones")).Post("/checkin", s.handleCheckIn)
	r.Post("/rooms/{id}/extra", s.handleAddExtraCharge)

	return r
}

func (s *Service) handleGetRooms(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		rooms     []tenantdb.HotelRoom
		customers []tenantdb.Customer
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		rooms = make([]tenantdb.HotelRoom, len(d.HotelRooms))
		copy(rooms, d.HotelRooms)
		customers = make([]tenantdb.Customer, len(d.Customers))
		copy(customers, d.Customers)
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"nextCheckInCode": s.db.Seq.Peek(tc.DBName, "CHK", 405),
		"rooms":           rooms,
		"customers":       customers,
	})
}

type createRoomReq struct {
	RoomNumber  string  `json:"roomNumber"`
	RoomType    string  `json:"roomType"`
	Floor       string  `json:"floor"`
	NightlyRate float64 `json:"nightlyRate"`
}

func (s *Service) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if !licensegate.HasModule(r.Context(), "recepcion_habitaciones") && !licensegate.HasModule(r.Context(), "tarifas_temporadas") {
		httpx.Error(w, http.StatusForbidden, "No tienes módulo hotelero activo para crear habitaciones")
		return
	}

	var req createRoomReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de habitación inválido")
		return
	}
	roomNumber := strings.TrimSpace(req.RoomNumber)
	if roomNumber == "" || req.NightlyRate <= 0 {
		httpx.Error(w, http.StatusBadRequest, "Número de habitación y tarifa por noche son obligatorios")
		return
	}
	if isNumericOnly(roomNumber) {
		roomNumber = "Habitación " + roomNumber
	}

	roomType := strings.TrimSpace(req.RoomType)
	if roomType == "" {
		roomType = "Estándar Sencilla"
	}
	floor := strings.TrimSpace(req.Floor)
	if floor == "" {
		floor = "Piso 1"
	}

	tc := authguard.FromContext(r.Context())
	newRoom := tenantdb.HotelRoom{
		ID:          strings.ToLower(s.db.Seq.Next(tc.DBName, "RM", 300)),
		RoomNumber:  roomNumber,
		RoomType:    roomType,
		Floor:       floor,
		NightlyRate: req.NightlyRate,
		Status:      "Disponible",
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.HotelRooms = append(d.HotelRooms, newRoom)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":   true,
		"room": newRoom,
	})
}

type checkInReq struct {
	RoomID  string `json:"roomId"`
	GuestID string `json:"guestId"`
	Nights  int    `json:"nights"`
}

func (s *Service) handleCheckIn(w http.ResponseWriter, r *http.Request) {
	var req checkInReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de Check-In inválido")
		return
	}
	req.RoomID = strings.TrimSpace(req.RoomID)
	req.GuestID = strings.TrimSpace(req.GuestID)
	if req.RoomID == "" || req.GuestID == "" {
		httpx.Error(w, http.StatusBadRequest, "Selecciona una habitación disponible y un huésped")
		return
	}
	if req.Nights <= 0 {
		req.Nights = 1
	}

	tc := authguard.FromContext(r.Context())
	errRoomNotFound := errors.New("habitación no encontrada")
	errRoomBusy := errors.New("la habitación seleccionada ya se encuentra ocupada")
	var updatedRoom tenantdb.HotelRoom

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		guestName := "Huésped General"
		for _, c := range d.Customers {
			if c.ID == req.GuestID {
				guestName = c.Name
				break
			}
		}

		for i := range d.HotelRooms {
			if d.HotelRooms[i].ID == req.RoomID {
				if d.HotelRooms[i].Status == "Ocupada" {
					return errRoomBusy
				}
				d.HotelRooms[i].Status = "Ocupada"
				d.HotelRooms[i].CheckInCode = s.db.Seq.Next(tc.DBName, "CHK", 405)
				d.HotelRooms[i].GuestID = req.GuestID
				d.HotelRooms[i].GuestName = guestName
				d.HotelRooms[i].Nights = req.Nights
				d.HotelRooms[i].CheckInDate = time.Now().Format("2006-01-02")
				d.HotelRooms[i].ExtrasTotal = 0
				updatedRoom = d.HotelRooms[i]
				return nil
			}
		}
		return errRoomNotFound
	})
	if errors.Is(err, errRoomBusy) {
		httpx.Error(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, errRoomNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"room": updatedRoom,
	})
}

type extraChargeReq struct {
	Amount  float64 `json:"amount"`
	Concept string  `json:"concept"`
}

func (s *Service) handleAddExtraCharge(w http.ResponseWriter, r *http.Request) {
	if !licensegate.HasModule(r.Context(), "recepcion_habitaciones") {
		httpx.Error(w, http.StatusForbidden, "El módulo recepcion_habitaciones no está habilitado para esta empresa")
		return
	}

	roomID := strings.TrimSpace(chi.URLParam(r, "id"))
	var req extraChargeReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de consumo extra inválido")
		return
	}
	if req.Amount <= 0 {
		httpx.Error(w, http.StatusBadRequest, "El monto del consumo debe ser mayor a cero")
		return
	}

	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("habitación no encontrada")
	errNotOccupied := errors.New("solo se pueden cargar consumos a habitaciones ocupadas")
	var updatedRoom tenantdb.HotelRoom

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.HotelRooms {
			if d.HotelRooms[i].ID == roomID {
				if d.HotelRooms[i].Status != "Ocupada" {
					return errNotOccupied
				}
				d.HotelRooms[i].ExtrasTotal += req.Amount
				updatedRoom = d.HotelRooms[i]
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errNotOccupied) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"room": updatedRoom,
	})
}

func isNumericOnly(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}
