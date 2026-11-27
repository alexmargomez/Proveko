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

	InvoiceTypeMostrador   = "MOSTRADOR"
	InvoiceTypeTaller      = "TALLER"
	InvoiceTypeHoteleria   = "HOTELERIA"
	InvoiceTypeComanda     = "COMANDA"
	InvoiceTypeCorporativa = "CORPORATIVA_CXC"

	DocStatusBorrador   = "BORRADOR"
	DocStatusConfirmada = "CONFIRMADA"
	DocStatusAnuladaNC  = "ANULADA_NC"

	StatusBorrador     = "Borrador"
	StatusPagada       = "Pagada"
	StatusPendienteCxC = "Pendiente CxC"
	StatusAnuladaNC    = "Anulada NC"

	NoteKindCredit = "CREDIT"
	NoteKindDebit  = "DEBIT"

	DocKindInvoice    = "INVOICE"
	DocKindCreditNote = "CREDIT_NOTE"
	DocKindDebitNote  = "DEBIT_NOTE"

	DianStageSinEnviar = "SIN_ENVIAR"
	DianStageEnviada   = "ENVIADA"
	DianStageAceptada  = "ACEPTADA"
	DianStageRechazada = "RECHAZADA"

	DianStatusEnviada   = "ENVIADA DIAN"
	DianStatusAceptada  = "ACEPTADA DIAN"
	DianStatusRechazada = "RECHAZADA DIAN"

	SaveModeDraft   = "DRAFT"
	SaveModeConfirm = "CONFIRM"

	LayoutTaller = "factura_taller"
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
	ID               string           `json:"id"`
	Number           string           `json:"number"`
	InvoiceType      string           `json:"invoiceType"`
	DocStatus        string           `json:"docStatus"`
	IssueDate        string           `json:"issueDate"`
	Date             string           `json:"date"`
	DueDate          string           `json:"dueDate,omitempty"`
	PurchaseOrderRef string           `json:"purchaseOrderRef,omitempty"`
	CustomerID       string           `json:"customerId"`
	CustomerName     string           `json:"customerName"`
	CustomerNIT      string           `json:"customerNit"`
	CustomerPhone    string           `json:"customerPhone,omitempty"`
	CustomerAddress  string           `json:"customerAddress,omitempty"`
	ContractID       string           `json:"contractId,omitempty"`
	DiscountPct      float64          `json:"discountPct"`
	VehicleID        string           `json:"vehicleId,omitempty"`
	Plate            string           `json:"plate,omitempty"`
	MechanicID       string           `json:"mechanicId,omitempty"`
	MechanicName     string           `json:"mechanicName,omitempty"`
	WorkshopMeta     WorkshopMetadata `json:"workshopMeta"`
	LinkedRoomID     string           `json:"linkedRoomId,omitempty"`
	LinkedTableID    string           `json:"linkedTableId,omitempty"`
	LayoutVariant    string           `json:"layoutVariant,omitempty"`
	CUFE             string           `json:"cufe,omitempty"`
	DianStatus       string           `json:"dianStatus,omitempty"`
	DianStage        string           `json:"dianStage"`
	TrackID          string           `json:"trackId,omitempty"`
	DianSentAt       string           `json:"dianSentAt,omitempty"`
	DianRespondedAt  string           `json:"dianRespondedAt,omitempty"`
	RejectionCode    string           `json:"rejectionCode,omitempty"`
	RejectionMessage string           `json:"rejectionMessage,omitempty"`
	DianAttempts     int              `json:"dianAttempts,omitempty"`
	Editable         bool             `json:"editable"`
	Items            []InvoiceItem    `json:"items"`
	Subtotal         float64          `json:"subtotal"`
	DiscountTotal    float64          `json:"discountTotal"`
	TaxTotal         float64          `json:"taxTotal"`
	Total            float64          `json:"total"`
	CreditedTotal    float64          `json:"creditedTotal"`
	DebitedTotal     float64          `json:"debitedTotal"`
	PaymentMethod    string           `json:"paymentMethod"`
	AmountPaid       float64          `json:"amountPaid"`
	PendingBalance   float64          `json:"pendingBalance"`
	Status           string           `json:"status"`
	Notes            string           `json:"notes,omitempty"`
	Actor            string           `json:"actor,omitempty"`
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

