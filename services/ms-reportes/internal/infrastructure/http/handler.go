package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-reportes/internal/platform/httpx"
	"ms-reportes/internal/platform/security"
	msreportes "ms-reportes"
	"ms-reportes/internal/application"
	"ms-reportes/internal/domain"
)

const (
	ServiceKey = "ms-reportes"
	APIPrefix  = "/api/v1/reportes"
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
	r.Get("/all", h.handleExecutive)
	r.Get("/executive", h.handleExecutive)
	r.Get("/snapshots", h.handleListSnapshots)
	r.Post("/snapshots", h.handleCreateSnapshot)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msreportes.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleExecutive(w http.ResponseWriter, r *http.Request) {
	rep, err := h.app.GetExecutiveReport(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                      true,
		"nextCode":                rep.NextCode,
		"nextSnapshotCode":        rep.NextSnapshotCode,
		"totalSales":              rep.TotalSales,
		"totalCollected":          rep.TotalCollected,
		"totalPendingReceivables": rep.TotalPendingReceivables,
		"totalExpenses":           rep.TotalExpenses,
		"netOperatingProfit":      rep.NetOperatingProfit,
		"inventoryCostValue":      rep.InventoryCostValue,
		"inventorySaleValue":      rep.InventorySaleValue,
		"lowStockCount":           rep.LowStockCount,
		"customersCount":          rep.CustomersCount,
		"snapshots":               rep.Snapshots,
	})
}

func (h *Handler) handleListSnapshots(w http.ResponseWriter, r *http.Request) {
	state, err := h.app.ListSnapshots(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"nextCode":         state.NextCode,
		"nextSnapshotCode": state.NextSnapshotCode,
		"snapshots":        state.Snapshots,
	})
}

func (h *Handler) handleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateSnapshotInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateSnapshot(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"snapshot": created,
	})
}
