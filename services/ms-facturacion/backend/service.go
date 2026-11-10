package backend

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	customersv1 "github.com/alexmargomez/proveko/proto/customers/v1"
	gastrov1 "github.com/alexmargomez/proveko/proto/gastro/v1"
	hospitalityv1 "github.com/alexmargomez/proveko/proto/hospitality/v1"
	inventoryv1 "github.com/alexmargomez/proveko/proto/inventory/v1"
	printingv1 "github.com/alexmargomez/proveko/proto/printing/v1"
	workshopv1 "github.com/alexmargomez/proveko/proto/workshop/v1"
	"github.com/alexmargomez/proveko/services/ms-facturacion/backend/modules/facturacion_dian"
	"github.com/alexmargomez/proveko/services/ms-facturacion/backend/modules/facturas_taller"
	"github.com/go-chi/chi/v5"
)

type Clients struct {
	Inventory   inventoryv1.InventoryServiceClient
	Customers   customersv1.CustomerServiceClient
	Workshop    workshopv1.WorkshopServiceClient
	Hospitality hospitalityv1.HospitalityServiceClient
	Gastro      gastrov1.GastroServiceClient
	Printing    printingv1.PrintServiceClient
}

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
	clients       Clients
}

func NewService(db *tenantdb.Manager, clusterSecret string, clients Clients) *Service {
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
		clients:       clients,
	}
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/pos-state", s.handleGetPosState)
	r.Post("/invoices", s.handleCreateInvoice)
	r.Post("/quotes", s.handleCreateQuote)

	return r
}

func (s *Service) handleGetPosState(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		customers = []tenantdb.Customer{}
		products  = []tenantdb.Product{}
		contracts = []tenantdb.Contract{}
		tariffs   = []tenantdb.Tariff{}
		vehicles  = []tenantdb.Vehicle{}
		workers   = []tenantdb.Worker{}
		invoices  = []tenantdb.Invoice{}
		quotes    = []tenantdb.GenericRecord{}
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		if len(d.Customers) > 0 {
			customers = append(customers, d.Customers...)
		}
		if len(d.Products) > 0 {
			products = append(products, d.Products...)
		}
		if len(d.Contracts) > 0 {
			contracts = append(contracts, d.Contracts...)
		}
		if len(d.Tariffs) > 0 {
			tariffs = append(tariffs, d.Tariffs...)
		}
		if len(d.Vehicles) > 0 {
			vehicles = append(vehicles, d.Vehicles...)
		}
		if len(d.Workers) > 0 {
			workers = append(workers, d.Workers...)
		}
		if len(d.Invoices) > 0 {
			invoices = append(invoices, d.Invoices...)
		}
		if d.GenericModules != nil {
			if qList := d.GenericModules["cotizaciones"]; len(qList) > 0 {
				quotes = append(quotes, qList...)
			}
		}
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"nextInvoiceNumber": s.db.Seq.Peek(tc.DBName, "FEVP", 9011),
		"nextQuoteNumber":   s.db.Seq.Peek(tc.DBName, "COT", 3010),
		"customers":         customers,
		"products":          products,
		"contracts":         contracts,
		"tariffs":           tariffs,
		"vehicles":          vehicles,
		"workers":           workers,
		"invoices":          invoices,
		"quotes":            quotes,
	})
}

type createInvoicePayload struct {
	CustomerID        string                `json:"customerId"`
	ContractID        string                `json:"contractId"`
	TariffID          string                `json:"tariffId"`
	DiscountPct       *float64              `json:"discountPct"`
	VehicleID         string                `json:"vehicleId"`
	Plate             string                `json:"plate"`
	MechanicID        string                `json:"mechanicId"`
	WorkshopMeta      map[string]string     `json:"workshopMeta"`
	LinkedWorkOrderID string                `json:"linkedWorkOrderId"`
	LinkedRoomID      string                `json:"linkedRoomId"`
	LinkedTableID     string                `json:"linkedTableId"`
	LayoutVariant     string                `json:"layoutVariant"`
	Items             []tenantdb.InvoiceItem `json:"items"`
	PaymentMethod     string                `json:"paymentMethod"`
	AmountPaid        *float64              `json:"amountPaid"`
	Notes             string                `json:"notes"`
	RenderPrint       bool                  `json:"renderPrint"`
}

