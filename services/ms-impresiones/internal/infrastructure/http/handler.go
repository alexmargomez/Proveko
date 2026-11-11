package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-impresiones/internal/platform/config"
	"ms-impresiones/internal/platform/httpx"
	"ms-impresiones/internal/platform/security"
	msimpresiones "ms-impresiones"
	"ms-impresiones/internal/application"
	"ms-impresiones/internal/domain"
)

//go:embed ui_dist/ui.js
var uiBundleJS []byte

type Handler struct {
	cfg    config.ServiceConfig
	pub    ed25519.PublicKey
	replay *security.ReplayGuard
	uc     *application.PrintUseCase
}

func NewHandler(
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
	uc *application.PrintUseCase,
) *Handler {
	return &Handler{
		cfg:    cfg,
		pub:    pub,
		replay: replay,
		uc:     uc,
	}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(h.cfg.AllowedOrigins))

	healthFn := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "ms-impresiones",
		})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/impresiones/health", healthFn)

	r.Group(func(protected chi.Router) {
		protected.Use(httpx.RequireServicePassport("ms-impresiones", h.pub, h.cfg.S2SSharedKey, h.replay))
		h.registerRoutes(protected)
		protected.Route("/api/v1/impresiones", h.registerRoutes)
	})

	return r
}

func (h *Handler) registerRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/branding", h.handleGetBranding)
	r.Put("/branding", h.handleUpdateBranding)
	r.Post("/render", h.handleRender)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msimpresiones.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetBranding(w http.ResponseWriter, r *http.Request) {
	branding, err := h.uc.GetBranding(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"branding": branding,
	})
}

func (h *Handler) handleUpdateBranding(w http.ResponseWriter, r *http.Request) {
	var in domain.BrandingConfig
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	saved, err := h.uc.UpdateBranding(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"branding": saved,
	})
}

type renderLineDTO struct {
	Code        string   `json:"code"`
	Description string   `json:"description"`
	Name        string   `json:"name"`
	Quantity    *float64 `json:"quantity"`
	Qty         *float64 `json:"qty"`
	UnitPrice   *float64 `json:"unit_price"`
	UnitPriceC  *float64 `json:"unitPrice"`
	Price       *float64 `json:"price"`
	TaxPct      *float64 `json:"tax_pct"`
	TaxPctC     *float64 `json:"taxPct"`
	Subtotal    *float64 `json:"subtotal"`
}

type renderPayloadDTO struct {
	DocumentType     string            `json:"document_type"`
	DocType          string            `json:"docType"`
	DocumentTypeC    string            `json:"documentType"`
	LayoutVariant    string            `json:"layout_variant"`
	LayoutVariantC   string            `json:"layoutVariant"`
	Format           string            `json:"format"`
	DocumentNumber   string            `json:"document_number"`
	DocNumber        string            `json:"docNumber"`
	DocumentNumberC  string            `json:"documentNumber"`
	IssueDate        string            `json:"issue_date"`
	IssueDateC       string            `json:"issueDate"`
	Date             string            `json:"date"`
	CustomerName     string            `json:"customer_name"`
	CustomerNameC    string            `json:"customerName"`
	CustomerNit      string            `json:"customer_nit"`
	CustomerNitC     string            `json:"customerNit"`
	CustomerPhone    string            `json:"customer_phone"`
	CustomerPhoneC   string            `json:"customerPhone"`
	CustomerAddress  string            `json:"customer_address"`
	CustomerAddressC string            `json:"customerAddress"`
	PaymentMethod    string            `json:"payment_method"`
	PaymentMethodC   string            `json:"paymentMethod"`
	ExtraFields      map[string]string `json:"extra_fields"`
	ExtraFieldsC     map[string]string `json:"extraFields"`
	Items            []renderLineDTO   `json:"items"`
	Subtotal         *float64          `json:"subtotal"`
	DiscountTotal    *float64          `json:"discount_total"`
	DiscountTotalC   *float64          `json:"discountTotal"`
	TaxTotal         *float64          `json:"tax_total"`
	TaxTotalC        *float64          `json:"taxTotal"`
	GrandTotal       *float64          `json:"grand_total"`
	GrandTotalC      *float64          `json:"grandTotal"`
	Total            *float64          `json:"total"`
	PendingBalance   *float64          `json:"pending_balance"`
	PendingBalanceC  *float64          `json:"pendingBalance"`
	Notes            string            `json:"notes"`
}

func (h *Handler) handleRender(w http.ResponseWriter, r *http.Request) {
	var dto renderPayloadDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	extras := make(map[string]string)
	for k, v := range dto.ExtraFieldsC {
		extras[k] = v
	}
	for k, v := range dto.ExtraFields {
		extras[k] = v
	}

	items := make([]domain.PrintLineItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, domain.PrintLineItem{
			Code:        it.Code,
			Description: firstStr(it.Description, it.Name),
			Quantity:    firstFloat(it.Quantity, it.Qty),
			UnitPrice:   firstFloat(it.UnitPrice, it.UnitPriceC, it.Price),
			TaxPct:      firstFloat(it.TaxPct, it.TaxPctC),
			Subtotal:    firstFloat(it.Subtotal),
		})
	}

	out, err := h.uc.RenderDocument(r.Context(), domain.RenderRequest{
		DocumentType:    firstStr(dto.DocumentType, dto.DocType, dto.DocumentTypeC),
		LayoutVariant:   firstStr(dto.LayoutVariant, dto.LayoutVariantC, dto.Format),
		DocumentNumber:  firstStr(dto.DocumentNumber, dto.DocNumber, dto.DocumentNumberC),
		IssueDate:       firstStr(dto.IssueDate, dto.IssueDateC, dto.Date),
		CustomerName:    firstStr(dto.CustomerName, dto.CustomerNameC),
		CustomerNit:     firstStr(dto.CustomerNit, dto.CustomerNitC),
		CustomerPhone:   firstStr(dto.CustomerPhone, dto.CustomerPhoneC),
		CustomerAddress: firstStr(dto.CustomerAddress, dto.CustomerAddressC),
		PaymentMethod:   firstStr(dto.PaymentMethod, dto.PaymentMethodC),
		ExtraFields:     extras,
		Items:           items,
		Subtotal:        firstFloat(dto.Subtotal),
		DiscountTotal:   firstFloat(dto.DiscountTotal, dto.DiscountTotalC),
		TaxTotal:        firstFloat(dto.TaxTotal, dto.TaxTotalC),
		GrandTotal:      firstFloat(dto.GrandTotal, dto.GrandTotalC, dto.Total),
		PendingBalance:  firstFloat(dto.PendingBalance, dto.PendingBalanceC),
		Notes:           dto.Notes,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"title":          out.Title,
		"format":         out.Format,
		"html_printable": out.HTMLPrintable,
		"htmlPrintable":  out.HTMLPrintable,
	})
}

func firstStr(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func firstFloat(vals ...*float64) float64 {
	for _, p := range vals {
		if p != nil {
			return *p
		}
	}
	return 0
}
