package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-facturacion/internal/platform/config"
	"ms-facturacion/internal/platform/httpx"
	"ms-facturacion/internal/platform/security"
	msfacturacion "ms-facturacion"
	"ms-facturacion/internal/application"
	"ms-facturacion/internal/domain"
)

//go:embed ui_dist/ui.js
var uiBundleJS []byte

type Handler struct {
	app    *application.Service
	cfg    config.ServiceConfig
	pub    ed25519.PublicKey
	replay *security.ReplayGuard
}

func NewHandler(
	app *application.Service,
	cfg config.ServiceConfig,
	pub ed25519.PublicKey,
	replay *security.ReplayGuard,
) *Handler {
	return &Handler{
		app:    app,
		cfg:    cfg,
		pub:    pub,
		replay: replay,
	}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(h.cfg.AllowedOrigins))

	healthFn := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"service": "ms-facturacion",
		})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/facturacion/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-facturacion", h.pub, h.cfg.S2SSharedKey, h.replay))
		h.mountRoutes(pr)
		pr.Route("/api/v1/facturacion", h.mountRoutes)
	})

	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", h.handleManifest)
	r.Get("/ui.js", h.handleUIBundle)
	r.Get("/pos-state", h.handleGetPosState)
	r.Get("/summary", h.handleGetSummary)
	r.Post("/invoices", h.handleCreateInvoice)
	r.Post("/quotes", h.handleCreateQuote)
}

func (h *Handler) handleManifest(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(msfacturacion.ManifestJSON)
}

func (h *Handler) handleUIBundle(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(uiBundleJS)
}

func (h *Handler) handleGetPosState(w http.ResponseWriter, r *http.Request) {
	st, err := h.app.GetPosState(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"nextInvoiceNumber": st.NextInvoiceNumber,
		"nextQuoteNumber":   st.NextQuoteNumber,
		"invoices":          st.Invoices,
		"quotes":            st.Quotes,
		"summary":           st.Summary,
	})
}

func (h *Handler) handleGetSummary(w http.ResponseWriter, r *http.Request) {
	sum, err := h.app.GetSummary(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                      true,
		"invoiceCount":            sum.InvoiceCount,
		"quoteCount":              sum.QuoteCount,
		"totalSales":              sum.TotalSales,
		"totalDiscount":           sum.TotalDiscount,
		"totalTax":                sum.TotalTax,
		"totalCollected":          sum.TotalCollected,
		"totalPendingReceivables": sum.TotalPendingReceivables,
		"cashSales":               sum.CashSales,
		"digitalSales":            sum.DigitalSales,
		"cashCollected":           sum.CashCollected,
		"digitalCollected":        sum.DigitalCollected,
		"dianAcceptedCount":       sum.DianAcceptedCount,
		"workshopInvoiceCount":    sum.WorkshopInvoiceCount,
	})
}

type invoiceItemDTO struct {
	ProductID   string   `json:"productId"`
	RefID       string   `json:"refId"`
	Code        string   `json:"code"`
	Description string   `json:"description"`
	Name        string   `json:"name"`
	ItemType    string   `json:"itemType"`
	Kind        string   `json:"kind"`
	Quantity    *float64 `json:"quantity"`
	Qty         *float64 `json:"qty"`
	UnitPrice   *float64 `json:"unitPrice"`
	Price       *float64 `json:"price"`
	TaxPct      *float64 `json:"taxPct"`
	WorkerID    string   `json:"workerId"`
	WorkerName  string   `json:"workerName"`
}

func (d invoiceItemDTO) toDomain() domain.InvoiceItem {
	itemType := strings.ToUpper(strings.TrimSpace(d.ItemType))
	if itemType == "" {
		itemType = strings.ToUpper(strings.TrimSpace(d.Kind))
	}
	if itemType == "" {
		itemType = domain.ItemTypeProducto
	}

	prodID := strings.TrimSpace(d.ProductID)
	if prodID == "" && itemType != domain.ItemTypeServicio {
		prodID = strings.TrimSpace(d.RefID)
	}

	desc := strings.TrimSpace(d.Description)
	if desc == "" {
		desc = strings.TrimSpace(d.Name)
	}

	qty := 0.0
	if d.Quantity != nil {
		qty = *d.Quantity
	} else if d.Qty != nil {
		qty = *d.Qty
	}

	unitPrice := 0.0
	if d.UnitPrice != nil {
		unitPrice = *d.UnitPrice
	} else if d.Price != nil {
		unitPrice = *d.Price
	}

	taxPct := 0.0
	if d.TaxPct != nil {
		taxPct = *d.TaxPct
	}

	return domain.InvoiceItem{
		ProductID:   prodID,
		Code:        strings.TrimSpace(d.Code),
		Description: desc,
		ItemType:    itemType,
		Quantity:    qty,
		UnitPrice:   unitPrice,
		TaxPct:      taxPct,
		WorkerID:    strings.TrimSpace(d.WorkerID),
		WorkerName:  strings.TrimSpace(d.WorkerName),
	}
}

