package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-compras/internal/platform/httpx"
	"ms-compras/internal/platform/security"
	mscompras "ms-compras"
	"ms-compras/internal/application"
	"ms-compras/internal/domain"
)

const (
	ServiceKey = "ms-compras"
	APIPrefix  = "/api/v1/compras"
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
	r.Post("/suppliers", h.handleCreateSupplier)
	r.Delete("/suppliers/{id}", h.handleDeleteSupplier)
	r.Post("/orders", h.handleCreateOrder)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mscompras.ManifestJSON)
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
		"ok":               true,
		"nextSupplierCode": state.NextSupplierCode,
		"nextOrderCode":    state.NextOrderCode,
		"suppliers":        state.Suppliers,
		"orders":           state.Orders,
	})
}

func (h *Handler) handleCreateSupplier(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateSupplierInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateSupplier(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"supplier": created,
	})
}

func (h *Handler) handleDeleteSupplier(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.app.DeleteSupplier(r.Context(), id); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"deletedId": id,
	})
}

func (h *Handler) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateOrderInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateOrder(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"order": created,
	})
}
