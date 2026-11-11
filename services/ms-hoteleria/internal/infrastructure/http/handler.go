package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-hoteleria/internal/platform/config"
	"ms-hoteleria/internal/platform/httpx"
	"ms-hoteleria/internal/platform/security"
	mshoteleria "ms-hoteleria"
	"ms-hoteleria/internal/application"
	"ms-hoteleria/internal/domain"
)

//go:embed ui_dist/ui.js
var uiBundleJS []byte

type Handler struct {
	app *application.Service
	cfg config.ServiceConfig
	pub ed25519.PublicKey
	rg  *security.ReplayGuard
}

func NewHandler(
	app *application.Service,
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	rg *security.ReplayGuard,
) *Handler {
	return &Handler{
		app: app,
		cfg: cfg,
		pub: pub,
		rg:  rg,
	}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(h.cfg.AllowedOrigins))

	healthFn := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-hoteleria"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/hoteleria/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-hoteleria", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/hoteleria", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/rooms", h.handleGetRooms)
	r.Post("/rooms", h.handleCreateRoom)
	r.Post("/checkin", h.handleCheckIn)
	r.Post("/rooms/{id}/extra", h.handleAddExtraCharge)
	r.Post("/internal-s2s/checkout", h.handleS2SCheckout)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mshoteleria.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetRooms(w http.ResponseWriter, r *http.Request) {
	st, err := h.app.GetState(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"nextCheckInCode": st.NextCheckInCode,
		"rooms":           st.Rooms,
	})
}

func (h *Handler) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateRoomInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	rm, err := h.app.CreateRoom(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":   true,
		"room": rm,
	})
}

func (h *Handler) handleCheckIn(w http.ResponseWriter, r *http.Request) {
	var req domain.CheckInInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	rm, err := h.app.CheckIn(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"room": rm,
	})
}

func (h *Handler) handleAddExtraCharge(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	var req domain.ExtraChargeInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	rm, err := h.app.AddExtraCharge(r.Context(), roomID, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"room": rm,
	})
}

func (h *Handler) handleS2SCheckout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdempotencyKey string `json:"idempotencyKey"`
		RoomID         string `json:"roomId"`
		InvoiceNumber  string `json:"invoiceNumber"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	roomNumber, err := h.app.CompleteRoomCheckout(r.Context(), req.IdempotencyKey, req.RoomID, req.InvoiceNumber)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "roomNumber": roomNumber})
}
