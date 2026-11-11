package s2s

import (
	"context"
	"net/http"
	"strings"

	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/apperr"
	"ms-facturacion/internal/platform/authguard"
	"ms-facturacion/internal/platform/gateway"
)

type InventoryAdapter struct{ gw *gateway.Client }
type CustomersAdapter struct{ gw *gateway.Client }
type WorkshopAdapter struct{ gw *gateway.Client }
type HospitalityAdapter struct{ gw *gateway.Client }
type GastroAdapter struct{ gw *gateway.Client }
type PrintAdapter struct{ gw *gateway.Client }

func NewInventoryAdapter(gw *gateway.Client) domain.InventoryPort {
	if gw == nil {
		return nil
	}
	return &InventoryAdapter{gw: gw}
}

func NewCustomersAdapter(gw *gateway.Client) domain.CustomersPort {
	if gw == nil {
		return nil
	}
	return &CustomersAdapter{gw: gw}
}

func NewWorkshopAdapter(gw *gateway.Client) domain.WorkshopPort {
	if gw == nil {
		return nil
	}
	return &WorkshopAdapter{gw: gw}
}

func NewHospitalityAdapter(gw *gateway.Client) domain.HospitalityPort {
	if gw == nil {
		return nil
	}
	return &HospitalityAdapter{gw: gw}
}

func NewGastroAdapter(gw *gateway.Client) domain.GastroPort {
	if gw == nil {
		return nil
	}
	return &GastroAdapter{gw: gw}
}

func NewPrintAdapter(gw *gateway.Client) domain.PrintPort {
	if gw == nil {
		return nil
	}
	return &PrintAdapter{gw: gw}
}

type productQuoteWireDTO struct {
	ProductID      string  `json:"productId"`
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	SalePrice      float64 `json:"salePrice"`
	TaxPct         float64 `json:"taxPct"`
	AvailableStock float64 `json:"availableStock"`
}

type stockMovementWireDTO struct {
	ProductID    string  `json:"productId"`
	Quantity     float64 `json:"quantity"`
	UnitCost     float64 `json:"unitCost"`
	WarehouseID  string  `json:"warehouseId,omitempty"`
	MovementType string  `json:"movementType,omitempty"`
	ReferenceDoc string  `json:"referenceDoc,omitempty"`
	Actor        string  `json:"actor,omitempty"`
}

type commercialTermsWireDTO struct {
	CustomerID      string  `json:"customerId"`
	CustomerName    string  `json:"customerName"`
	CustomerNIT     string  `json:"customerNit"`
	CustomerPhone   string  `json:"customerPhone"`
	CustomerAddress string  `json:"customerAddress"`
	ContractID      string  `json:"contractId"`
	DiscountPct     float64 `json:"discountPct"`
	CreditLimit     float64 `json:"creditLimit"`
	CurrentDebt     float64 `json:"currentDebt"`
}

type receivableDeltaWireDTO struct {
	IdempotencyKey        string  `json:"idempotencyKey"`
	CustomerID            string  `json:"customerId"`
	ContractID            string  `json:"contractId,omitempty"`
	InvoiceID             string  `json:"invoiceId"`
	InvoiceNumber         string  `json:"invoiceNumber"`
	IssueDate             string  `json:"issueDate"`
	InvoiceTotal          float64 `json:"invoiceTotal"`
	DebtDelta             float64 `json:"debtDelta"`
	ContractConsumedDelta float64 `json:"contractConsumedDelta"`
}

func toStockWireItems(items []domain.StockMovementItem) []stockMovementWireDTO {
	out := make([]stockMovementWireDTO, 0, len(items))
	for _, it := range items {
		out = append(out, stockMovementWireDTO{
			ProductID:    it.ProductID,
			Quantity:     it.Quantity,
			UnitCost:     it.UnitCost,
			WarehouseID:  it.WarehouseID,
			MovementType: it.MovementType,
			ReferenceDoc: it.ReferenceDoc,
			Actor:        it.Actor,
		})
	}
	return out
}

func (a *InventoryAdapter) QuoteProducts(ctx context.Context, productIDs []string) (map[string]domain.ProductQuote, error) {
	if a == nil || a.gw == nil {
		return map[string]domain.ProductQuote{}, nil
	}
	var resp struct {
		Products []productQuoteWireDTO `json:"products"`
	}
	if err := a.gw.CallS2S(ctx, "ms-inventario", http.MethodPost, "/internal-s2s/quote", "", map[string]any{
		"productIds": productIDs,
	}, &resp); err != nil {
		return nil, err
	}
	out := make(map[string]domain.ProductQuote, len(resp.Products))
	for _, p := range resp.Products {
		q := domain.ProductQuote{
			ProductID:      p.ProductID,
			Code:           p.Code,
			Name:           p.Name,
			SalePrice:      p.SalePrice,
			TaxPct:         p.TaxPct,
			AvailableStock: p.AvailableStock,
		}
		out[p.ProductID] = q
		if p.Code != "" {
			out[p.Code] = q
		}
	}
	return out, nil
}

