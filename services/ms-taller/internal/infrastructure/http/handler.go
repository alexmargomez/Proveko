package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-taller/internal/platform/config"
	"ms-taller/internal/platform/httpx"
	"ms-taller/internal/platform/security"
	mstaller "ms-taller"
	"ms-taller/internal/application"
	"ms-taller/internal/domain"
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-taller"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/taller/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-taller", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/taller", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/all", h.handleGetAll)
	r.Post("/vehicles", h.handleCreateVehicle)
	r.Delete("/vehicles/{id}", h.handleDeleteVehicle)
	r.Post("/orders", h.handleCreateOrder)
	r.Post("/orders/{id}/stage", h.handleAdvanceStage)
	r.Post("/workers", h.handleCreateWorker)
	r.Post("/workers/{id}/settle", h.handleSettleWorker)
	r.Post("/internal-s2s/invoice-sync", h.handleS2SInvoiceSync)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mstaller.ManifestJSON)
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
		"nextOrderCode":   st.NextOrderCode,
		"nextWorkerCode":  st.NextWorkerCode,
		"nextVehicleCode": st.NextVehicleCode,
		"orders":          st.Orders,
		"workers":         st.Workers,
		"settlements":     st.Settlements,
		"vehicles":        st.Vehicles,
	})
}

func (h *Handler) handleCreateVehicle(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateVehicleInput
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

func (h *Handler) handleDeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.app.DeleteVehicle(r.Context(), id); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateWorkOrderInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ord, err := h.app.CreateWorkOrder(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"order": ord,
	})
}

type stageReq struct {
	Status string `json:"status"`
}

func (h *Handler) handleAdvanceStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req stageReq
	if r.ContentLength != 0 {
		if err := httpx.Decode(w, r, &req); err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	ord, err := h.app.AdvanceWorkOrderStage(r.Context(), id, req.Status)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"order": ord,
	})
}

func (h *Handler) handleCreateWorker(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateWorkerInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	wk, err := h.app.CreateWorker(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"worker": wk,
	})
}

func (h *Handler) handleSettleWorker(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	settlement, err := h.app.SettleWorker(r.Context(), id)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"settlement": settlement,
	})
}

func (h *Handler) handleS2SInvoiceSync(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IdempotencyKey string  `json:"idempotencyKey"`
		WorkOrderID    string  `json:"workOrderId"`
		VehicleID      string  `json:"vehicleId"`
		MechanicID     string  `json:"mechanicId"`
		LaborGross     float64 `json:"laborGross"`
		InvoiceNumber  string  `json:"invoiceNumber"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	res, err := h.app.RegisterInvoicedOrderAndCommission(r.Context(), domain.InvoiceSyncInput{
		IdempotencyKey: req.IdempotencyKey,
		WorkOrderID:    req.WorkOrderID,
		VehicleID:      req.VehicleID,
		MechanicID:     req.MechanicID,
		LaborGross:     req.LaborGross,
		InvoiceNumber:  req.InvoiceNumber,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
