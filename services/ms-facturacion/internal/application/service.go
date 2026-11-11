package application

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/modules/facturacion_dian"
	"ms-facturacion/internal/modules/facturas_taller"
	"ms-facturacion/internal/platform/apperr"
	"ms-facturacion/internal/platform/authguard"
	"ms-facturacion/internal/platform/licensegate"
	"ms-facturacion/internal/platform/money"
)

type Ports struct {
	Inventory   domain.InventoryPort
	Customers   domain.CustomersPort
	Workshop    domain.WorkshopPort
	Hospitality domain.HospitalityPort
	Gastro      domain.GastroPort
	Print       domain.PrintPort
}

type Service struct {
	repo            domain.Repository
	inventoryPort   domain.InventoryPort
	customersPort   domain.CustomersPort
	workshopPort    domain.WorkshopPort
	hospitalityPort domain.HospitalityPort
	gastroPort      domain.GastroPort
	printPort       domain.PrintPort
	idemStripes     [64]sync.Mutex
}

func NewService(repo domain.Repository, ports Ports) *Service {
	return &Service{
		repo:            repo,
		inventoryPort:   ports.Inventory,
		customersPort:   ports.Customers,
		workshopPort:    ports.Workshop,
		hospitalityPort: ports.Hospitality,
		gastroPort:      ports.Gastro,
		printPort:       ports.Print,
	}
}

func requireTenant(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return authguard.TenantContext{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	return tc, nil
}

func (s *Service) GetPosState(ctx context.Context) (domain.PosState, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.PosState{}, err
	}

	nextInv, nextQuote, err := s.repo.PeekSequences(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}
	invoices, err := s.repo.ListInvoices(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}
	quotes, err := s.repo.ListQuotes(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}
	summary, err := s.repo.GetSummary(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}

	return domain.PosState{
		NextInvoiceNumber: nextInv,
		NextQuoteNumber:   nextQuote,
		Invoices:          invoices,
		Quotes:            quotes,
		Summary:           summary,
	}, nil
}

func (s *Service) GetSummary(ctx context.Context) (domain.SalesSummary, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.SalesSummary{}, err
	}
	return s.repo.GetSummary(ctx, tc.DBName)
}