func (a *InventoryAdapter) DeductStock(ctx context.Context, idemKey string, items []domain.StockMovementItem) error {
	if a == nil || a.gw == nil || len(items) == 0 {
		return nil
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	if err := a.gw.CallS2S(ctx, "ms-inventario", http.MethodPost, "/internal-s2s/deduct", idemKey, map[string]any{
		"idempotencyKey": idemKey,
		"items":          toStockWireItems(items),
	}, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Conflict("Existencias insuficientes en inventario para facturar los productos solicitados")
	}
	return nil
}

func (a *InventoryAdapter) RestockItems(ctx context.Context, idemKey string, items []domain.StockMovementItem) error {
	if a == nil || a.gw == nil || len(items) == 0 {
		return nil
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	if err := a.gw.CallS2S(ctx, "ms-inventario", http.MethodPost, "/internal-s2s/restock", idemKey, map[string]any{
		"idempotencyKey": idemKey,
		"items":          toStockWireItems(items),
	}, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Unprocessable("ms-inventario rechazó la compensación de inventario")
	}
	return nil
}

func (a *CustomersAdapter) ResolveCommercialTerms(ctx context.Context, customerID, contractID string) (domain.CommercialTerms, error) {
	if a == nil || a.gw == nil {
		return domain.CommercialTerms{}, nil
	}
	var resp struct {
		Terms commercialTermsWireDTO `json:"terms"`
	}
	if err := a.gw.CallS2S(ctx, "ms-clientes", http.MethodPost, "/internal-s2s/commercial-terms", "", map[string]any{
		"customerId": customerID,
		"contractId": contractID,
	}, &resp); err != nil {
		return domain.CommercialTerms{}, err
	}
	return domain.CommercialTerms{
		CustomerID:      resp.Terms.CustomerID,
		CustomerName:    resp.Terms.CustomerName,
		CustomerNIT:     resp.Terms.CustomerNIT,
		CustomerPhone:   resp.Terms.CustomerPhone,
		CustomerAddress: resp.Terms.CustomerAddress,
		ContractID:      resp.Terms.ContractID,
		DiscountPct:     resp.Terms.DiscountPct,
		CreditLimit:     resp.Terms.CreditLimit,
		CurrentDebt:     resp.Terms.CurrentDebt,
	}, nil
}

func (a *CustomersAdapter) ApplyReceivableDelta(ctx context.Context, input domain.ReceivableDeltaInput) error {
	if a == nil || a.gw == nil {
		return nil
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	wireReq := receivableDeltaWireDTO{
		IdempotencyKey:        input.IdempotencyKey,
		CustomerID:            input.CustomerID,
		ContractID:            input.ContractID,
		InvoiceID:             input.InvoiceID,
		InvoiceNumber:         input.InvoiceNumber,
		IssueDate:             input.IssueDate,
		InvoiceTotal:          input.InvoiceTotal,
		DebtDelta:             input.DebtDelta,
		ContractConsumedDelta: input.ContractConsumedDelta,
	}
	if err := a.gw.CallS2S(ctx, "ms-clientes", http.MethodPost, "/internal-s2s/receivable-delta", input.IdempotencyKey, wireReq, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Conflict("ms-clientes rechazó la actualización de cartera o cupo comercial")
	}
	return nil
}

func (a *WorkshopAdapter) RegisterInvoicedOrder(ctx context.Context, workOrderID, mechanicID string, laborGross float64, invoiceNumber string) (string, error) {
	if a == nil || a.gw == nil {
		return "", nil
	}
	idem := strings.TrimSpace(authguard.FromContext(ctx).IdempotencyKey)
	if idem != "" {
		idem += ":workshop"
	} else {
		idem = "workshop:" + invoiceNumber
	}
	var resp struct {
		Ok           bool   `json:"ok"`
		MechanicName string `json:"mechanicName"`
	}
	if err := a.gw.CallS2S(ctx, "ms-taller", http.MethodPost, "/internal-s2s/invoice-sync", idem, map[string]any{
		"idempotencyKey": idem,
		"workOrderId":    workOrderID,
		"mechanicId":     mechanicID,
		"laborGross":     laborGross,
		"invoiceNumber":  invoiceNumber,
	}, &resp); err != nil {
		return "", err
	}
	if !resp.Ok {
		return "", apperr.Conflict("ms-taller rechazó la liquidación de la orden")
	}
	return resp.MechanicName, nil
}

func (a *HospitalityAdapter) CompleteRoomCheckout(ctx context.Context, roomID, invoiceNumber string) error {
	if a == nil || a.gw == nil {
		return nil
	}
	idem := strings.TrimSpace(authguard.FromContext(ctx).IdempotencyKey)
	if idem != "" {
		idem += ":hotel"
	} else {
		idem = "hotel:" + invoiceNumber
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	if err := a.gw.CallS2S(ctx, "ms-hoteleria", http.MethodPost, "/internal-s2s/checkout", idem, map[string]any{
		"idempotencyKey": idem,
		"roomId":         roomID,
		"invoiceNumber":  invoiceNumber,
	}, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Conflict("ms-hoteleria rechazó el check-out de la habitación")
	}
	return nil
}

func (a *GastroAdapter) ClearInvoicedTable(ctx context.Context, tableID, invoiceNumber string) error {
	if a == nil || a.gw == nil {
		return nil
	}
	idem := strings.TrimSpace(authguard.FromContext(ctx).IdempotencyKey)
	if idem != "" {
		idem += ":gastro"
	} else {
		idem = "gastro:" + invoiceNumber
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	if err := a.gw.CallS2S(ctx, "ms-comandas", http.MethodPost, "/internal-s2s/clear-table", idem, map[string]any{
		"idempotencyKey": idem,
		"tableId":        tableID,
		"invoiceNumber":  invoiceNumber,
	}, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Conflict("ms-comandas rechazó la liberación de la mesa")
	}
	return nil
}

func (a *PrintAdapter) RenderInvoice(ctx context.Context, inv domain.Invoice) (string, error) {
	if a == nil || a.gw == nil {
		return "", nil
	}
	extra := make(map[string]string)
	if inv.Plate != "" {
		extra["Placa"] = inv.Plate
	}
	if inv.WorkshopMeta.VehicleBrand != "" {
		extra["Vehículo"] = inv.WorkshopMeta.VehicleBrand
	}
	if inv.WorkshopMeta.CurrentKm != "" {
		extra["Kilometraje"] = inv.WorkshopMeta.CurrentKm
	}
	if inv.WorkshopMeta.NextOilKm != "" {
		extra["Próximo Aceite"] = inv.WorkshopMeta.NextOilKm
	}
	if inv.WorkshopMeta.WorkOrderID != "" {
		extra["Orden de Servicio"] = inv.WorkshopMeta.WorkOrderID
	}
	if inv.MechanicName != "" {
		extra["Técnico / Mecánico"] = inv.MechanicName
	}
	if inv.CUFE != "" {
		extra["CUFE"] = inv.CUFE
		if inv.DianStatus != "" {
			extra["Estado DIAN"] = inv.DianStatus
		}
	}

	docType := "FACTURA DE VENTA POS"
	if inv.CUFE != "" {
		docType = "FACTURA ELECTRÓNICA DE VENTA"
	}

	items := make([]map[string]any, 0, len(inv.Items))
	for _, it := range inv.Items {
		items = append(items, map[string]any{
			"code":        it.Code,
			"description": it.Description,
			"quantity":    it.Quantity,
			"unit_price":  it.UnitPrice,
			"tax_pct":     it.TaxPct,
			"subtotal":    it.Subtotal,
		})
	}

	var resp struct {
		HTMLPrintable string `json:"html_printable"`
	}
	if err := a.gw.CallS2S(ctx, "ms-impresiones", http.MethodPost, "/render", "", map[string]any{
		"document_type":    docType,
		"layout_variant":   inv.LayoutVariant,
		"document_number":  inv.ID,
		"issue_date":       inv.IssueDate,
		"customer_name":    inv.CustomerName,
		"customer_nit":     inv.CustomerNIT,
		"customer_phone":   inv.CustomerPhone,
		"customer_address": inv.CustomerAddress,
		"payment_method":   inv.PaymentMethod,
		"extra_fields":     extra,
		"items":            items,
		"subtotal":         inv.Subtotal,
		"discount_total":   inv.DiscountTotal,
		"tax_total":        inv.TaxTotal,
		"grand_total":      inv.Total,
		"pending_balance":  inv.PendingBalance,
		"notes":            inv.Notes,
	}, &resp); err != nil {
		return "", err
	}
	return resp.HTMLPrintable, nil
}