type AdjustmentNote struct {
	ID                string        `json:"id"`
	Number            string        `json:"number"`
	NoteKind          string        `json:"noteKind"`
	InvoiceID         string        `json:"invoiceId"`
	ReferencedCUFE    string        `json:"referencedCufe,omitempty"`
	CustomerID        string        `json:"customerId"`
	CustomerName      string        `json:"customerName"`
	CustomerNIT       string        `json:"customerNit"`
	ReasonCode        string        `json:"reasonCode"`
	ReasonDescription string        `json:"reasonDescription"`
	RestockInventory  bool          `json:"restockInventory"`
	DocStatus         string        `json:"docStatus"`
	CUDE              string        `json:"cude,omitempty"`
	DianStage         string        `json:"dianStage"`
	DianStatus        string        `json:"dianStatus,omitempty"`
	TrackID           string        `json:"trackId,omitempty"`
	DianSentAt        string        `json:"dianSentAt,omitempty"`
	DianRespondedAt   string        `json:"dianRespondedAt,omitempty"`
	RejectionCode     string        `json:"rejectionCode,omitempty"`
	RejectionMessage  string        `json:"rejectionMessage,omitempty"`
	DianAttempts      int           `json:"dianAttempts,omitempty"`
	Editable          bool          `json:"editable"`
	Items             []InvoiceItem `json:"items"`
	Subtotal          float64       `json:"subtotal"`
	TaxTotal          float64       `json:"taxTotal"`
	Total             float64       `json:"total"`
	IssueDate         string        `json:"issueDate"`
	Actor             string        `json:"actor,omitempty"`
}

func (n AdjustmentNote) Clone() AdjustmentNote {
	cp := n
	if n.Items != nil {
		cp.Items = make([]InvoiceItem, len(n.Items))
		copy(cp.Items, n.Items)
	} else {
		cp.Items = []InvoiceItem{}
	}
	return cp
}

type DianTransmission struct {
	DocumentKind     string `json:"documentKind"`
	DocumentID       string `json:"documentId"`
	DianStage        string `json:"dianStage"`
	CUFEOrCUDE       string `json:"cufeOrCude,omitempty"`
	ReferencedCUFE   string `json:"referencedCufe,omitempty"`
	TrackID          string `json:"trackId,omitempty"`
	Environment      string `json:"environment"`
	SentAt           string `json:"sentAt,omitempty"`
	RespondedAt      string `json:"respondedAt,omitempty"`
	RejectionCode    string `json:"rejectionCode,omitempty"`
	RejectionMessage string `json:"rejectionMessage,omitempty"`
	Attempts         int    `json:"attempts"`
}

func (dt DianTransmission) Clone() DianTransmission {
	return dt
}

func InferInvoiceType(inv Invoice) string {
	t := strings.ToUpper(strings.TrimSpace(inv.InvoiceType))
	switch t {
	case InvoiceTypeMostrador, InvoiceTypeTaller, InvoiceTypeHoteleria, InvoiceTypeComanda, InvoiceTypeCorporativa:
		return t
	}
	if strings.TrimSpace(inv.Plate) != "" || strings.TrimSpace(inv.VehicleID) != "" || strings.TrimSpace(inv.WorkshopMeta.WorkOrderID) != "" {
		return InvoiceTypeTaller
	}
	if strings.TrimSpace(inv.LinkedRoomID) != "" {
		return InvoiceTypeHoteleria
	}
	if strings.TrimSpace(inv.LinkedTableID) != "" {
		return InvoiceTypeComanda
	}
	if strings.TrimSpace(inv.ContractID) != "" || strings.TrimSpace(inv.PurchaseOrderRef) != "" || strings.TrimSpace(inv.DueDate) != "" {
		return InvoiceTypeCorporativa
	}
	return InvoiceTypeMostrador
}

