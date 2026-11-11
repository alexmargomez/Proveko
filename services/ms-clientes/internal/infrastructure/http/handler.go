package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-clientes/internal/platform/config"
	"ms-clientes/internal/platform/httpx"
	"ms-clientes/internal/platform/security"
	msclientes "ms-clientes"
	"ms-clientes/internal/application"
	"ms-clientes/internal/domain"
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-clientes"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/clientes/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-clientes", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/clientes", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/all", h.handleGetAll)
	r.Post("/customers", h.handleCreateCustomer)
	r.Delete("/customers/{id}", h.handleDeleteCustomer)
	r.Post("/tariffs", h.handleCreateTariff)
	r.Post("/contracts", h.handleCreateContract)
	r.Post("/receivables/{invoiceId}/abono", h.handleRegisterAbono)
	r.Post("/internal-s2s/commercial-terms", h.handleS2SCommercialTerms)
	r.Post("/internal-s2s/receivable-delta", h.handleS2SReceivableDelta)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msclientes.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetAll(w http.ResponseWriter, r *http.Request) {
	snap, err := h.app.GetAll(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"nextCustomerCode": snap.NextCustomerCode,
		"nextContractCode": snap.NextContractCode,
		"nextTariffCode":   snap.NextTariffCode,
		"customers":        snap.Customers,
		"contracts":        snap.Contracts,
		"tariffs":          snap.Tariffs,
		"pendingInvoices":  snap.PendingInvoices,
	})
}

func (h *Handler) handleCreateCustomer(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateCustomerInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateCustomer(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"customer": created,
	})
}

func (h *Handler) handleDeleteCustomer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.app.DeleteCustomer(r.Context(), id); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleCreateTariff(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateTariffInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateTariff(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"tariff": created,
	})
}

func (h *Handler) handleCreateContract(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateContractInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	created, err := h.app.CreateContract(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"contract": created,
	})
}

func (h *Handler) handleRegisterAbono(w http.ResponseWriter, r *http.Request) {
	invoiceID := chi.URLParam(r, "invoiceId")
	var req domain.RegisterAbonoInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	updated, err := h.app.RegisterAbono(r.Context(), invoiceID, req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"receivable": updated,
		"invoice":    updated,
	})
}

func (h *Handler) handleS2SCommercialTerms(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CustomerID string `json:"customerId"`
		ContractID string `json:"contractId"`
	}
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	terms, err := h.app.ResolveCommercialTerms(r.Context(), req.CustomerID, req.ContractID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "terms": terms})
}

func (h *Handler) handleS2SReceivableDelta(w http.ResponseWriter, r *http.Request) {
	var req domain.ReceivableDeltaInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	res, err := h.app.ApplyReceivableDelta(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}