func (s *Service) handleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req createInvoicePayload
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de factura inválido")
		return
	}
	if len(req.Items) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Agrega al menos un producto o servicio para facturar")
		return
	}

	tc := authguard.FromContext(ctx)

	var (
		customer      tenantdb.Customer
		customerFound bool
		contractID    string
		tariffPct     float64
		issuerNit     string
		vehiclesSnap  []tenantdb.Vehicle
		workersSnap   []tenantdb.Worker
	)

	s.db.WithRead(ctx, tc.DBName, func(d *tenantdb.TenantData) {
		issuerNit = d.Branding.Nit
		vehiclesSnap = append(vehiclesSnap, d.Vehicles...)
		workersSnap = append(workersSnap, d.Workers...)

		for _, c := range d.Customers {
			if c.ID == req.CustomerID {
				customer = c
				customerFound = true
				break
			}
		}
		if !customerFound && len(d.Customers) > 0 {
			customer = d.Customers[0]
			customerFound = true
		}

		contractID = strings.TrimSpace(req.ContractID)
		if contractID == "" {
			contractID = customer.ContractID
		}

		resolvedTariffID := strings.TrimSpace(req.TariffID)
		if resolvedTariffID == "" && contractID != "" {
			for _, ct := range d.Contracts {
				if ct.ID == contractID && ct.TariffID != "" {
					resolvedTariffID = ct.TariffID
					break
				}
			}
		}
		if resolvedTariffID == "" {
			resolvedTariffID = customer.TariffID
		}
		for _, t := range d.Tariffs {
			if t.ID == resolvedTariffID {
				tariffPct = t.DiscountPct
				break
			}
		}
	})

	cleanItems := make([]tenantdb.InvoiceItem, 0, len(req.Items))
	subtotal := 0.0
	for _, it := range req.Items {
		if it.Qty <= 0 {
			continue
		}
		kind := strings.ToUpper(strings.TrimSpace(it.Kind))
		if kind != "SERVICIO" {
			kind = "PRODUCTO"
		}
		code := strings.TrimSpace(it.Code)
		if code == "" {
			code = "ITEM"
		}
		item := tenantdb.InvoiceItem{
			Kind:       kind,
			RefID:      strings.TrimSpace(it.RefID),
			Code:       code,
			Name:       strings.TrimSpace(it.Name),
			Qty:        it.Qty,
			Price:      math.Max(0, it.Price),
			TaxPct:     math.Max(0, it.TaxPct),
			WorkerID:   strings.TrimSpace(it.WorkerID),
			WorkerName: strings.TrimSpace(it.WorkerName),
		}
		subtotal += item.Qty * item.Price
		cleanItems = append(cleanItems, item)
	}
	if len(cleanItems) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Las cantidades de los ítems deben ser mayores a cero")
		return
	}

	effectiveDiscountPct := 0.0
	if licensegate.HasFeature(ctx, "", "descuento_linea") {
		if req.DiscountPct != nil && *req.DiscountPct >= 0 {
			effectiveDiscountPct = math.Min(100, *req.DiscountPct)
		} else if tariffPct > 0 {
			effectiveDiscountPct = math.Min(100, tariffPct)
		}
	}
	discountTotal := math.Round(subtotal * effectiveDiscountPct / 100.0)
	discountRatio := 0.0
	if subtotal > 0 {
		discountRatio = discountTotal / subtotal
	}

	taxTotal := 0.0
	for _, it := range cleanItems {
		lineBase := (it.Qty * it.Price) * (1.0 - discountRatio)
		taxTotal += lineBase * (it.TaxPct / 100.0)
	}
	taxTotal = math.Round(taxTotal)
	subtotal = math.Round(subtotal)
	total := math.Round(subtotal - discountTotal + taxTotal)

	paymentMethod := strings.TrimSpace(req.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "Efectivo"
	}

	amountPaid := total
	if req.AmountPaid != nil {
		amountPaid = math.Max(0, math.Round(*req.AmountPaid))
	} else if strings.Contains(strings.ToLower(paymentMethod), "crédito") || strings.Contains(strings.ToLower(paymentMethod), "credito") {
		amountPaid = 0
	}

	if amountPaid < total {
		if !licensegate.HasFeature(ctx, "", "pagos_mixtos_cxc") {
			httpx.Error(w, http.StatusForbidden, "La venta a crédito o abonos parciales (pagos_mixtos_cxc) no está habilitada para esta empresa")
			return
		}
	}
	if amountPaid > total {
		amountPaid = total
	}
	pendingBalance := math.Round(total - amountPaid)
	status := "Pagada"
	if pendingBalance > 0 {
		status = "Pendiente CxC"
	}

	nowStr := time.Now().Format("2006-01-02 15:04")
	invNumber := s.db.Seq.Next(tc.DBName, "FEVP", 9011)

	custName := customer.Name
	if custName == "" {
		custName = "Consumidor Final Mostrador"
	}
	custNit := customer.Nit
	if customer.DV != "" && !strings.Contains(custNit, "-") {
		custNit = custNit + "-" + customer.DV
	}

	abonos := []tenantdb.AbonoRecord{}
	if pendingBalance > 0 && amountPaid > 0 {
		abonos = append(abonos, tenantdb.AbonoRecord{
			ID:     s.db.Seq.Next(tc.DBName, "RC", 5005),
			Date:   nowStr,
			Amount: amountPaid,
			Method: paymentMethod,
			Note:   "Abono inicial al facturar",
		})
	}

	inv := tenantdb.Invoice{
		ID:             invNumber,
		Date:           nowStr,
		CustomerID:     customer.ID,
		CustomerName:   custName,
		CustomerNit:    custNit,
		ContractID:     contractID,
		LayoutVariant:  strings.TrimSpace(req.LayoutVariant),
		Items:          cleanItems,
		Subtotal:       subtotal,
		DiscountTotal:  discountTotal,
		TaxTotal:       taxTotal,
		Total:          total,
		PaymentMethod:  paymentMethod,
		AmountPaid:     amountPaid,
		PendingBalance: pendingBalance,
		Status:         status,
		AbonosHistory:  abonos,
	}

	tallerRes := facturas_taller.Apply(ctx, vehiclesSnap, workersSnap, &inv, facturas_taller.Input{
		VehicleID:         req.VehicleID,
		Plate:             req.Plate,
		MechanicID:        req.MechanicID,
		LinkedWorkOrderID: req.LinkedWorkOrderID,
		WorkshopMeta:      req.WorkshopMeta,
	})
	facturacion_dian.Apply(ctx, issuerNit, &inv)

	if (inv.PendingBalance > 0 || inv.ContractID != "") && s.clients.Customers != nil {
		_, err := s.clients.Customers.ApplyAccountReceivableDelta(ctx, &customersv1.ReceivableDeltaRequest{
			CustomerID:            inv.CustomerID,
			ContractID:            inv.ContractID,
			DebtDelta:             inv.PendingBalance,
			ContractConsumedDelta: inv.Total,
		})
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	if err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		d.Invoices = append([]tenantdb.Invoice{inv}, d.Invoices...)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	if s.clients.Inventory != nil {
		stockItems := make([]inventoryv1.StockDeltaItem, 0, len(inv.Items))
		for _, it := range inv.Items {
			if it.Kind == "PRODUCTO" && it.RefID != "" {
				stockItems = append(stockItems, inventoryv1.StockDeltaItem{
					ProductID:    it.RefID,
					Quantity:     it.Qty,
					ReferenceDoc: inv.ID,
					Actor:        tc.Username,
				})
			}
		}
		if len(stockItems) > 0 {
			_, _ = s.clients.Inventory.DeductStock(ctx, &inventoryv1.DeductStockRequest{Items: stockItems})
		}
	}

	if s.clients.Workshop != nil && (tallerRes.ShouldNotifyOrder || tallerRes.ShouldPayCommission) {
		mechID := ""
		laborGross := 0.0
		if tallerRes.ShouldPayCommission {
			mechID = inv.MechanicID
			laborGross = tallerRes.LaborGross
		}
		_, _ = s.clients.Workshop.RegisterInvoicedOrderAndCommission(ctx, &workshopv1.WorkshopInvoiceEvent{
			WorkOrderID:   tallerRes.WorkOrderID,
			MechanicID:    mechID,
			LaborGross:    laborGross,
			InvoiceNumber: inv.ID,
		})
	}

	if s.clients.Hospitality != nil && strings.TrimSpace(req.LinkedRoomID) != "" {
		_, _ = s.clients.Hospitality.CompleteRoomCheckout(ctx, &hospitalityv1.RoomCheckoutEvent{
			RoomID:        strings.TrimSpace(req.LinkedRoomID),
			InvoiceNumber: inv.ID,
		})
	}

	if s.clients.Gastro != nil && strings.TrimSpace(req.LinkedTableID) != "" {
		_, _ = s.clients.Gastro.ClearInvoicedTable(ctx, &gastrov1.ClearTableEvent{
			TableID:       strings.TrimSpace(req.LinkedTableID),
			InvoiceNumber: inv.ID,
		})
	}

	printHTML := ""
	if req.RenderPrint && s.clients.Printing != nil {
		extra := map[string]string{}
		for k, v := range inv.WorkshopMeta {
			extra[k] = v
		}
		if inv.Cufe != "" {
			extra["CUFE"] = inv.Cufe
		}
		printItems := make([]printingv1.PrintLineItem, 0, len(inv.Items))
		for _, it := range inv.Items {
			printItems = append(printItems, printingv1.PrintLineItem{
				Code:        it.Code,
				Description: it.Name,
				Quantity:    it.Qty,
				UnitPrice:   it.Price,
				TaxPct:      it.TaxPct,
				Subtotal:    it.Qty * it.Price,
			})
		}
		renderRes, err := s.clients.Printing.RenderDocument(ctx, &printingv1.RenderDocumentRequest{
			DocumentType:    "FACTURA ELECTRÓNICA DE VENTA",
			LayoutVariant:   inv.LayoutVariant,
			DocumentNumber:  inv.ID,
			IssueDate:       inv.Date,
			CustomerName:    inv.CustomerName,
			CustomerNit:     inv.CustomerNit,
			CustomerPhone:   customer.Phone,
			CustomerAddress: strings.TrimSpace(customer.Address + " " + customer.City),
			PaymentMethod:   inv.PaymentMethod,
			ExtraFields:     extra,
			Items:           printItems,
			Subtotal:        inv.Subtotal,
			DiscountTotal:   inv.DiscountTotal,
			TaxTotal:        inv.TaxTotal,
			GrandTotal:      inv.Total,
			PendingBalance:  inv.PendingBalance,
			Notes:           strings.TrimSpace(req.Notes),
		})
		if err == nil && renderRes != nil {
			printHTML = renderRes.HTMLPrintable
		}
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":        true,
		"invoice":   inv,
		"printHtml": printHTML,
	})
}