func HydrateInvoiceState(inv *Invoice, dt *DianTransmission) {
	if inv == nil {
		return
	}
	inv.Number = inv.ID
	if inv.Date == "" {
		inv.Date = inv.IssueDate
	}
	inv.InvoiceType = InferInvoiceType(*inv)
	if strings.TrimSpace(inv.DocStatus) == "" {
		inv.DocStatus = DocStatusConfirmada
	}
	if dt != nil {
		inv.DianStage = dt.DianStage
		inv.TrackID = dt.TrackID
		inv.DianSentAt = dt.SentAt
		inv.DianRespondedAt = dt.RespondedAt
		inv.RejectionCode = dt.RejectionCode
		inv.RejectionMessage = dt.RejectionMessage
		inv.DianAttempts = dt.Attempts
		switch dt.DianStage {
		case DianStageAceptada:
			if strings.TrimSpace(dt.CUFEOrCUDE) != "" {
				inv.CUFE = dt.CUFEOrCUDE
			}
			inv.DianStatus = DianStatusAceptada
		case DianStageEnviada:
			inv.CUFE = ""
			inv.DianStatus = DianStatusEnviada
		case DianStageRechazada:
			inv.CUFE = ""
			inv.DianStatus = DianStatusRechazada
		default:
			inv.DianStage = DianStageSinEnviar
			inv.CUFE = ""
		}
	} else {
		if strings.TrimSpace(inv.CUFE) != "" {
			inv.DianStage = DianStageAceptada
			if inv.DianStatus == "" {
				inv.DianStatus = DianStatusAceptada
			}
		} else if strings.TrimSpace(inv.DianStage) == "" {
			inv.DianStage = DianStageSinEnviar
		}
	}
	inv.Editable = inv.DocStatus != DocStatusAnuladaNC &&
		inv.DianStage != DianStageEnviada &&
		inv.DianStage != DianStageAceptada
}

func DocumentKindForNoteKind(noteKind string) string {
	if strings.EqualFold(strings.TrimSpace(noteKind), NoteKindDebit) {
		return DocKindDebitNote
	}
	return DocKindCreditNote
}

func HydrateAdjustmentNoteState(note *AdjustmentNote, dt *DianTransmission) {
	if note == nil {
		return
	}
	note.Number = note.ID
	if strings.TrimSpace(note.DocStatus) == "" {
		note.DocStatus = DocStatusConfirmada
	}
	if dt != nil {
		note.DianStage = dt.DianStage
		note.TrackID = dt.TrackID
		note.DianSentAt = dt.SentAt
		note.DianRespondedAt = dt.RespondedAt
		note.RejectionCode = dt.RejectionCode
		note.RejectionMessage = dt.RejectionMessage
		note.DianAttempts = dt.Attempts
		switch dt.DianStage {
		case DianStageAceptada:
			if strings.TrimSpace(dt.CUFEOrCUDE) != "" {
				note.CUDE = dt.CUFEOrCUDE
			}
			note.DianStatus = DianStatusAceptada
		case DianStageEnviada:
			note.CUDE = ""
			note.DianStatus = DianStatusEnviada
		case DianStageRechazada:
			note.CUDE = ""
			note.DianStatus = DianStatusRechazada
		default:
			note.DianStage = DianStageSinEnviar
			note.CUDE = ""
			note.DianStatus = ""
		}
	} else {
		if strings.TrimSpace(note.CUDE) != "" {
			note.DianStage = DianStageAceptada
			if note.DianStatus == "" {
				note.DianStatus = DianStatusAceptada
			}
		} else if strings.TrimSpace(note.DianStage) == "" {
			note.DianStage = DianStageSinEnviar
		}
	}
	note.Editable = note.DianStage != DianStageEnviada && note.DianStage != DianStageAceptada
}

