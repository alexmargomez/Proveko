package domain

import (
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"ms-facturacion/internal/platform/money"
)

const (
	ItemTypeProducto = "PRODUCTO"
	ItemTypeServicio = "SERVICIO"

	StatusPagada       = "Pagada"
	StatusPendienteCxC = "Pendiente CxC"
	DianStatusAceptada = "ACEPTADA DIAN"
	LayoutTaller       = "factura_taller"
)

type InvoiceItem struct {
	ProductID   string  `json:"productId"`
	Code        string  `json:"code"`
	Description string  `json:"description"`
	ItemType    string  `json:"itemType"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice"`
	TaxPct      float64 `json:"taxPct"`
	Subtotal    float64 `json:"subtotal"`
	WorkerID    string  `json:"workerId,omitempty"`
	WorkerName  string  `json:"workerName,omitempty"`
}

func (i InvoiceItem) Clone() InvoiceItem {
	return i
}

type WorkshopMetadata struct {
	VehicleBrand string `json:"vehicleBrand,omitempty"`
	CurrentKm    string `json:"currentKm,omitempty"`
	NextOilKm    string `json:"nextOilKm,omitempty"`
	WorkOrderID  string `json:"workOrderId,omitempty"`
}

func (m WorkshopMetadata) IsEmpty() bool {
	return strings.TrimSpace(m.VehicleBrand) == "" &&
		strings.TrimSpace(m.CurrentKm) == "" &&
		strings.TrimSpace(m.NextOilKm) == "" &&
		strings.TrimSpace(m.WorkOrderID) == ""
}

type Invoice struct {
	ID              string           `json:"id"`
	Number          string           `json:"number"`
	IssueDate       string           `json:"issueDate"`
	Date            string           `json:"date"`
	CustomerID      string           `json:"customerId"`
	CustomerName    string           `json:"customerName"`
	CustomerNIT     string           `json:"customerNit"`
	CustomerPhone   string           `json:"customerPhone,omitempty"`
	CustomerAddress string           `json:"customerAddress,omitempty"`
	ContractID      string           `json:"contractId,omitempty"`
	DiscountPct     float64          `json:"discountPct"`
	VehicleID       string           `json:"vehicleId,omitempty"`
	Plate           string           `json:"plate,omitempty"`
	MechanicID      string           `json:"mechanicId,omitempty"`
	MechanicName    string           `json:"mechanicName,omitempty"`
	WorkshopMeta    WorkshopMetadata `json:"workshopMeta"`
	LinkedRoomID    string           `json:"linkedRoomId,omitempty"`
	LinkedTableID   string           `json:"linkedTableId,omitempty"`
	LayoutVariant   string           `json:"layoutVariant,omitempty"`
	CUFE            string           `json:"cufe,omitempty"`
	DianStatus      string           `json:"dianStatus,omitempty"`
	Items           []InvoiceItem    `json:"items"`
	Subtotal        float64          `json:"subtotal"`
	DiscountTotal   float64          `json:"discountTotal"`
	TaxTotal        float64          `json:"taxTotal"`
	Total           float64          `json:"total"`
	PaymentMethod   string           `json:"paymentMethod"`
	AmountPaid      float64          `json:"amountPaid"`
	PendingBalance  float64          `json:"pendingBalance"`
	Status          string           `json:"status"`
	Notes           string           `json:"notes,omitempty"`
	Actor           string           `json:"actor,omitempty"`
}

func (inv Invoice) Clone() Invoice {
	cp := inv
	if inv.Items != nil {
		cp.Items = make([]InvoiceItem, len(inv.Items))
		copy(cp.Items, inv.Items)
	} else {
		cp.Items = []InvoiceItem{}
	}
	return cp
}

type Quote struct {
	ID           string        `json:"id"`
	CreatedAt    string        `json:"createdAt"`
	CustomerID   string        `json:"customerId"`
	CustomerName string        `json:"customerName"`
	CustomerNIT  string        `json:"customerNit"`
	ValidUntil   string        `json:"validUntil"`
	Items        []InvoiceItem `json:"items"`
	Subtotal     float64       `json:"subtotal"`
	TaxTotal     float64       `json:"taxTotal"`
	Total        float64       `json:"total"`
	Status       string        `json:"status"`
	Notes        string        `json:"notes"`
}

func (q Quote) Clone() Quote {
	cp := q
	if q.Items != nil {
		cp.Items = make([]InvoiceItem, len(q.Items))
		copy(cp.Items, q.Items)
	} else {
		cp.Items = []InvoiceItem{}
	}
	return cp
}

