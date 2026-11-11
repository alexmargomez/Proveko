package domain

import (
	"strings"
	"time"
	"unicode"

	"ms-hoteleria/internal/platform/apperr"
	"ms-hoteleria/internal/platform/money"
)

const (
	RoomStatusDisponible = "Disponible"
	RoomStatusOcupada    = "Ocupada"
)

type RoomCharge struct {
	ID          string  `json:"id"`
	CheckInCode string  `json:"checkInCode"`
	Concept     string  `json:"concept"`
	Amount      float64 `json:"amount"`
	Date        string  `json:"date"`
}

type HotelRoom struct {
	ID          string       `json:"id"`
	RoomNumber  string       `json:"roomNumber"`
	RoomType    string       `json:"roomType"`
	Floor       string       `json:"floor"`
	NightlyRate float64      `json:"nightlyRate"`
	Status      string       `json:"status"`
	CheckInCode string       `json:"checkInCode"`
	GuestID     string       `json:"guestId"`
	GuestName   string       `json:"guestName"`
	GuestDoc    string       `json:"guestDoc"`
	CheckInDate string       `json:"checkInDate"`
	Nights      int          `json:"nights"`
	ExtrasTotal float64      `json:"extrasTotal"`
	Charges     []RoomCharge `json:"charges"`
}

func (r HotelRoom) Clone() HotelRoom {
	ch := make([]RoomCharge, len(r.Charges))
	copy(ch, r.Charges)
	r.Charges = ch
	return r
}

type CreateRoomInput struct {
	RoomNumber  string  `json:"roomNumber"`
	RoomType    string  `json:"roomType"`
	Floor       string  `json:"floor"`
	NightlyRate float64 `json:"nightlyRate"`
}

type CheckInInput struct {
	RoomID    string `json:"roomId"`
	GuestID   string `json:"guestId"`
	GuestName string `json:"guestName"`
	GuestDoc  string `json:"guestDoc"`
	Nights    int    `json:"nights"`
}

type ExtraChargeInput struct {
	Amount  float64 `json:"amount"`
	Concept string  `json:"concept"`
}

type HospitalityState struct {
	NextCheckInCode string      `json:"nextCheckInCode"`
	Rooms           []HotelRoom `json:"rooms"`
}

func NormalizeRoomNumber(raw string) string {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return ""
	}
	allDigits := true
	for _, ch := range clean {
		if !unicode.IsDigit(ch) {
			allDigits = false
			break
		}
	}
	if allDigits {
		return "Habitación " + clean
	}
	return clean
}

func BuildHotelRoom(id string, in CreateRoomInput) (HotelRoom, error) {
	roomNumber := NormalizeRoomNumber(in.RoomNumber)
	if roomNumber == "" {
		return HotelRoom{}, apperr.Validation("El número o nombre de la habitación es obligatorio")
	}
	if !money.IsFinite(in.NightlyRate) || in.NightlyRate <= 0 {
		return HotelRoom{}, apperr.Validation("La tarifa por noche debe ser un valor positivo mayor a cero")
	}
	roomType := strings.TrimSpace(in.RoomType)
	if roomType == "" {
		roomType = "Estándar Sencilla"
	}
	floor := strings.TrimSpace(in.Floor)
	if floor == "" {
		floor = "Piso 1"
	}
	return HotelRoom{
		ID:          strings.ToLower(strings.TrimSpace(id)),
		RoomNumber:  roomNumber,
		RoomType:    roomType,
		Floor:       floor,
		NightlyRate: money.RoundCents(in.NightlyRate),
		Status:      RoomStatusDisponible,
		Charges:     []RoomCharge{},
	}, nil
}

func ValidateCheckInInput(in CheckInInput) (CheckInInput, error) {
	roomID := strings.TrimSpace(in.RoomID)
	guestID := strings.TrimSpace(in.GuestID)
	guestName := strings.TrimSpace(in.GuestName)
	guestDoc := strings.TrimSpace(in.GuestDoc)
	if roomID == "" {
		return CheckInInput{}, apperr.Validation("Debes seleccionar una habitación disponible")
	}
	if guestName == "" && guestID == "" {
		return CheckInInput{}, apperr.Validation("Debes indicar los datos del huésped para el Check-In")
	}
	if guestName == "" {
		guestName = "Huésped Registrado (" + guestID + ")"
	}
	if in.Nights < 1 {
		return CheckInInput{}, apperr.Validation("La estadía mínima para Check-In es de 1 noche")
	}
	return CheckInInput{
		RoomID:    roomID,
		GuestID:   guestID,
		GuestName: guestName,
		GuestDoc:  guestDoc,
		Nights:    in.Nights,
	}, nil
}

func (r *HotelRoom) ApplyCheckIn(checkInCode string, in CheckInInput, now time.Time) error {
	if r.Status == RoomStatusOcupada {
		return apperr.Conflict("La habitación seleccionada ya se encuentra ocupada")
	}
	norm, err := ValidateCheckInInput(in)
	if err != nil {
		return err
	}
	r.Status = RoomStatusOcupada
	r.CheckInCode = strings.ToUpper(strings.TrimSpace(checkInCode))
	r.GuestID = norm.GuestID
	r.GuestName = norm.GuestName
	r.GuestDoc = norm.GuestDoc
	r.Nights = norm.Nights
	r.CheckInDate = now.Format("2006-01-02")
	r.ExtrasTotal = 0
	r.Charges = []RoomCharge{}
	return nil
}

func (r *HotelRoom) ApplyExtraCharge(in ExtraChargeInput, now time.Time) (RoomCharge, error) {
	if r.Status != RoomStatusOcupada {
		return RoomCharge{}, apperr.Conflict("Solo se pueden cargar consumos adicionales a habitaciones ocupadas")
	}
	if !money.IsFinite(in.Amount) || in.Amount <= 0 {
		return RoomCharge{}, apperr.Validation("El valor del consumo adicional debe ser mayor a cero")
	}
	concept := strings.TrimSpace(in.Concept)
	if concept == "" {
		return RoomCharge{}, apperr.Validation("El concepto del consumo a la habitación es obligatorio")
	}
	charge := RoomCharge{
		ID:          money.NewID("chg"),
		CheckInCode: r.CheckInCode,
		Concept:     concept,
		Amount:      money.RoundCents(in.Amount),
		Date:        now.Format("2006-01-02 15:04"),
	}
	r.Charges = append(r.Charges, charge)
	r.ExtrasTotal = money.RoundCents(r.ExtrasTotal + charge.Amount)
	return charge, nil
}

func (r *HotelRoom) CompleteCheckout() string {
	num := r.RoomNumber
	r.Status = RoomStatusDisponible
	r.CheckInCode = ""
	r.GuestID = ""
	r.GuestName = ""
	r.GuestDoc = ""
	r.CheckInDate = ""
	r.Nights = 0
	r.ExtrasTotal = 0
	r.Charges = []RoomCharge{}
	return num
}