func DefaultReasonDescription(noteKind, reasonCode string) string {
	code := strings.TrimSpace(reasonCode)
	if strings.EqualFold(strings.TrimSpace(noteKind), NoteKindDebit) {
		switch code {
		case "1":
			return "Intereses moratorios o financieros"
		case "2":
			return "Gastos por cobrar adicionales"
		case "3":
			return "Cambio del valor comercial mayor"
		default:
			return "Otros conceptos de Nota Débito"
		}
	}
	switch code {
	case "1":
		return "Devolución parcial de los bienes y/o no aceptación parcial del servicio"
	case "2":
		return "Anulación de factura electrónica"
	case "3":
		return "Rebaja o descuento parcial o total"
	case "4":
		return "Ajuste de precio"
	default:
		return "Otros conceptos de Nota Crédito"
	}
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

type UpdateInvoiceInput = CreateInvoiceInput

type CreateInvoiceResult struct {
	Invoice   Invoice `json:"invoice"`
	PrintHTML string  `json:"printHtml"`
	Replayed  bool    `json:"-"`
}

type CreateAdjustmentNoteInput struct {
	SaveMode          string        `json:"saveMode"`
	NoteKind          string        `json:"noteKind"`
	InvoiceID         string        `json:"invoiceId"`
	CustomerName      string        `json:"customerName"`
	CustomerNIT       string        `json:"customerNit"`
	ReasonCode        string        `json:"reasonCode"`
	ReasonDescription string        `json:"reasonDescription"`
	RestockInventory  bool          `json:"restockInventory"`
	Items             []InvoiceItem `json:"items"`
}

type UpdateAdjustmentNoteInput = CreateAdjustmentNoteInput

type DianSendInput struct {
	DocumentKind string `json:"documentKind"`
	DocumentID   string `json:"documentId"`
}

type DianRespondInput struct {
	DocumentKind     string `json:"documentKind"`
	DocumentID       string `json:"documentId"`
	Outcome          string `json:"outcome"`
	RejectionCode    string `json:"rejectionCode"`
	RejectionMessage string `json:"rejectionMessage"`
}

type DianActionResult struct {
	Transmission   DianTransmission `json:"transmission"`
	Invoice        *Invoice         `json:"invoice,omitempty"`
	AdjustmentNote *AdjustmentNote  `json:"adjustmentNote,omitempty"`
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
	NextInvoiceNumber    string             `json:"nextInvoiceNumber"`
	NextQuoteNumber      string             `json:"nextQuoteNumber"`
	NextCreditNoteNumber string             `json:"nextCreditNoteNumber"`
	NextDebitNoteNumber  string             `json:"nextDebitNoteNumber"`
	Invoices             []Invoice          `json:"invoices"`
	Quotes               []Quote            `json:"quotes"`
	AdjustmentNotes      []AdjustmentNote   `json:"adjustmentNotes"`
	DianTransmissions    []DianTransmission `json:"dianTransmissions"`
	Summary              SalesSummary       `json:"summary"`
}

func ComputeSummary(invoices []Invoice, quoteCount int) SalesSummary {
	var out SalesSummary
	out.QuoteCount = quoteCount
	for _, inv := range invoices {
		if inv.DocStatus == DocStatusBorrador {
			continue
		}
		out.InvoiceCount++
		if inv.DocStatus != DocStatusAnuladaNC {
			netTotal := money.RoundCents(inv.Total - inv.CreditedTotal + inv.DebitedTotal)
			if netTotal < 0 {
				netTotal = 0
			}
			out.TotalSales = money.RoundCents(out.TotalSales + netTotal)
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

func DeterministicCUDE(id, issueDate, invoiceID, referencedCUFE string, subtotal, taxTotal, total float64, customerNIT string) string {
	canonical := fmt.Sprintf(
		"CUDE|%s|%s|%s|%s|%.2f|%.2f|%.2f|%s",
		strings.TrimSpace(id),
		strings.TrimSpace(issueDate),
		strings.TrimSpace(invoiceID),
		strings.TrimSpace(referencedCUFE),
		subtotal,
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
	d3 := now.Add(-18 * time.Minute).Format("2006-01-02 15:04")
	d4 := now.Add(-8 * time.Minute).Format("2006-01-02 15:04")
	qd := now.Add(-2 * time.Hour).Format("2006-01-02 15:04")
	validUntil := now.AddDate(0, 0, 15).Format("2006-01-02")
	dueDate := now.AddDate(0, 0, 30).Format("2006-01-02")

	inv1 := Invoice{
		ID:            "FEVP-9012",
		Number:        "FEVP-9012",
		InvoiceType:   InvoiceTypeTaller,
		DocStatus:     DocStatusConfirmada,
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
		CreditedTotal:  30000,
		PaymentMethod:  "Transferencia / Nequi",
		AmountPaid:     429400,
		PendingBalance: 0,
		Status:         StatusPagada,
		DianStatus:     DianStatusAceptada,
		DianStage:      DianStageAceptada,
		Editable:       false,
		Actor:          "caja@empresa.co",
	}
	inv1.CUFE = DeterministicCUFE(inv1.ID, inv1.IssueDate, inv1.Subtotal, inv1.DiscountTotal, inv1.TaxTotal, inv1.Total, inv1.CustomerNIT)

	inv2 := Invoice{
		ID:               "FEVP-9011",
		Number:           "FEVP-9011",
		InvoiceType:      InvoiceTypeCorporativa,
		DocStatus:        DocStatusConfirmada,
		IssueDate:        d2,
		Date:             d2,
		DueDate:          dueDate,
		PurchaseOrderRef: "OC-2026-441",
		CustomerID:       "cli-102",
		CustomerName:     "Distribuidora del Valle Ltda.",
		CustomerNIT:      "890.312.445-9",
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
		PaymentMethod:  "Crédito / Cartera CxC",
		AmountPaid:     150000,
		PendingBalance: 147500,
		Status:         StatusPendienteCxC,
		DianStatus:     DianStatusAceptada,
		DianStage:      DianStageAceptada,
		Editable:       false,
		Actor:          "caja@empresa.co",
	}
	inv2.CUFE = DeterministicCUFE(inv2.ID, inv2.IssueDate, inv2.Subtotal, inv2.DiscountTotal, inv2.TaxTotal, inv2.Total, inv2.CustomerNIT)

	inv3 := Invoice{
		ID:            "FEVP-9010",
		Number:        "FEVP-9010",
		InvoiceType:   InvoiceTypeMostrador,
		DocStatus:     DocStatusConfirmada,
		IssueDate:     d3,
		Date:          d3,
		CustomerID:    "",
		CustomerName:  "Comercializadora El Dorado S.A.S.",
		CustomerNIT:   "900.774.129-4",
		Items: []InvoiceItem{
			{
				ProductID:   "prd-101",
				Code:        "PRD-101",
				Description: "Kit Filtro y Lubricante Sintético 5W-30",
				ItemType:    ItemTypeProducto,
				Quantity:    1,
				UnitPrice:   130000,
				TaxPct:      19,
				Subtotal:    130000,
			},
		},
		Subtotal:       130000,
		DiscountTotal:  0,
		TaxTotal:       24700,
		Total:          154700,
		PaymentMethod:  "Efectivo",
		AmountPaid:     154700,
		PendingBalance: 0,
		Status:         StatusPagada,
		DianStage:      DianStageSinEnviar,
		Editable:       true,
		Notes:          "Lista para transmitir a la DIAN (Paso 1)",
		Actor:          "caja@empresa.co",
	}

	inv4 := Invoice{
		ID:            "BOR-1001",
		Number:        "BOR-1001",
		InvoiceType:   InvoiceTypeMostrador,
		DocStatus:     DocStatusBorrador,
		IssueDate:     d4,
		Date:          d4,
		CustomerID:    "cli-101",
		CustomerName:  "Inversiones Andinas S.A.S.",
		CustomerNIT:   "901.245.880-1",
		Items: []InvoiceItem{
			{
				ProductID:   "",
				Code:        "SRV-REV",
				Description: "Inspección Técnica Multipunto Flota",
				ItemType:    ItemTypeServicio,
				Quantity:    2,
				UnitPrice:   95000,
				TaxPct:      19,
				Subtotal:    190000,
			},
		},
		Subtotal:       190000,
		DiscountTotal:  0,
		TaxTotal:       36100,
		Total:          226100,
		PaymentMethod:  "Transferencia / Nequi",
		AmountPaid:     226100,
		PendingBalance: 0,
		Status:         StatusBorrador,
		DianStage:      DianStageSinEnviar,
		Editable:       true,
		Notes:          "Pendiente visto bueno de jefe de flota antes de confirmar",
		Actor:          "caja@empresa.co",
	}

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

	return []Invoice{inv4, inv3, inv1, inv2}, quotes
}

func DefaultSeedFiscalData(now time.Time, invoices []Invoice) ([]AdjustmentNote, []DianTransmission) {
	var txs []DianTransmission
	var inv1CUFE string
	for _, inv := range invoices {
		if inv.DocStatus == DocStatusBorrador {
			continue
		}
		if inv.ID == "FEVP-9012" {
			inv1CUFE = inv.CUFE
		}
		if strings.TrimSpace(inv.CUFE) != "" {
			txs = append(txs, DianTransmission{
				DocumentKind: DocKindInvoice,
				DocumentID:   inv.ID,
				DianStage:    DianStageAceptada,
				CUFEOrCUDE:   inv.CUFE,
				TrackID:      "TRK-" + strings.ReplaceAll(inv.ID, "-", "") + "-01",
				Environment:  "PRODUCCION",
				SentAt:       inv.IssueDate,
				RespondedAt:  inv.IssueDate,
				Attempts:     1,
			})
		} else {
			txs = append(txs, DianTransmission{
				DocumentKind: DocKindInvoice,
				DocumentID:   inv.ID,
				DianStage:    DianStageSinEnviar,
				Environment:  "PRODUCCION",
				Attempts:     0,
			})
		}
	}

	nd := now.Add(-15 * time.Minute).Format("2006-01-02 15:04")
	note1 := AdjustmentNote{
		ID:                "NC-1001",
		Number:            "NC-1001",
		NoteKind:          NoteKindCredit,
		InvoiceID:         "FEVP-9012",
		ReferencedCUFE:    inv1CUFE,
		CustomerID:        "cli-101",
		CustomerName:      "Inversiones Andinas S.A.S.",
		CustomerNIT:       "901.245.880-1",
		ReasonCode:        "3",
		ReasonDescription: "Rebaja o descuento parcial por volumen corporativo",
		RestockInventory:  false,
		DocStatus:         DocStatusConfirmada,
		DianStage:         DianStageSinEnviar,
		Editable:          true,
		Items: []InvoiceItem{
			{
				Code:        "AJ-DESC",
				Description: "Descuento pronto pago orden OT-704",
				ItemType:    ItemTypeServicio,
				Quantity:    1,
				UnitPrice:   30000,
				TaxPct:      0,
				Subtotal:    30000,
			},
		},
		Subtotal:  30000,
		TaxTotal:  0,
		Total:     30000,
		IssueDate: nd,
		Actor:     "caja@empresa.co",
	}
	txs = append(txs, DianTransmission{
		DocumentKind:   DocKindCreditNote,
		DocumentID:     note1.ID,
		DianStage:      DianStageSinEnviar,
		ReferencedCUFE: inv1CUFE,
		Environment:    "PRODUCCION",
		Attempts:       0,
	})

	return []AdjustmentNote{note1}, txs
}