type createInvoiceDTO struct {
	CustomerID        string           `json:"customerId"`
	CustomerName      string           `json:"customerName"`
	CustomerNIT       string           `json:"customerNit"`
	CustomerPhone     string           `json:"customerPhone"`
	CustomerAddress   string           `json:"customerAddress"`
	ContractID        string           `json:"contractId"`
	DiscountPct       *float64         `json:"discountPct"`
	VehicleID         string           `json:"vehicleId"`
	Plate             string           `json:"plate"`
	MechanicID        string           `json:"mechanicId"`
	MechanicName      string           `json:"mechanicName"`
	WorkshopMeta      json.RawMessage  `json:"workshopMeta"`
	LinkedWorkOrderID string           `json:"linkedWorkOrderId"`
	LinkedRoomID      string           `json:"linkedRoomId"`
	LinkedTableID     string           `json:"linkedTableId"`
	LayoutVariant     string           `json:"layoutVariant"`
	Items             []invoiceItemDTO `json:"items"`
	PaymentMethod     string           `json:"paymentMethod"`
	AmountPaid        *float64         `json:"amountPaid"`
	Notes             string           `json:"notes"`
	RenderPrint       bool             `json:"renderPrint"`
}

func parseWorkshopMeta(raw json.RawMessage) domain.WorkshopMetadata {
	if len(raw) == 0 || string(raw) == "null" {
		return domain.WorkshopMetadata{}
	}
	var direct domain.WorkshopMetadata
	if err := json.Unmarshal(raw, &direct); err == nil {
		return direct
	}
	var generic map[string]any
	if err := json.Unmarshal(raw, &generic); err != nil {
		return domain.WorkshopMetadata{}
	}
	asStr := func(key string) string {
		v, ok := generic[key]
		if !ok || v == nil {
			return ""
		}
		return strings.TrimSpace(fmt.Sprintf("%v", v))
	}
	return domain.WorkshopMetadata{
		VehicleBrand: asStr("vehicleBrand"),
		CurrentKm:    asStr("currentKm"),
		NextOilKm:    asStr("nextOilKm"),
		WorkOrderID:  asStr("workOrderId"),
	}
}

func (h *Handler) handleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var dto createInvoiceDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	items := make([]domain.InvoiceItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, it.toDomain())
	}

	res, err := h.app.CreateInvoice(r.Context(), domain.CreateInvoiceInput{
		CustomerID:        dto.CustomerID,
		CustomerName:      dto.CustomerName,
		CustomerNIT:       dto.CustomerNIT,
		CustomerPhone:     dto.CustomerPhone,
		CustomerAddress:   dto.CustomerAddress,
		ContractID:        dto.ContractID,
		DiscountPct:       dto.DiscountPct,
		VehicleID:         dto.VehicleID,
		Plate:             dto.Plate,
		MechanicID:        dto.MechanicID,
		MechanicName:      dto.MechanicName,
		WorkshopMeta:      parseWorkshopMeta(dto.WorkshopMeta),
		LinkedWorkOrderID: dto.LinkedWorkOrderID,
		LinkedRoomID:      dto.LinkedRoomID,
		LinkedTableID:     dto.LinkedTableID,
		LayoutVariant:     dto.LayoutVariant,
		Items:             items,
		PaymentMethod:     dto.PaymentMethod,
		AmountPaid:        dto.AmountPaid,
		Notes:             dto.Notes,
		RenderPrint:       dto.RenderPrint,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":        true,
		"invoice":   res.Invoice,
		"printHtml": res.PrintHTML,
	})
}

type createQuoteDTO struct {
	CustomerID   string           `json:"customerId"`
	CustomerName string           `json:"customerName"`
	CustomerNIT  string           `json:"customerNit"`
	ValidUntil   string           `json:"validUntil"`
	Notes        string           `json:"notes"`
	Items        []invoiceItemDTO `json:"items"`
}

func (h *Handler) handleCreateQuote(w http.ResponseWriter, r *http.Request) {
	var dto createQuoteDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	items := make([]domain.InvoiceItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, it.toDomain())
	}

	quote, err := h.app.CreateQuote(r.Context(), domain.CreateQuoteInput{
		CustomerID:   dto.CustomerID,
		CustomerName: dto.CustomerName,
		CustomerNIT:  dto.CustomerNIT,
		ValidUntil:   dto.ValidUntil,
		Notes:        dto.Notes,
		Items:        items,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"quote": quote,
	})
}
