package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-taquilla/internal/platform/httpx"
	"ms-taquilla/internal/platform/security"
	mstaquilla "ms-taquilla"
	"ms-taquilla/internal/application"
	"ms-taquilla/internal/domain"
)

const (
	ServiceKey = "ms-taquilla"
	APIPrefix  = "/api/v1/taquilla"
)

//go:embed ui_dist/ui.js
var uiBundleJS []byte

type Handler struct {
	app            *application.Service
	pubKey         ed25519.PublicKey
	s2sKey         string
	replay         *security.ReplayGuard
	allowedOrigins []string
}

func NewHandler(
	app *application.Service,
	pubKey ed25519.PublicKey,
	s2sKey string,
	replay *security.ReplayGuard,
	allowedOrigins []string,
) http.Handler {
	h := &Handler{
		app:            app,
		pubKey:         pubKey,
		s2sKey:         s2sKey,
		replay:         replay,
		allowedOrigins: allowedOrigins,
	}
	return h.routes()
}

func (h *Handler) routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(h.allowedOrigins))

	healthFn := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": ServiceKey,
		})
	}
	r.Get("/health", healthFn)
	r.Get(APIPrefix+"/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport(ServiceKey, h.pubKey, h.s2sKey, h.replay))
		h.mountProtected(pr)
		pr.Route(APIPrefix, func(sr chi.Router) {
			h.mountProtected(sr)
		})
	})

	return r
}

func (h *Handler) mountProtected(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/all", h.handleGetAll)
	r.Post("/events", h.handleCreateEvent)
	r.Post("/tickets", h.handleCreateTicket)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mstaquilla.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetAll(w http.ResponseWriter, r *http.Request) {
	state, err := h.app.GetAll(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"nextCode":      state.NextCode,
		"nextEventCode": state.NextEventCode,
		"events":        state.Events,
		"tickets":       state.Tickets,
	})
}

func (h *Handler) handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateEventInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateEvent(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"event": created,
	})
}

func (h *Handler) handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateTicketInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateTicket(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"ticket": created,
	})
}
