package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-bascula/internal/platform/config"
	"ms-bascula/internal/platform/httpx"
	"ms-bascula/internal/platform/security"
	msbascula "ms-bascula"
	"ms-bascula/internal/application"
	"ms-bascula/internal/domain"
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-bascula"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/bascula/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-bascula", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/bascula", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/all", h.handleGetAll)
	r.Post("/vehicles", h.handleCreateVehicle)
	r.Post("/drivers", h.handleCreateDriver)
	r.Post("/carriers", h.handleCreateCarrier)
	r.Post("/routes", h.handleCreateRoute)
	r.Post("/tickets", h.handleCreateTicket)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msbascula.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetAll(w http.ResponseWriter, r *http.Request) {
	st, err := h.app.GetState(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"nextTicketCode":  st.NextTicketCode,
		"nextVehicleCode": st.NextVehicleCode,
		"nextDriverCode":  st.NextDriverCode,
		"nextCarrierCode": st.NextCarrierCode,
		"nextRouteCode":   st.NextRouteCode,
		"tickets":         st.Tickets,
		"vehicles":        st.Vehicles,
		"drivers":         st.Drivers,
		"carriers":        st.Carriers,
		"routes":          st.Routes,
	})
}

func (h *Handler) handleCreateVehicle(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateHeavyVehicleInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	veh, err := h.app.CreateVehicle(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"vehicle": veh,
	})
}

func (h *Handler) handleCreateDriver(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateDriverInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	drv, err := h.app.CreateDriver(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"driver": drv,
	})
}

func (h *Handler) handleCreateCarrier(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateCarrierInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	car, err := h.app.CreateCarrier(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"carrier": car,
	})
}

func (h *Handler) handleCreateRoute(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateCargoRouteInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	rt, err := h.app.CreateRoute(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"route": rt,
	})
}

func (h *Handler) handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateScaleTicketInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	tk, err := h.app.CreateTicket(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"ticket": tk,
	})
}
