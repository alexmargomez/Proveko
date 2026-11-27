package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	msfacturacion "ms-facturacion"
	"ms-facturacion/internal/application"
	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/config"
	"ms-facturacion/internal/platform/httpx"
	"ms-facturacion/internal/platform/security"
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
	r.Put("/invoices/{id}", h.handleUpdateInvoice)
	r.Post("/invoices/{id}/confirm", h.handleConfirmInvoice)
	r.Post("/dian/send", h.handleDianSend)
	r.Post("/dian/respond", h.handleDianRespond)
	r.Post("/notes", h.handleCreateNote)
	r.Put("/notes/{id}", h.handleUpdateNote)
	r.Post("/notes/{id}/confirm", h.handleConfirmNote)
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
		"ok":                   true,
		"nextInvoiceNumber":    st.NextInvoiceNumber,
		"nextQuoteNumber":      st.NextQuoteNumber,
		"nextCreditNoteNumber": st.NextCreditNoteNumber,
		"nextDebitNoteNumber":  st.NextDebitNoteNumber,
		"invoices":             st.Invoices,
		"quotes":               st.Quotes,
		"adjustmentNotes":      st.AdjustmentNotes,
		"dianTransmissions":    st.DianTransmissions,
		"summary":              st.Summary,
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
	SaveMode          string           `json:"saveMode"`
	InvoiceType       string           `json:"invoiceType"`
	DueDate           string           `json:"dueDate"`
	PurchaseOrderRef  string           `json:"purchaseOrderRef"`
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

func (dto createInvoiceDTO) toInput() domain.CreateInvoiceInput {
	items := make([]domain.InvoiceItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, it.toDomain())
	}
	return domain.CreateInvoiceInput{
		SaveMode:          dto.SaveMode,
		InvoiceType:       dto.InvoiceType,
		DueDate:           dto.DueDate,
		PurchaseOrderRef:  dto.PurchaseOrderRef,
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
	}
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

func decodeOptional(w http.ResponseWriter, r *http.Request, dst any) error {
	if r.Body == nil {
		return nil
	}
	r.Body = http.MaxBytesReader(w, r.Body, httpx.DefaultMaxBodyBytes)
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}

func (h *Handler) handleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var dto createInvoiceDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	res, err := h.app.CreateInvoice(r.Context(), dto.toInput())
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

func (h *Handler) handleUpdateInvoice(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var dto createInvoiceDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	res, err := h.app.UpdateInvoice(r.Context(), id, dto.toInput())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"invoice":   res.Invoice,
		"printHtml": res.PrintHTML,
	})
}

type confirmInvoiceDTO struct {
	RenderPrint bool `json:"renderPrint"`
}

func (h *Handler) handleConfirmInvoice(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var dto confirmInvoiceDTO
	_ = decodeOptional(w, r, &dto)

	res, err := h.app.ConfirmInvoice(r.Context(), id, dto.RenderPrint)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"invoice":   res.Invoice,
		"printHtml": res.PrintHTML,
	})
}

type dianSendDTO struct {
	DocumentKind string `json:"documentKind"`
	DocumentID   string `json:"documentId"`
}

func (h *Handler) handleDianSend(w http.ResponseWriter, r *http.Request) {
	var dto dianSendDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	res, err := h.app.SendToDian(r.Context(), domain.DianSendInput{
		DocumentKind: dto.DocumentKind,
		DocumentID:   dto.DocumentID,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"transmission":   res.Transmission,
		"invoice":        res.Invoice,
		"adjustmentNote": res.AdjustmentNote,
	})
}

type dianRespondDTO struct {
	DocumentKind     string `json:"documentKind"`
	DocumentID       string `json:"documentId"`
	Outcome          string `json:"outcome"`
	RejectionCode    string `json:"rejectionCode"`
	RejectionMessage string `json:"rejectionMessage"`
}

func (h *Handler) handleDianRespond(w http.ResponseWriter, r *http.Request) {
	var dto dianRespondDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	res, err := h.app.RespondDian(r.Context(), domain.DianRespondInput{
		DocumentKind:     dto.DocumentKind,
		DocumentID:       dto.DocumentID,
		Outcome:          dto.Outcome,
		RejectionCode:    dto.RejectionCode,
		RejectionMessage: dto.RejectionMessage,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"transmission":   res.Transmission,
		"invoice":        res.Invoice,
		"adjustmentNote": res.AdjustmentNote,
	})
}

type adjustmentNoteDTO struct {
	SaveMode          string           `json:"saveMode"`
	NoteKind          string           `json:"noteKind"`
	InvoiceID         string           `json:"invoiceId"`
	CustomerName      string           `json:"customerName"`
	CustomerNIT       string           `json:"customerNit"`
	ReasonCode        string           `json:"reasonCode"`
	ReasonDescription string           `json:"reasonDescription"`
	RestockInventory  bool             `json:"restockInventory"`
	Items             []invoiceItemDTO `json:"items"`
}

func (dto adjustmentNoteDTO) toInput() domain.CreateAdjustmentNoteInput {
	items := make([]domain.InvoiceItem, 0, len(dto.Items))
	for _, it := range dto.Items {
		items = append(items, it.toDomain())
	}
	return domain.CreateAdjustmentNoteInput{
		SaveMode:          dto.SaveMode,
		NoteKind:          dto.NoteKind,
		InvoiceID:         dto.InvoiceID,
		CustomerName:      dto.CustomerName,
		CustomerNIT:       dto.CustomerNIT,
		ReasonCode:        dto.ReasonCode,
		ReasonDescription: dto.ReasonDescription,
		RestockInventory:  dto.RestockInventory,
		Items:             items,
	}
}

func (h *Handler) handleCreateNote(w http.ResponseWriter, r *http.Request) {
	var dto adjustmentNoteDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	note, err := h.app.CreateAdjustmentNote(r.Context(), dto.toInput())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":             true,
		"adjustmentNote": note,
	})
}

func (h *Handler) handleUpdateNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var dto adjustmentNoteDTO
	if err := httpx.Decode(w, r, &dto); err != nil {
		httpx.RespondError(w, err)
		return
	}

	note, err := h.app.UpdateAdjustmentNote(r.Context(), id, dto.toInput())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"adjustmentNote": note,
	})
}

func (h *Handler) handleConfirmNote(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	var dummy map[string]any
	_ = decodeOptional(w, r, &dummy)

	note, err := h.app.ConfirmAdjustmentNote(r.Context(), id)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"adjustmentNote": note,
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