type SalesSummary struct {
	InvoiceCount            int     `json:"invoiceCount"`
	QuoteCount              int     `json:"quoteCount"`
	TotalSales              float64 `json:"totalSales"`
	TotalDiscount           float64 `json:"totalDiscount"`
	TotalTax                float64 `json:"totalTax"`
	TotalCollected          float64 `json:"totalCollected"`
	TotalPendingReceivables float64 `json:"totalPendingReceivables"`
	CashSales               float64 `json:"cashSales"`
	DigitalSales            float64 `json:"digitalSales"`
	CashCollected           float64 `json:"cashCollected"`
	DigitalCollected        float64 `json:"digitalCollected"`
	DianAcceptedCount       int     `json:"dianAcceptedCount"`
	WorkshopInvoiceCount    int     `json:"workshopInvoiceCount"`
}

type CreateInvoiceInput struct {
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
	WorkshopMeta      WorkshopMetadata `json:"workshopMeta"`
	LinkedWorkOrderID string           `json:"linkedWorkOrderId"`
	LinkedRoomID      string           `json:"linkedRoomId"`
	LinkedTableID     string           `json:"linkedTableId"`
	LayoutVariant     string           `json:"layoutVariant"`
	Items             []InvoiceItem    `json:"items"`
	PaymentMethod     string           `json:"paymentMethod"`
	AmountPaid        *float64         `json:"amountPaid"`
	Notes             string           `json:"notes"`
	RenderPrint       bool             `json:"renderPrint"`
}

type CreateInvoiceResult struct {
	Invoice   Invoice `json:"invoice"`
	PrintHTML string  `json:"printHtml"`
	Replayed  bool    `json:"-"`
}

type CreateQuoteInput struct {
	CustomerID   string        `json:"customerId"`
	CustomerName string        `json:"customerName"`
	CustomerNIT  string        `json:"customerNit"`
	ValidUntil   string        `json:"validUntil"`
	Notes        string        `json:"notes"`
	Items        []InvoiceItem `json:"items"`
}

type PosState struct {
	NextInvoiceNumber string       `json:"nextInvoiceNumber"`
	NextQuoteNumber   string       `json:"nextQuoteNumber"`
	Invoices          []Invoice    `json:"invoices"`
	Quotes            []Quote      `json:"quotes"`
	Summary           SalesSummary `json:"summary"`
}

func ComputeSummary(invoices []Invoice, quoteCount int) SalesSummary {
	var out SalesSummary
	out.InvoiceCount = len(invoices)
	out.QuoteCount = quoteCount
	for _, inv := range invoices {
		out.TotalSales = money.RoundCents(out.TotalSales + inv.Total)
		out.TotalDiscount = money.RoundCents(out.TotalDiscount + inv.DiscountTotal)
		out.TotalTax = money.RoundCents(out.TotalTax + inv.TaxTotal)
		out.TotalCollected = money.RoundCents(out.TotalCollected + inv.AmountPaid)
		out.TotalPendingReceivables = money.RoundCents(out.TotalPendingReceivables + inv.PendingBalance)

		methodLower := strings.ToLower(strings.TrimSpace(inv.PaymentMethod))
		if strings.Contains(methodLower, "efectivo") {
			out.CashSales = money.RoundCents(out.CashSales + inv.AmountPaid)
		} else {
			out.DigitalSales = money.RoundCents(out.DigitalSales + inv.AmountPaid)
		}

		if strings.TrimSpace(inv.CUFE) != "" {
			out.DianAcceptedCount++
		}
		if strings.TrimSpace(inv.Plate) != "" || strings.TrimSpace(inv.VehicleID) != "" {
			out.WorkshopInvoiceCount++
		}
	}
	out.CashCollected = out.CashSales
	out.DigitalCollected = out.DigitalSales
	return out
}

