package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-comandas/internal/platform/config"
	"ms-comandas/internal/platform/httpx"
	"ms-comandas/internal/platform/security"
	mscomandas "ms-comandas"
	"ms-comandas/internal/application"
	"ms-comandas/internal/domain"
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-comandas"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/comandas/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-comandas", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/comandas", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/tables", h.handleGetState)
	r.Post("/tables", h.handleCreateTable)
	r.Post("/menu-items", h.handleCreateMenuItem)
	r.Post("/tables/{id}/items", h.handleAddItem)
	r.Delete("/tables/{id}/items/{itemId}", h.handleDeleteItem)
	r.Post("/tables/{id}/send-kitchen", h.handleSendKitchen)
	r.Post("/tables/{id}/ready", h.handleMarkReady)
	r.Post("/internal-s2s/clear-table", h.handleS2SClearTable)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mscomandas.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetState(w http.ResponseWriter, r *http.Request) {
	st, err := h.app.GetState(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"nextMenuCode": st.NextMenuCode,
		"tables":       st.Tables,
		"products":     st.Products,
	})
}

func (h *Handler) handleCreateTable(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateTableInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	tbl, err := h.app.CreateTable(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"table": tbl,
	})
}

func (h *Handler) handleCreateMenuItem(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateMenuItemInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	item, err := h.app.CreateMenuItem(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"menuItem": item,
	})
}

func (h *Handler) handleAddItem(w http.ResponseWriter, r *http.Request) {
	tableID := chi.URLParam(r, "id")
	var req domain.AddOrderItemInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	tbl, err := h.app.AddItemToTable(r.Context(), tableID, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": tbl,
	})
}

func (h *Handler) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	tableID := chi.URLParam(r, "id")
	itemID := chi.URLParam(r, "itemId")
	tbl, err := h.app.RemoveItemFromTable(r.Context(), tableID, itemID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": tbl,
	})
}

func (h *Handler) handleSendKitchen(w http.ResponseWriter, r *http.Request) {
	tableID := chi.URLParam(r, "id")
	tbl, err := h.app.SendToKitchen(r.Context(), tableID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": tbl,
	})
}

func (h *Handler) handleMarkReady(w http.ResponseWriter, r *http.Request) {
	tableID := chi.URLParam(r, "id")
	tbl, err := h.app.MarkReady(r.Context(), tableID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": tbl,
	})
}

func (h *Handler) handleS2SClearTable(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdempotencyKey string `json:"idempotencyKey"`
		TableID        string `json:"tableId"`
		InvoiceNumber  string `json:"invoiceNumber"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ok, err := h.app.ClearInvoicedTable(r.Context(), req.IdempotencyKey, req.TableID, req.InvoiceNumber)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": ok})
}
