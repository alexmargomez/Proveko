package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-caja/internal/platform/config"
	"ms-caja/internal/platform/httpx"
	"ms-caja/internal/platform/security"
	mscaja "ms-caja"
	"ms-caja/internal/application"
	"ms-caja/internal/domain"
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
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-caja"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/caja/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-caja", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/caja", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/summary", h.handleSummary)
	r.Post("/incomes", h.handleCreateIncome)
	r.Post("/expenses", h.handleCreateExpense)
	r.Delete("/expenses/{id}", h.handleDeleteExpense)
	r.Post("/bank-movements", h.handleCreateBankMovement)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(mscaja.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleSummary(w http.ResponseWriter, r *http.Request) {
	sum, err := h.app.GetSummary(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"cashIncomes":     sum.CashIncomes,
		"digitalIncomes":  sum.DigitalIncomes,
		"cashSales":       sum.CashSales,
		"digitalSales":    sum.DigitalSales,
		"totalExpenses":   sum.TotalExpenses,
		"cashExpenses":    sum.CashExpenses,
		"netCash":         sum.NetCash,
		"bankInTotal":     sum.BankInTotal,
		"bankOutTotal":    sum.BankOutTotal,
		"nextIncomeCode":  sum.NextIncomeCode,
		"nextExpenseCode": sum.NextExpenseCode,
		"nextBankCode":    sum.NextBankCode,
		"incomes":         sum.Incomes,
		"expenses":        sum.Expenses,
		"bankMovements":   sum.BankMovements,
	})
}

func (h *Handler) handleCreateIncome(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateIncomeInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	income, err := h.app.CreateIncome(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"income": income,
	})
}

func (h *Handler) handleCreateExpense(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateExpenseInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	expense, err := h.app.CreateExpense(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"expense": expense,
	})
}

func (h *Handler) handleDeleteExpense(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.app.DeleteExpense(r.Context(), id); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleCreateBankMovement(w http.ResponseWriter, r *http.Request) {
	var req domain.CreateBankMovementInput
	if err := httpx.Decode(w, r, &req); err != nil {
		httpx.RespondError(w, err)
		return
	}
	mov, err := h.app.CreateBankMovement(r.Context(), req)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"movement": mov,
	})
}