func DeterministicCUFE(id, issueDate string, subtotal, discountTotal, taxTotal, total float64, customerNIT string) string {
	canonical := fmt.Sprintf(
		"%s|%s|%.2f|%.2f|%.2f|%.2f|%s",
		strings.TrimSpace(id),
		strings.TrimSpace(issueDate),
		subtotal,
		discountTotal,
		taxTotal,
		total,
		strings.TrimSpace(customerNIT),
	)
	sum := sha512.Sum384([]byte(canonical))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

func DefaultSeedData(now time.Time) ([]Invoice, []Quote) {
	d1 := now.Add(-40 * time.Minute).Format("2006-01-02 15:04")
	d2 := now.Add(-3 * time.Hour).Format("2006-01-02 15:04")
	qd := now.Add(-2 * time.Hour).Format("2006-01-02 15:04")
	validUntil := now.AddDate(0, 0, 15).Format("2006-01-02")

	inv1 := Invoice{
		ID:            "FEVP-9012",
		Number:        "FEVP-9012",
		IssueDate:     d1,
		Date:          d1,
		CustomerID:    "cli-101",
		CustomerName:  "Inversiones Andinas S.A.S.",
		CustomerNIT:   "901.245.880-1",
		VehicleID:     "veh-201",
		Plate:         "KLP842",
		MechanicID:    "tec-104",
		MechanicName:  "Especialista Automotriz Planta",
		LayoutVariant: LayoutTaller,
		WorkshopMeta: WorkshopMetadata{
			VehicleBrand: "Toyota Hilux 2.8 4x4",
			CurrentKm:    "68.400 km",
			NextOilKm:    "73.400 km",
			WorkOrderID:  "OT-704",
		},
		Items: []InvoiceItem{
			{
				ProductID:   "prd-101",
				Code:        "PRD-101",
				Description: "Kit Filtro y Lubricante Sintético 5W-30",
				ItemType:    ItemTypeProducto,
				Quantity:    2,
				UnitPrice:   130000,
				TaxPct:      19,
				Subtotal:    260000,
			},
			{
				ProductID:   "",
				Code:        "SRV-MO",
				Description: "Servicio Especializado de Sincronización y Diagnóstico",
				ItemType:    ItemTypeServicio,
				Quantity:    1,
				UnitPrice:   120000,
				TaxPct:      0,
				Subtotal:    120000,
				WorkerID:    "tec-104",
				WorkerName:  "Especialista Automotriz Planta",
			},
		},
		Subtotal:       380000,
		DiscountTotal:  0,
		TaxTotal:       49400,
		Total:          429400,
		PaymentMethod:  "Transferencia / Nequi",
		AmountPaid:     429400,
		PendingBalance: 0,
		Status:         StatusPagada,
		DianStatus:     DianStatusAceptada,
		Actor:          "caja@empresa.co",
	}
	inv1.CUFE = DeterministicCUFE(inv1.ID, inv1.IssueDate, inv1.Subtotal, inv1.DiscountTotal, inv1.TaxTotal, inv1.Total, inv1.CustomerNIT)

	inv2 := Invoice{
		ID:           "FEVP-9011",
		Number:       "FEVP-9011",
		IssueDate:    d2,
		Date:         d2,
		CustomerID:   "cli-102",
		CustomerName: "Distribuidora del Valle Ltda.",
		CustomerNIT:  "890.312.445-9",
		Items: []InvoiceItem{
			{
				ProductID:   "prd-102",
				Code:        "PRD-102",
				Description: "Batería Sellada Libre Mantenimiento 800 AMP",
				ItemType:    ItemTypeProducto,
				Quantity:    1,
				UnitPrice:   250000,
				TaxPct:      19,
				Subtotal:    250000,
			},
		},
		Subtotal:       250000,
		DiscountTotal:  0,
		TaxTotal:       47500,
		Total:          297500,
		PaymentMethod:  "Efectivo",
		AmountPaid:     150000,
		PendingBalance: 147500,
		Status:         StatusPendienteCxC,
		DianStatus:     DianStatusAceptada,
		Actor:          "caja@empresa.co",
	}
	inv2.CUFE = DeterministicCUFE(inv2.ID, inv2.IssueDate, inv2.Subtotal, inv2.DiscountTotal, inv2.TaxTotal, inv2.Total, inv2.CustomerNIT)

	quotes := []Quote{
		{
			ID:           "COT-3011",
			CreatedAt:    qd,
			CustomerID:   "cli-101",
			CustomerName: "Inversiones Andinas S.A.S.",
			CustomerNIT:  "901.245.880-1",
			ValidUntil:   validUntil,
			Items: []InvoiceItem{
				{
					ProductID:   "prd-101",
					Code:        "PRD-101",
					Description: "Kit Filtro y Lubricante Sintético 5W-30",
					ItemType:    ItemTypeProducto,
					Quantity:    4,
					UnitPrice:   130000,
					TaxPct:      19,
					Subtotal:    520000,
				},
			},
			Subtotal: 520000,
			TaxTotal: 98800,
			Total:    618800,
			Status:   "Vigente",
			Notes:    "Entrega inmediata sujeta a disponibilidad en bodega principal.",
		},
	}

	return []Invoice{inv1, inv2}, quotes
}
