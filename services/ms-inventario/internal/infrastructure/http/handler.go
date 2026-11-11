package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-inventario/internal/platform/config"
	"ms-inventario/internal/platform/httpx"
	"ms-inventario/internal/platform/security"
	msinventario "ms-inventario"
	"ms-inventario/internal/application"
	"ms-inventario/internal/domain"
)

//go:embed ui_dist/ui.js
var uiBundleJS []byte

type Handler struct {
	app *application.Service
	cfg config.ServiceConfig
	pub ed25519.PublicKey
	rg  *security.ReplayGuard
}

func NewHandler(app *application.Service, cfg config.ServiceConfig, pub ed25519.PublicKey, rg *security.ReplayGuard) *Handler {
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-inventario"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/inventario/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-inventario", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/inventario", h.mountRoutes)
	})
	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/all", h.handleGetAll)
	r.Post("/products", h.handleCreateProduct)
	r.Delete("/products/{id}", h.handleDeleteProduct)
	r.Post("/products/{id}/delta", h.handleAdjustDelta)
	r.Post("/products/{id}/restock", h.handleRestockProduct)
	r.Post("/products/{id}/transfer", h.handleTransferProduct)
	r.Post("/warehouses", h.handleCreateWarehouse)
	r.Post("/requests", h.handleCreateRequest)
	r.Post("/internal-s2s/quote", h.handleS2SQuote)
	r.Post("/internal-s2s/deduct", h.handleS2SDeduct)
	r.Post("/internal-s2s/restock", h.handleS2SRestock)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msinventario.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetAll(w http.ResponseWriter, r *http.Request) {
	st, err := h.app.GetAll(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"nextProductCode":   st.NextProductCode,
		"nextWarehouseCode": st.NextWarehouseCode,
		"nextRequestCode":   st.NextRequestCode,
		"products":          st.Products,
		"warehouses":        st.Warehouses,
		"kardex":            st.Kardex,
		"requests":          st.Requests,
	})
}

func (h *Handler) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateProductInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	prod, err := h.app.CreateProduct(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "product": prod})
}

func (h *Handler) handleDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.app.DeleteProduct(r.Context(), id); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleAdjustDelta(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req domain.AdjustDeltaInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	prod, err := h.app.AdjustProductDelta(r.Context(), id, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "product": prod})
}

func (h *Handler) handleRestockProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req domain.RestockProductInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	prod, err := h.app.RestockProduct(r.Context(), id, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "product": prod})
}

func (h *Handler) handleTransferProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req domain.TransferProductInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	prod, err := h.app.TransferProduct(r.Context(), id, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "product": prod})
}

func (h *Handler) handleCreateWarehouse(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateWarehouseInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	wh, err := h.app.CreateWarehouse(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "warehouse": wh})
}

func (h *Handler) handleCreateRequest(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateSupplyRequestInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	sr, err := h.app.CreateSupplyRequest(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "request": sr})
}

func (h *Handler) handleS2SQuote(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductIDs []string `json:"productIds"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	quotes, err := h.app.QuoteProducts(r.Context(), req.ProductIDs)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "products": quotes})
}

func (h *Handler) handleS2SDeduct(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdempotencyKey string                  `json:"idempotencyKey"`
		Items          []domain.StockDeltaItem `json:"items"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	cnt, err := h.app.DeductStock(r.Context(), req.IdempotencyKey, req.Items)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "processedCount": cnt})
}

func (h *Handler) handleS2SRestock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdempotencyKey string                  `json:"idempotencyKey"`
		Items          []domain.StockDeltaItem `json:"items"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	cnt, err := h.app.RestockItems(r.Context(), req.IdempotencyKey, req.Items)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "processedCount": cnt})
}