type createQuotePayload struct {
	CustomerID string                `json:"customerId"`
	ValidUntil string                `json:"validUntil"`
	Notes      string                `json:"notes"`
	Items      []tenantdb.InvoiceItem `json:"items"`
}

func (s *Service) handleCreateQuote(w http.ResponseWriter, r *http.Request) {
	var req createQuotePayload
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de la cotización inválidos")
		return
	}
	if len(req.Items) == 0 {
		httpx.Error(w, http.StatusBadRequest, "Agrega al menos un ítem a la cotización")
		return
	}

	tc := authguard.FromContext(r.Context())
	quoteID := s.db.Seq.Next(tc.DBName, "COT", 3010)
	nowStr := time.Now().Format("2006-01-02 15:04")

	subtotal := 0.0
	taxTotal := 0.0
	for _, it := range req.Items {
		line := it.Qty * it.Price
		subtotal += line
		taxTotal += line * (it.TaxPct / 100.0)
	}
	subtotal = math.Round(subtotal)
	taxTotal = math.Round(taxTotal)
	total := math.Round(subtotal + taxTotal)
	itemsRaw, _ := json.Marshal(req.Items)

	var created tenantdb.GenericRecord
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}
		custName := "Cliente Comercial"
		custNit := ""
		for _, c := range d.Customers {
			if c.ID == req.CustomerID {
				custName = c.Name
				custNit = c.Nit
				break
			}
		}
		validUntil := strings.TrimSpace(req.ValidUntil)
		if validUntil == "" {
			validUntil = time.Now().AddDate(0, 0, 15).Format("2006-01-02")
		}

		created = tenantdb.GenericRecord{
			ID:        quoteID,
			CreatedAt: nowStr,
			ModuleKey: "cotizaciones",
			Fields: map[string]string{
				"customerId":   req.CustomerID,
				"customerName": custName,
				"customerNit":  custNit,
				"validUntil":   validUntil,
				"subtotal":     fmt.Sprintf("%.0f", subtotal),
				"taxTotal":     fmt.Sprintf("%.0f", taxTotal),
				"total":        fmt.Sprintf("%.0f", total),
				"status":       "Vigente",
				"notes":        strings.TrimSpace(req.Notes),
				"itemsJson":    string(itemsRaw),
			},
		}
		d.GenericModules["cotizaciones"] = append(
			[]tenantdb.GenericRecord{created},
			d.GenericModules["cotizaciones"]...,
		)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"quote": created,
	})
}