func (s *Service) CreateInvoice(ctx context.Context, in domain.CreateInvoiceInput) (domain.CreateInvoiceResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	if err := licensegate.CheckModule(ctx, "pos_mostrador"); err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	idemKey := strings.TrimSpace(tc.IdempotencyKey)
	if idemKey != "" {
		stripeIdx := hashStripeIndex(tc.DBName, idemKey, len(s.idemStripes))
		s.idemStripes[stripeIdx].Lock()
		defer s.idemStripes[stripeIdx].Unlock()

		existing, err := s.repo.FindInvoiceByIdempotencyKey(ctx, tc.DBName, idemKey)
		if err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		if existing != nil {
			printHTML := ""
			if in.RenderPrint && s.printPort != nil && licensegate.HasService(ctx, "ms-impresiones") {
				if rendered, renderErr := s.printPort.RenderInvoice(ctx, *existing); renderErr == nil {
					printHTML = rendered
				}
			}
			return domain.CreateInvoiceResult{
				Invoice:   *existing,
				PrintHTML: printHTML,
				Replayed:  true,
			}, nil
		}
	}

	if len(in.Items) == 0 {
		return domain.CreateInvoiceResult{}, apperr.Validation("Debes agregar al menos un producto o servicio para facturar")
	}

	normalizedItems, subtotal, err := s.normalizeAndPriceItems(ctx, in.Items, true)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	customerID := strings.TrimSpace(in.CustomerID)
	contractID := strings.TrimSpace(in.ContractID)
	customerName := strings.TrimSpace(in.CustomerName)
	customerNIT := strings.TrimSpace(in.CustomerNIT)
	customerPhone := strings.TrimSpace(in.CustomerPhone)
	customerAddress := strings.TrimSpace(in.CustomerAddress)
	tariffDiscountPct := 0.0

	if (customerID != "" || contractID != "") && s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
		terms, err := s.customersPort.ResolveCommercialTerms(ctx, customerID, contractID)
		if err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		if strings.TrimSpace(terms.CustomerID) != "" {
			customerID = strings.TrimSpace(terms.CustomerID)
		}
		if strings.TrimSpace(terms.CustomerName) != "" {
			customerName = strings.TrimSpace(terms.CustomerName)
		}
		if strings.TrimSpace(terms.CustomerNIT) != "" {
			customerNIT = strings.TrimSpace(terms.CustomerNIT)
		}
		if strings.TrimSpace(terms.CustomerPhone) != "" {
			customerPhone = strings.TrimSpace(terms.CustomerPhone)
		}
		if strings.TrimSpace(terms.CustomerAddress) != "" {
			customerAddress = strings.TrimSpace(terms.CustomerAddress)
		}
		if strings.TrimSpace(terms.ContractID) != "" {
			contractID = strings.TrimSpace(terms.ContractID)
		}
		tariffDiscountPct = terms.DiscountPct
	}

	if customerName == "" {
		customerName = "Consumidor Final Mostrador"
	}
	if customerNIT == "" {
		customerNIT = "222222222222"
	}

	effectiveDiscountPct := 0.0
	if in.DiscountPct != nil {
		if !money.IsFinite(*in.DiscountPct) || *in.DiscountPct < 0 || *in.DiscountPct > 100 {
			return domain.CreateInvoiceResult{}, apperr.Validation("El porcentaje de descuento debe estar entre 0% y 100%")
		}
	}
	if licensegate.HasFeature(ctx, "", "descuento_linea") {
		if in.DiscountPct != nil {
			effectiveDiscountPct = money.RoundCents(*in.DiscountPct)
		} else if tariffDiscountPct > 0 && tariffDiscountPct <= 100 {
			effectiveDiscountPct = money.RoundCents(tariffDiscountPct)
		}
	}

	discountTotal := money.RoundCents(subtotal * effectiveDiscountPct / 100.0)
	discountRatio := 0.0
	if subtotal > 0 {
		discountRatio = discountTotal / subtotal
	}

	taxTotal := 0.0
	for _, it := range normalizedItems {
		lineBase := it.Subtotal * (1.0 - discountRatio)
		taxTotal = money.RoundCents(taxTotal + (lineBase * (it.TaxPct / 100.0)))
	}
	total := money.RoundCents(subtotal - discountTotal + taxTotal)

	paymentMethod := strings.TrimSpace(in.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "Efectivo"
	}

	amountPaid := total
	if in.AmountPaid != nil {
		if !money.IsFinite(*in.AmountPaid) || *in.AmountPaid < 0 {
			return domain.CreateInvoiceResult{}, apperr.Validation("El valor pagado no puede ser negativo")
		}
		amountPaid = money.RoundCents(*in.AmountPaid)
	} else {
		lowerMethod := strings.ToLower(paymentMethod)
		if strings.Contains(lowerMethod, "crédito") || strings.Contains(lowerMethod, "credito") {
			amountPaid = 0
		}
	}

	if amountPaid < total-0.009 {
		if err := licensegate.CheckFeature(ctx, "", "pagos_mixtos_cxc"); err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		if customerID == "" {
			return domain.CreateInvoiceResult{}, apperr.Validation("Debes identificar al cliente para emitir facturas a crédito o con saldo pendiente")
		}
	}

	if amountPaid > total {
		amountPaid = total
	}
	pendingBalance := money.RoundCents(total - amountPaid)
	if pendingBalance < 0.01 {
		pendingBalance = 0
		amountPaid = total
	}

	status := domain.StatusPagada
	if pendingBalance > 0 {
		status = domain.StatusPendienteCxC
	}

	issueDate := time.Now().Format("2006-01-02 15:04")
	actor := strings.TrimSpace(tc.Username)
	if actor == "" {
		actor = "caja@empresa.co"
	}

	idemBase := idemKey
	if idemBase == "" {
		idemBase = money.NewID("saga")
	}

	stockItems := make([]domain.StockMovementItem, 0, len(normalizedItems))
	for _, it := range normalizedItems {
		if it.ProductID != "" {
			stockItems = append(stockItems, domain.StockMovementItem{
				ProductID:    it.ProductID,
				Quantity:     it.Quantity,
				MovementType: "SALIDA VENTA",
				ReferenceDoc: idemBase,
				Actor:        actor,
			})
		}
	}

	// Reserve stock and customer credit BEFORE allocating official DIAN consecutive FEVP
	stockDeducted := false
	if len(stockItems) > 0 && s.inventoryPort != nil && licensegate.HasService(ctx, "ms-inventario") {
		if err := s.inventoryPort.DeductStock(ctx, idemBase+":deduct", stockItems); err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		stockDeducted = true
	}

	compensateStock := func(cause error) error {
		if !stockDeducted {
			return cause
		}
		reverseItems := make([]domain.StockMovementItem, 0, len(stockItems))
		for _, si := range stockItems {
			reverseItems = append(reverseItems, domain.StockMovementItem{
				ProductID:    si.ProductID,
				Quantity:     si.Quantity,
				UnitCost:     0,
				WarehouseID:  si.WarehouseID,
				MovementType: "REVERSO SAGA",
				ReferenceDoc: idemBase,
				Actor:        actor,
			})
		}
		compCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if compErr := s.inventoryPort.RestockItems(compCtx, idemBase+":comp-stock", reverseItems); compErr != nil {
			return apperr.Wrap(
				apperr.KindInternal,
				fmt.Sprintf("%s (falló compensación de inventario: %v)", cause.Error(), compErr),
				cause,
			)
		}
		return cause
	}

	receivableApplied := false
	contractConsumedDelta := 0.0
	if contractID != "" {
		contractConsumedDelta = total
	}
	if (pendingBalance > 0 || contractID != "") && s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
		if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
			IdempotencyKey:        idemBase + ":cxc",
			CustomerID:            customerID,
			ContractID:            contractID,
			InvoiceID:             idemBase,
			InvoiceNumber:         idemBase,
			IssueDate:             issueDate,
			InvoiceTotal:          total,
			DebtDelta:             pendingBalance,
			ContractConsumedDelta: contractConsumedDelta,
		}); err != nil {
			return domain.CreateInvoiceResult{}, compensateStock(err)
		}
		receivableApplied = true
	}

	compensateReceivableAndStock := func(cause error) error {
		currentErr := cause
		if receivableApplied {
			compCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			compErr := s.customersPort.ApplyReceivableDelta(compCtx, domain.ReceivableDeltaInput{
				IdempotencyKey:        idemBase + ":comp-cxc",
				CustomerID:            customerID,
				ContractID:            contractID,
				InvoiceID:             idemBase,
				InvoiceNumber:         idemBase,
				IssueDate:             issueDate,
				InvoiceTotal:          total,
				DebtDelta:             -pendingBalance,
				ContractConsumedDelta: -contractConsumedDelta,
			})
			cancel()
			if compErr != nil {
				currentErr = apperr.Wrap(
					apperr.KindInternal,
					fmt.Sprintf("%s (falló compensación de cartera: %v)", currentErr.Error(), compErr),
					currentErr,
				)
			}
		}
		return compensateStock(currentErr)
	}

	invNumber, err := s.repo.ReserveInvoiceNumber(ctx, tc.DBName)
	if err != nil {
		return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
	}

	inv := domain.Invoice{
		ID:              invNumber,
		Number:          invNumber,
		IssueDate:       issueDate,
		Date:            issueDate,
		CustomerID:      customerID,
		CustomerName:    customerName,
		CustomerNIT:     customerNIT,
		CustomerPhone:   customerPhone,
		CustomerAddress: customerAddress,
		ContractID:      contractID,
		DiscountPct:     effectiveDiscountPct,
		LinkedRoomID:    strings.TrimSpace(in.LinkedRoomID),
		LinkedTableID:   strings.TrimSpace(in.LinkedTableID),
		LayoutVariant:   strings.TrimSpace(in.LayoutVariant),
		Items:           normalizedItems,
		Subtotal:        subtotal,
		DiscountTotal:   discountTotal,
		TaxTotal:        taxTotal,
		Total:           total,
		PaymentMethod:   paymentMethod,
		AmountPaid:      amountPaid,
		PendingBalance:  pendingBalance,
		Status:          status,
		Notes:           strings.TrimSpace(in.Notes),
		Actor:           actor,
	}

	tallerRes := facturas_taller.Apply(ctx, &inv, facturas_taller.Input{
		VehicleID:         in.VehicleID,
		Plate:             in.Plate,
		MechanicID:        in.MechanicID,
		MechanicName:      in.MechanicName,
		LinkedWorkOrderID: in.LinkedWorkOrderID,
		WorkshopMeta:      in.WorkshopMeta,
	})
	facturacion_dian.Apply(ctx, &inv)

	if (tallerRes.ShouldNotifyOrder || tallerRes.ShouldPayCommission) && s.workshopPort != nil && licensegate.HasService(ctx, "ms-taller") {
		mechID := ""
		laborGross := 0.0
		if tallerRes.ShouldPayCommission {
			mechID = inv.MechanicID
			laborGross = tallerRes.LaborGross
		}
		mechName, err := s.workshopPort.RegisterInvoicedOrder(ctx, tallerRes.WorkOrderID, mechID, laborGross, inv.ID)
		if err != nil {
			return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
		}
		if strings.TrimSpace(mechName) != "" && inv.MechanicID != "" {
			inv.MechanicName = strings.TrimSpace(mechName)
		}
	}

	if inv.LinkedRoomID != "" && s.hospitalityPort != nil && licensegate.HasService(ctx, "ms-hoteleria") {
		if err := s.hospitalityPort.CompleteRoomCheckout(ctx, inv.LinkedRoomID, inv.ID); err != nil {
			return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
		}
	}

	if inv.LinkedTableID != "" && s.gastroPort != nil && licensegate.HasService(ctx, "ms-comandas") {
		if err := s.gastroPort.ClearInvoicedTable(ctx, inv.LinkedTableID, inv.ID); err != nil {
			return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
		}
	}

	if err := s.repo.SaveInvoice(ctx, tc.DBName, inv, idemKey); err != nil {
		return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
	}

	printHTML := ""
	if in.RenderPrint && s.printPort != nil && licensegate.HasService(ctx, "ms-impresiones") {
		if rendered, renderErr := s.printPort.RenderInvoice(ctx, inv); renderErr == nil {
			printHTML = rendered
		}
	}

	return domain.CreateInvoiceResult{
		Invoice:   inv,
		PrintHTML: printHTML,
		Replayed:  false,
	}, nil
}

func (s *Service) CreateQuote(ctx context.Context, in domain.CreateQuoteInput) (domain.Quote, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Quote{}, err
	}
	if err := licensegate.CheckModule(ctx, "cotizaciones"); err != nil {
		return domain.Quote{}, err
	}
	if len(in.Items) == 0 {
		return domain.Quote{}, apperr.Validation("Debes agregar al menos un ítem a la cotización")
	}

	items, subtotal, err := s.normalizeAndPriceItems(ctx, in.Items, false)
	if err != nil {
		return domain.Quote{}, err
	}

	taxTotal := 0.0
	for _, it := range items {
		taxTotal = money.RoundCents(taxTotal + (it.Subtotal * (it.TaxPct / 100.0)))
	}

	customerID := strings.TrimSpace(in.CustomerID)
	customerName := strings.TrimSpace(in.CustomerName)
	customerNIT := strings.TrimSpace(in.CustomerNIT)
	if customerID != "" && s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
		if terms, termsErr := s.customersPort.ResolveCommercialTerms(ctx, customerID, ""); termsErr == nil {
			if strings.TrimSpace(terms.CustomerName) != "" {
				customerName = strings.TrimSpace(terms.CustomerName)
			}
			if strings.TrimSpace(terms.CustomerNIT) != "" {
				customerNIT = strings.TrimSpace(terms.CustomerNIT)
			}
		}
	}
	if customerName == "" {
		customerName = "Cliente Comercial"
	}

	validUntil := strings.TrimSpace(in.ValidUntil)
	if validUntil == "" {
		validUntil = time.Now().AddDate(0, 0, 15).Format("2006-01-02")
	}

	quoteID, err := s.repo.ReserveQuoteNumber(ctx, tc.DBName)
	if err != nil {
		return domain.Quote{}, err
	}

	quote := domain.Quote{
		ID:           quoteID,
		CreatedAt:    time.Now().Format("2006-01-02 15:04"),
		CustomerID:   customerID,
		CustomerName: customerName,
		CustomerNIT:  customerNIT,
		ValidUntil:   validUntil,
		Items:        items,
		Subtotal:     subtotal,
		TaxTotal:     taxTotal,
		Total:        money.RoundCents(subtotal + taxTotal),
		Status:       "Vigente",
		Notes:        strings.TrimSpace(in.Notes),
	}

	if err := s.repo.CreateQuote(ctx, tc.DBName, quote); err != nil {
		return domain.Quote{}, err
	}
	return quote, nil
}
