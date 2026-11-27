package application

import (
	"context"
	"fmt"
	"math"
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

func actorFromTenant(tc authguard.TenantContext) string {
	actor := strings.TrimSpace(tc.Username)
	if actor == "" {
		return "caja@empresa.co"
	}
	return actor
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
	nextNC, nextND, err := s.repo.PeekNoteSequences(ctx, tc.DBName)
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
	notes, err := s.repo.ListAdjustmentNotes(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}
	transmissions, err := s.repo.ListDianTransmissions(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}
	summary, err := s.repo.GetSummary(ctx, tc.DBName)
	if err != nil {
		return domain.PosState{}, err
	}

	return domain.PosState{
		NextInvoiceNumber:    nextInv,
		NextQuoteNumber:      nextQuote,
		NextCreditNoteNumber: nextNC,
		NextDebitNoteNumber:  nextND,
		Invoices:             invoices,
		Quotes:               quotes,
		AdjustmentNotes:      notes,
		DianTransmissions:    transmissions,
		Summary:              summary,
	}, nil
}

func (s *Service) GetSummary(ctx context.Context) (domain.SalesSummary, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.SalesSummary{}, err
	}
	return s.repo.GetSummary(ctx, tc.DBName)
}

type preparedInvoiceCalc struct {
	customerID      string
	contractID      string
	customerName    string
	customerNIT     string
	customerPhone   string
	customerAddress string
	discountPct     float64
	items           []domain.InvoiceItem
	subtotal        float64
	discountTotal   float64
	taxTotal        float64
	total           float64
	paymentMethod   string
	amountPaid      float64
	pendingBalance  float64
	status          string
	invoiceType     string
}

func (s *Service) prepareInvoiceCalculation(ctx context.Context, in domain.CreateInvoiceInput, preserveExplicitCustomer bool) (preparedInvoiceCalc, error) {
	if len(in.Items) == 0 {
		return preparedInvoiceCalc{}, apperr.Validation("Debes agregar al menos un producto o servicio para facturar")
	}

	normalizedItems, subtotal, err := s.normalizeAndPriceItems(ctx, in.Items, true)
	if err != nil {
		return preparedInvoiceCalc{}, err
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
			return preparedInvoiceCalc{}, err
		}
		if strings.TrimSpace(terms.CustomerID) != "" {
			customerID = strings.TrimSpace(terms.CustomerID)
		}
		if strings.TrimSpace(terms.CustomerName) != "" && (!preserveExplicitCustomer || customerName == "") {
			customerName = strings.TrimSpace(terms.CustomerName)
		}
		if strings.TrimSpace(terms.CustomerNIT) != "" && (!preserveExplicitCustomer || customerNIT == "") {
			customerNIT = strings.TrimSpace(terms.CustomerNIT)
		}
		if strings.TrimSpace(terms.CustomerPhone) != "" && (!preserveExplicitCustomer || customerPhone == "") {
			customerPhone = strings.TrimSpace(terms.CustomerPhone)
		}
		if strings.TrimSpace(terms.CustomerAddress) != "" && (!preserveExplicitCustomer || customerAddress == "") {
			customerAddress = strings.TrimSpace(terms.CustomerAddress)
		}
		if strings.TrimSpace(terms.ContractID) != "" && contractID == "" {
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
			return preparedInvoiceCalc{}, apperr.Validation("El porcentaje de descuento debe estar entre 0% y 100%")
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
			return preparedInvoiceCalc{}, apperr.Validation("El valor pagado no puede ser negativo")
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
			return preparedInvoiceCalc{}, err
		}
		if customerID == "" {
			return preparedInvoiceCalc{}, apperr.Validation("Debes identificar al cliente para emitir facturas a crédito o con saldo pendiente")
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

	probe := domain.Invoice{
		InvoiceType:      in.InvoiceType,
		DueDate:          strings.TrimSpace(in.DueDate),
		PurchaseOrderRef: strings.TrimSpace(in.PurchaseOrderRef),
		ContractID:       contractID,
		VehicleID:        strings.TrimSpace(in.VehicleID),
		Plate:            strings.TrimSpace(in.Plate),
		WorkshopMeta:     in.WorkshopMeta,
		LinkedRoomID:     strings.TrimSpace(in.LinkedRoomID),
		LinkedTableID:    strings.TrimSpace(in.LinkedTableID),
	}
	if probe.WorkshopMeta.WorkOrderID == "" {
		probe.WorkshopMeta.WorkOrderID = strings.TrimSpace(in.LinkedWorkOrderID)
	}

	return preparedInvoiceCalc{
		customerID:      customerID,
		contractID:      contractID,
		customerName:    customerName,
		customerNIT:     customerNIT,
		customerPhone:   customerPhone,
		customerAddress: customerAddress,
		discountPct:     effectiveDiscountPct,
		items:           normalizedItems,
		subtotal:        subtotal,
		discountTotal:   discountTotal,
		taxTotal:        taxTotal,
		total:           total,
		paymentMethod:   paymentMethod,
		amountPaid:      amountPaid,
		pendingBalance:  pendingBalance,
		status:          status,
		invoiceType:     domain.InferInvoiceType(probe),
	}, nil
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

	calc, err := s.prepareInvoiceCalculation(ctx, in, false)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	saveMode := strings.ToUpper(strings.TrimSpace(in.SaveMode))
	if saveMode != "" && saveMode != domain.SaveModeDraft && saveMode != domain.SaveModeConfirm {
		return domain.CreateInvoiceResult{}, apperr.Validation("El modo de guardado debe ser DRAFT o CONFIRM")
	}

	issueDate := time.Now().Format("2006-01-02 15:04")
	actor := actorFromTenant(tc)

	if saveMode == domain.SaveModeDraft {
		draftID, err := s.repo.ReserveDraftInvoiceNumber(ctx, tc.DBName)
		if err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		inv := domain.Invoice{
			ID:               draftID,
			Number:           draftID,
			InvoiceType:      calc.invoiceType,
			DocStatus:        domain.DocStatusBorrador,
			IssueDate:        issueDate,
			Date:             issueDate,
			DueDate:          strings.TrimSpace(in.DueDate),
			PurchaseOrderRef: strings.TrimSpace(in.PurchaseOrderRef),
			CustomerID:       calc.customerID,
			CustomerName:     calc.customerName,
			CustomerNIT:      calc.customerNIT,
			CustomerPhone:    calc.customerPhone,
			CustomerAddress:  calc.customerAddress,
			ContractID:       calc.contractID,
			DiscountPct:      calc.discountPct,
			LinkedRoomID:     strings.TrimSpace(in.LinkedRoomID),
			LinkedTableID:    strings.TrimSpace(in.LinkedTableID),
			LayoutVariant:    strings.TrimSpace(in.LayoutVariant),
			DianStage:        domain.DianStageSinEnviar,
			Editable:         true,
			Items:            calc.items,
			Subtotal:         calc.subtotal,
			DiscountTotal:    calc.discountTotal,
			TaxTotal:         calc.taxTotal,
			Total:            calc.total,
			PaymentMethod:    calc.paymentMethod,
			AmountPaid:       calc.amountPaid,
			PendingBalance:   calc.pendingBalance,
			Status:           domain.StatusBorrador,
			Notes:            strings.TrimSpace(in.Notes),
			Actor:            actor,
		}
		_ = facturas_taller.Apply(ctx, &inv, facturas_taller.Input{
			VehicleID:         in.VehicleID,
			Plate:             in.Plate,
			MechanicID:        in.MechanicID,
			MechanicName:      in.MechanicName,
			LinkedWorkOrderID: in.LinkedWorkOrderID,
			WorkshopMeta:      in.WorkshopMeta,
		})
		inv.InvoiceType = domain.InferInvoiceType(inv)

		if err := s.repo.SaveInvoice(ctx, tc.DBName, inv, idemKey); err != nil {
			return domain.CreateInvoiceResult{}, err
		}
		return domain.CreateInvoiceResult{
			Invoice:   inv,
			PrintHTML: "",
			Replayed:  false,
		}, nil
	}

	return s.executeCommercialConfirmation(ctx, tc, calc, in, "", issueDate, idemKey, saveMode == "")
}

func (s *Service) executeCommercialConfirmation(
	ctx context.Context,
	tc authguard.TenantContext,
	calc preparedInvoiceCalc,
	in domain.CreateInvoiceInput,
	oldDraftID string,
	issueDate string,
	idemKey string,
	legacyAutoDian bool,
) (domain.CreateInvoiceResult, error) {
	actor := actorFromTenant(tc)
	idemBase := strings.TrimSpace(idemKey)
	if idemBase == "" {
		idemBase = money.NewID("saga")
	}

	stockItems := make([]domain.StockMovementItem, 0, len(calc.items))
	for _, it := range calc.items {
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
	if calc.contractID != "" {
		contractConsumedDelta = calc.total
	}
	if (calc.pendingBalance > 0 || calc.contractID != "") && s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
		if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
			IdempotencyKey:        idemBase + ":cxc",
			CustomerID:            calc.customerID,
			ContractID:            calc.contractID,
			InvoiceID:             idemBase,
			InvoiceNumber:         idemBase,
			IssueDate:             issueDate,
			InvoiceTotal:          calc.total,
			DebtDelta:             calc.pendingBalance,
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
				CustomerID:            calc.customerID,
				ContractID:            calc.contractID,
				InvoiceID:             idemBase,
				InvoiceNumber:         idemBase,
				IssueDate:             issueDate,
				InvoiceTotal:          calc.total,
				DebtDelta:             -calc.pendingBalance,
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
		ID:               invNumber,
		Number:           invNumber,
		InvoiceType:      calc.invoiceType,
		DocStatus:        domain.DocStatusConfirmada,
		IssueDate:        issueDate,
		Date:             issueDate,
		DueDate:          strings.TrimSpace(in.DueDate),
		PurchaseOrderRef: strings.TrimSpace(in.PurchaseOrderRef),
		CustomerID:       calc.customerID,
		CustomerName:     calc.customerName,
		CustomerNIT:      calc.customerNIT,
		CustomerPhone:    calc.customerPhone,
		CustomerAddress:  calc.customerAddress,
		ContractID:       calc.contractID,
		DiscountPct:      calc.discountPct,
		LinkedRoomID:     strings.TrimSpace(in.LinkedRoomID),
		LinkedTableID:    strings.TrimSpace(in.LinkedTableID),
		LayoutVariant:    strings.TrimSpace(in.LayoutVariant),
		DianStage:        domain.DianStageSinEnviar,
		Editable:         true,
		Items:            calc.items,
		Subtotal:         calc.subtotal,
		DiscountTotal:    calc.discountTotal,
		TaxTotal:         calc.taxTotal,
		Total:            calc.total,
		PaymentMethod:    calc.paymentMethod,
		AmountPaid:       calc.amountPaid,
		PendingBalance:   calc.pendingBalance,
		Status:           calc.status,
		Notes:            strings.TrimSpace(in.Notes),
		Actor:            actor,
	}

	tallerRes := facturas_taller.Apply(ctx, &inv, facturas_taller.Input{
		VehicleID:         in.VehicleID,
		Plate:             in.Plate,
		MechanicID:        in.MechanicID,
		MechanicName:      in.MechanicName,
		LinkedWorkOrderID: in.LinkedWorkOrderID,
		WorkshopMeta:      in.WorkshopMeta,
	})
	inv.InvoiceType = domain.InferInvoiceType(inv)

	var dianTx *domain.DianTransmission
	if legacyAutoDian {
		facturacion_dian.Apply(ctx, &inv)
		if strings.TrimSpace(inv.CUFE) != "" {
			dianTx = &domain.DianTransmission{
				DocumentKind: domain.DocKindInvoice,
				DocumentID:   inv.ID,
				DianStage:    domain.DianStageAceptada,
				CUFEOrCUDE:   inv.CUFE,
				TrackID:      "TRK-AUTO-" + strings.ReplaceAll(inv.ID, "-", ""),
				Environment:  "PRODUCCION",
				SentAt:       issueDate,
				RespondedAt:  issueDate,
				Attempts:     1,
			}
		}
	} else {
		inv.CUFE = ""
		inv.DianStatus = ""
		inv.DianStage = domain.DianStageSinEnviar
		inv.Editable = true
		dianTx = &domain.DianTransmission{
			DocumentKind: domain.DocKindInvoice,
			DocumentID:   inv.ID,
			DianStage:    domain.DianStageSinEnviar,
			Environment:  "PRODUCCION",
			Attempts:     0,
		}
	}

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

	if oldDraftID != "" {
		if err := s.repo.ReplaceInvoice(ctx, tc.DBName, oldDraftID, inv); err != nil {
			return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
		}
	} else {
		if err := s.repo.SaveInvoice(ctx, tc.DBName, inv, idemKey); err != nil {
			return domain.CreateInvoiceResult{}, compensateReceivableAndStock(err)
		}
	}

	if dianTx != nil {
		_ = s.repo.UpsertDianTransmission(ctx, tc.DBName, *dianTx)
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

func (s *Service) ConfirmInvoice(ctx context.Context, invoiceID string, renderPrint bool) (domain.CreateInvoiceResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	if err := licensegate.CheckModule(ctx, "pos_mostrador"); err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	existing, err := s.repo.GetInvoiceByID(ctx, tc.DBName, invoiceID)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	if existing == nil {
		return domain.CreateInvoiceResult{}, apperr.NotFound("La factura solicitada no existe")
	}
	if existing.DocStatus == domain.DocStatusConfirmada {
		return domain.CreateInvoiceResult{}, apperr.Conflict("La factura ya se encuentra confirmada comercialmente")
	}
	if existing.DocStatus != domain.DocStatusBorrador {
		return domain.CreateInvoiceResult{}, apperr.Validation("Solo se pueden confirmar facturas que estén en estado Borrador")
	}

	var amountPaidPtr *float64
	if existing.PendingBalance > 0 {
		paid := existing.AmountPaid
		amountPaidPtr = &paid
	}
	discPct := existing.DiscountPct

	in := domain.CreateInvoiceInput{
		SaveMode:          domain.SaveModeConfirm,
		InvoiceType:       existing.InvoiceType,
		DueDate:           existing.DueDate,
		PurchaseOrderRef:  existing.PurchaseOrderRef,
		CustomerID:        existing.CustomerID,
		CustomerName:      existing.CustomerName,
		CustomerNIT:       existing.CustomerNIT,
		CustomerPhone:     existing.CustomerPhone,
		CustomerAddress:   existing.CustomerAddress,
		ContractID:        existing.ContractID,
		DiscountPct:       &discPct,
		VehicleID:         existing.VehicleID,
		Plate:             existing.Plate,
		MechanicID:        existing.MechanicID,
		MechanicName:      existing.MechanicName,
		WorkshopMeta:      existing.WorkshopMeta,
		LinkedWorkOrderID: existing.WorkshopMeta.WorkOrderID,
		LinkedRoomID:      existing.LinkedRoomID,
		LinkedTableID:     existing.LinkedTableID,
		LayoutVariant:     existing.LayoutVariant,
		Items:             existing.Items,
		PaymentMethod:     existing.PaymentMethod,
		AmountPaid:        amountPaidPtr,
		Notes:             existing.Notes,
		RenderPrint:       renderPrint,
	}

	calc, err := s.prepareInvoiceCalculation(ctx, in, true)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	issueDate := time.Now().Format("2006-01-02 15:04")
	return s.executeCommercialConfirmation(ctx, tc, calc, in, existing.ID, issueDate, "", false)
}

func (s *Service) UpdateInvoice(ctx context.Context, invoiceID string, in domain.UpdateInvoiceInput) (domain.CreateInvoiceResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	if err := licensegate.CheckModule(ctx, "pos_mostrador"); err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	existing, err := s.repo.GetInvoiceByID(ctx, tc.DBName, invoiceID)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	if existing == nil {
		return domain.CreateInvoiceResult{}, apperr.NotFound("La factura solicitada no existe")
	}
	if existing.DocStatus == domain.DocStatusAnuladaNC {
		return domain.CreateInvoiceResult{}, apperr.Validation("No se puede editar una factura anulada por Nota Crédito")
	}
	if existing.DianStage == domain.DianStageEnviada || existing.DianStage == domain.DianStageAceptada {
		return domain.CreateInvoiceResult{}, apperr.Validation("No se puede editar una factura ya enviada o aceptada por la DIAN; emite una Nota Crédito o Nota Débito")
	}

	preserveExplicit := strings.TrimSpace(in.CustomerID) == existing.CustomerID
	calc, err := s.prepareInvoiceCalculation(ctx, in, preserveExplicit)
	if err != nil {
		return domain.CreateInvoiceResult{}, err
	}
	actor := actorFromTenant(tc)

	if existing.DocStatus == domain.DocStatusBorrador {
		updated := domain.Invoice{
			ID:               existing.ID,
			Number:           existing.Number,
			InvoiceType:      calc.invoiceType,
			DocStatus:        domain.DocStatusBorrador,
			IssueDate:        existing.IssueDate,
			Date:             existing.Date,
			DueDate:          strings.TrimSpace(in.DueDate),
			PurchaseOrderRef: strings.TrimSpace(in.PurchaseOrderRef),
			CustomerID:       calc.customerID,
			CustomerName:     calc.customerName,
			CustomerNIT:      calc.customerNIT,
			CustomerPhone:    calc.customerPhone,
			CustomerAddress:  calc.customerAddress,
			ContractID:       calc.contractID,
			DiscountPct:      calc.discountPct,
			LinkedRoomID:     strings.TrimSpace(in.LinkedRoomID),
			LinkedTableID:    strings.TrimSpace(in.LinkedTableID),
			LayoutVariant:    strings.TrimSpace(in.LayoutVariant),
			DianStage:        domain.DianStageSinEnviar,
			Editable:         true,
			Items:            calc.items,
			Subtotal:         calc.subtotal,
			DiscountTotal:    calc.discountTotal,
			TaxTotal:         calc.taxTotal,
			Total:            calc.total,
			PaymentMethod:    calc.paymentMethod,
			AmountPaid:       calc.amountPaid,
			PendingBalance:   calc.pendingBalance,
			Status:           domain.StatusBorrador,
			Notes:            strings.TrimSpace(in.Notes),
			Actor:            actor,
		}
		_ = facturas_taller.Apply(ctx, &updated, facturas_taller.Input{
			VehicleID:         in.VehicleID,
			Plate:             in.Plate,
			MechanicID:        in.MechanicID,
			MechanicName:      in.MechanicName,
			LinkedWorkOrderID: in.LinkedWorkOrderID,
			WorkshopMeta:      in.WorkshopMeta,
		})
		updated.InvoiceType = domain.InferInvoiceType(updated)

		if err := s.repo.SaveInvoice(ctx, tc.DBName, updated, ""); err != nil {
			return domain.CreateInvoiceResult{}, err
		}

		if strings.EqualFold(strings.TrimSpace(in.SaveMode), domain.SaveModeConfirm) {
			return s.ConfirmInvoice(ctx, updated.ID, in.RenderPrint)
		}
		return domain.CreateInvoiceResult{Invoice: updated}, nil
	}

	updKey := money.NewID("upd")
	if !sameProductQuantities(existing.Items, calc.items) && s.inventoryPort != nil && licensegate.HasService(ctx, "ms-inventario") {
		restockList := make([]domain.StockMovementItem, 0, len(existing.Items))
		for _, it := range existing.Items {
			if it.ProductID != "" {
				restockList = append(restockList, domain.StockMovementItem{
					ProductID:    it.ProductID,
					Quantity:     it.Quantity,
					MovementType: "REVERSO EDICION FACTURA",
					ReferenceDoc: existing.ID,
					Actor:        actor,
				})
			}
		}
		deductList := make([]domain.StockMovementItem, 0, len(calc.items))
		for _, it := range calc.items {
			if it.ProductID != "" {
				deductList = append(deductList, domain.StockMovementItem{
					ProductID:    it.ProductID,
					Quantity:     it.Quantity,
					MovementType: "SALIDA VENTA",
					ReferenceDoc: existing.ID,
					Actor:        actor,
				})
			}
		}

		if len(restockList) > 0 {
			if err := s.inventoryPort.RestockItems(ctx, updKey+":restock", restockList); err != nil {
				return domain.CreateInvoiceResult{}, err
			}
		}
		if len(deductList) > 0 {
			if err := s.inventoryPort.DeductStock(ctx, updKey+":deduct", deductList); err != nil {
				if len(restockList) > 0 {
					revertOld := make([]domain.StockMovementItem, 0, len(restockList))
					for _, ri := range restockList {
						ri.MovementType = "SALIDA VENTA"
						revertOld = append(revertOld, ri)
					}
					_ = s.inventoryPort.DeductStock(ctx, updKey+":revert-old", revertOld)
				}
				return domain.CreateInvoiceResult{}, err
			}
		}
	}

	if s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
		oldConsumed := 0.0
		if existing.ContractID != "" {
			oldConsumed = existing.Total
		}
		newConsumed := 0.0
		if calc.contractID != "" {
			newConsumed = calc.total
		}

		if existing.CustomerID == calc.customerID && existing.ContractID == calc.contractID {
			debtDiff := money.RoundCents(calc.pendingBalance - existing.PendingBalance)
			consumedDiff := money.RoundCents(newConsumed - oldConsumed)
			if (math.Abs(debtDiff) >= 0.01 || math.Abs(consumedDiff) >= 0.01) && calc.customerID != "" {
				if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
					IdempotencyKey:        updKey + ":cxc-diff",
					CustomerID:            calc.customerID,
					ContractID:            calc.contractID,
					InvoiceID:             existing.ID,
					InvoiceNumber:         existing.Number,
					IssueDate:             existing.IssueDate,
					InvoiceTotal:          calc.total,
					DebtDelta:             debtDiff,
					ContractConsumedDelta: consumedDiff,
				}); err != nil {
					return domain.CreateInvoiceResult{}, err
				}
			}
		} else {
			if (existing.PendingBalance > 0 || existing.ContractID != "") && existing.CustomerID != "" {
				if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
					IdempotencyKey:        updKey + ":cxc-rev",
					CustomerID:            existing.CustomerID,
					ContractID:            existing.ContractID,
					InvoiceID:             existing.ID,
					InvoiceNumber:         existing.Number,
					IssueDate:             existing.IssueDate,
					InvoiceTotal:          existing.Total,
					DebtDelta:             -existing.PendingBalance,
					ContractConsumedDelta: -oldConsumed,
				}); err != nil {
					return domain.CreateInvoiceResult{}, err
				}
			}
			if (calc.pendingBalance > 0 || calc.contractID != "") && calc.customerID != "" {
				if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
					IdempotencyKey:        updKey + ":cxc-new",
					CustomerID:            calc.customerID,
					ContractID:            calc.contractID,
					InvoiceID:             existing.ID,
					InvoiceNumber:         existing.Number,
					IssueDate:             existing.IssueDate,
					InvoiceTotal:          calc.total,
					DebtDelta:             calc.pendingBalance,
					ContractConsumedDelta: newConsumed,
				}); err != nil {
					return domain.CreateInvoiceResult{}, err
				}
			}
		}
	}

	updated := domain.Invoice{
		ID:               existing.ID,
		Number:           existing.Number,
		InvoiceType:      calc.invoiceType,
		DocStatus:        domain.DocStatusConfirmada,
		IssueDate:        existing.IssueDate,
		Date:             existing.Date,
		DueDate:          strings.TrimSpace(in.DueDate),
		PurchaseOrderRef: strings.TrimSpace(in.PurchaseOrderRef),
		CustomerID:       calc.customerID,
		CustomerName:     calc.customerName,
		CustomerNIT:      calc.customerNIT,
		CustomerPhone:    calc.customerPhone,
		CustomerAddress:  calc.customerAddress,
		ContractID:       calc.contractID,
		DiscountPct:      calc.discountPct,
		LinkedRoomID:     strings.TrimSpace(in.LinkedRoomID),
		LinkedTableID:    strings.TrimSpace(in.LinkedTableID),
		LayoutVariant:    strings.TrimSpace(in.LayoutVariant),
		CUFE:             "",
		DianStatus:       existing.DianStatus,
		DianStage:        existing.DianStage,
		Editable:         true,
		Items:            calc.items,
		Subtotal:         calc.subtotal,
		DiscountTotal:    calc.discountTotal,
		TaxTotal:         calc.taxTotal,
		Total:            calc.total,
		CreditedTotal:    existing.CreditedTotal,
		DebitedTotal:     existing.DebitedTotal,
		PaymentMethod:    calc.paymentMethod,
		AmountPaid:       calc.amountPaid,
		PendingBalance:   calc.pendingBalance,
		Status:           calc.status,
		Notes:            strings.TrimSpace(in.Notes),
		Actor:            actor,
	}
	_ = facturas_taller.Apply(ctx, &updated, facturas_taller.Input{
		VehicleID:         in.VehicleID,
		Plate:             in.Plate,
		MechanicID:        in.MechanicID,
		MechanicName:      in.MechanicName,
		LinkedWorkOrderID: in.LinkedWorkOrderID,
		WorkshopMeta:      in.WorkshopMeta,
	})
	updated.InvoiceType = domain.InferInvoiceType(updated)

	if err := s.repo.SaveInvoice(ctx, tc.DBName, updated, ""); err != nil {
		return domain.CreateInvoiceResult{}, err
	}

	rehydrated, err := s.repo.GetInvoiceByID(ctx, tc.DBName, updated.ID)
	if err == nil && rehydrated != nil {
		updated = *rehydrated
	}

	printHTML := ""
	if in.RenderPrint && s.printPort != nil && licensegate.HasService(ctx, "ms-impresiones") {
		if rendered, renderErr := s.printPort.RenderInvoice(ctx, updated); renderErr == nil {
			printHTML = rendered
		}
	}

	return domain.CreateInvoiceResult{
		Invoice:   updated,
		PrintHTML: printHTML,
	}, nil
}

func normalizeDianDocKind(raw string) (string, error) {
	k := strings.ToUpper(strings.TrimSpace(raw))
	switch k {
	case "", domain.DocKindInvoice:
		return domain.DocKindInvoice, nil
	case domain.DocKindCreditNote, "CREDIT":
		return domain.DocKindCreditNote, nil
	case domain.DocKindDebitNote, "DEBIT":
		return domain.DocKindDebitNote, nil
	default:
		return "", apperr.Validation("El tipo de documento DIAN debe ser INVOICE, CREDIT_NOTE o DEBIT_NOTE")
	}
}

func (s *Service) SendToDian(ctx context.Context, in domain.DianSendInput) (domain.DianActionResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	if err := licensegate.CheckModule(ctx, "facturacion_dian"); err != nil {
		return domain.DianActionResult{}, err
	}

	docKind, err := normalizeDianDocKind(in.DocumentKind)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	docID := strings.TrimSpace(in.DocumentID)
	if docID == "" {
		return domain.DianActionResult{}, apperr.Validation("El identificador del documento es obligatorio")
	}

	var refCUFE string
	if docKind == domain.DocKindInvoice {
		inv, err := s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
		if err != nil {
			return domain.DianActionResult{}, err
		}
		if inv == nil {
			return domain.DianActionResult{}, apperr.NotFound("La factura " + docID + " no existe")
		}
		if inv.DocStatus != domain.DocStatusConfirmada {
			return domain.DianActionResult{}, apperr.Validation("Solo se pueden enviar a la DIAN facturas en estado CONFIRMADA")
		}
		if inv.DianStage == domain.DianStageAceptada {
			return domain.DianActionResult{}, apperr.Conflict("La factura ya fue aceptada por la DIAN")
		}
		if inv.DianStage == domain.DianStageEnviada {
			return domain.DianActionResult{}, apperr.Conflict("La factura ya fue enviada a la DIAN y espera respuesta")
		}
	} else {
		note, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, docID)
		if err != nil {
			return domain.DianActionResult{}, err
		}
		if note == nil {
			return domain.DianActionResult{}, apperr.NotFound("La nota " + docID + " no existe")
		}
		expectedKind := domain.DocumentKindForNoteKind(note.NoteKind)
		if expectedKind != docKind {
			docKind = expectedKind
		}
		if note.DocStatus != domain.DocStatusConfirmada {
			return domain.DianActionResult{}, apperr.Validation("Solo se pueden enviar a la DIAN notas en estado CONFIRMADA")
		}
		if note.DianStage == domain.DianStageAceptada {
			return domain.DianActionResult{}, apperr.Conflict("La nota ya fue aceptada por la DIAN")
		}
		if note.DianStage == domain.DianStageEnviada {
			return domain.DianActionResult{}, apperr.Conflict("La nota ya fue enviada a la DIAN y espera respuesta")
		}
		refCUFE = note.ReferencedCUFE
	}

	prevTx, err := s.repo.GetDianTransmission(ctx, tc.DBName, docKind, docID)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	attempts := 1
	if prevTx != nil {
		attempts = prevTx.Attempts + 1
		if refCUFE == "" {
			refCUFE = prevTx.ReferencedCUFE
		}
	}

	sentAt := time.Now().Format("2006-01-02 15:04:05")
	trackID := fmt.Sprintf("TRK-%s-%02d", strings.ReplaceAll(docID, "-", ""), attempts)

	dt := domain.DianTransmission{
		DocumentKind:     docKind,
		DocumentID:       docID,
		DianStage:        domain.DianStageEnviada,
		CUFEOrCUDE:       "",
		ReferencedCUFE:   refCUFE,
		TrackID:          trackID,
		Environment:      "PRODUCCION",
		SentAt:           sentAt,
		RespondedAt:      "",
		RejectionCode:    "",
		RejectionMessage: "",
		Attempts:         attempts,
	}

	if err := s.repo.UpsertDianTransmission(ctx, tc.DBName, dt); err != nil {
		return domain.DianActionResult{}, err
	}

	if docKind == domain.DocKindInvoice {
		inv, _ := s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
		if inv != nil {
			inv.CUFE = ""
			inv.DianStatus = domain.DianStatusEnviada
			_ = s.repo.SaveInvoice(ctx, tc.DBName, *inv, "")
			inv, _ = s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
		}
		return domain.DianActionResult{
			Transmission: dt,
			Invoice:      inv,
		}, nil
	}

	note, _ := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, docID)
	return domain.DianActionResult{
		Transmission:   dt,
		AdjustmentNote: note,
	}, nil
}

func (s *Service) RespondDian(ctx context.Context, in domain.DianRespondInput) (domain.DianActionResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	if err := licensegate.CheckModule(ctx, "facturacion_dian"); err != nil {
		return domain.DianActionResult{}, err
	}

	docKind, err := normalizeDianDocKind(in.DocumentKind)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	docID := strings.TrimSpace(in.DocumentID)
	if docID == "" {
		return domain.DianActionResult{}, apperr.Validation("El identificador del documento es obligatorio")
	}

	dt, err := s.repo.GetDianTransmission(ctx, tc.DBName, docKind, docID)
	if err != nil {
		return domain.DianActionResult{}, err
	}
	if dt == nil || dt.DianStage != domain.DianStageEnviada {
		return domain.DianActionResult{}, apperr.Validation("El documento debe encontrarse en etapa ENVIADA antes de recibir respuesta DIAN")
	}

	outcome := strings.ToUpper(strings.TrimSpace(in.Outcome))
	if outcome == "ACEPTADA" {
		outcome = "ACCEPTED"
	} else if outcome == "RECHAZADA" {
		outcome = "REJECTED"
	}
	if outcome != "ACCEPTED" && outcome != "REJECTED" {
		return domain.DianActionResult{}, apperr.Validation("El resultado DIAN debe ser ACCEPTED o REJECTED")
	}

	respondedAt := time.Now().Format("2006-01-02 15:04:05")

	if outcome == "ACCEPTED" {
		if docKind == domain.DocKindInvoice {
			inv, err := s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
			if err != nil {
				return domain.DianActionResult{}, err
			}
			if inv == nil {
				return domain.DianActionResult{}, apperr.NotFound("La factura " + docID + " no existe")
			}
			cufe := domain.DeterministicCUFE(
				inv.ID,
				inv.IssueDate,
				inv.Subtotal,
				inv.DiscountTotal,
				inv.TaxTotal,
				inv.Total,
				inv.CustomerNIT,
			)
			dt.DianStage = domain.DianStageAceptada
			dt.CUFEOrCUDE = cufe
			dt.RespondedAt = respondedAt
			dt.RejectionCode = ""
			dt.RejectionMessage = ""
			if err := s.repo.UpsertDianTransmission(ctx, tc.DBName, *dt); err != nil {
				return domain.DianActionResult{}, err
			}
			inv.CUFE = cufe
			inv.DianStatus = domain.DianStatusAceptada
			_ = s.repo.SaveInvoice(ctx, tc.DBName, *inv, "")
			inv, _ = s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
			return domain.DianActionResult{
				Transmission: *dt,
				Invoice:      inv,
			}, nil
		}

		note, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, docID)
		if err != nil {
			return domain.DianActionResult{}, err
		}
		if note == nil {
			return domain.DianActionResult{}, apperr.NotFound("La nota " + docID + " no existe")
		}
		cude := domain.DeterministicCUDE(
			note.ID,
			note.IssueDate,
			note.InvoiceID,
			note.ReferencedCUFE,
			note.Subtotal,
			note.TaxTotal,
			note.Total,
			note.CustomerNIT,
		)
		dt.DianStage = domain.DianStageAceptada
		dt.CUFEOrCUDE = cude
		dt.RespondedAt = respondedAt
		dt.RejectionCode = ""
		dt.RejectionMessage = ""
		if err := s.repo.UpsertDianTransmission(ctx, tc.DBName, *dt); err != nil {
			return domain.DianActionResult{}, err
		}
		note, _ = s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, docID)
		return domain.DianActionResult{
			Transmission:   *dt,
			AdjustmentNote: note,
		}, nil
	}

	rejCode := strings.TrimSpace(in.RejectionCode)
	if rejCode == "" {
		rejCode = "DIAN-RUT-04"
	}
	rejMsg := strings.TrimSpace(in.RejectionMessage)
	if rejMsg == "" {
		rejMsg = "Inconsistencia en datos tributarios o NIT del adquiriente"
	}

	dt.DianStage = domain.DianStageRechazada
	dt.CUFEOrCUDE = ""
	dt.RespondedAt = respondedAt
	dt.RejectionCode = rejCode
	dt.RejectionMessage = rejMsg
	if err := s.repo.UpsertDianTransmission(ctx, tc.DBName, *dt); err != nil {
		return domain.DianActionResult{}, err
	}

	if docKind == domain.DocKindInvoice {
		inv, _ := s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
		if inv != nil {
			inv.CUFE = ""
			inv.DianStatus = domain.DianStatusRechazada
			_ = s.repo.SaveInvoice(ctx, tc.DBName, *inv, "")
			inv, _ = s.repo.GetInvoiceByID(ctx, tc.DBName, docID)
		}
		return domain.DianActionResult{
			Transmission: *dt,
			Invoice:      inv,
		}, nil
	}

	note, _ := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, docID)
	return domain.DianActionResult{
		Transmission:   *dt,
		AdjustmentNote: note,
	}, nil
}

func normalizeNoteKind(raw string) (string, error) {
	k := strings.ToUpper(strings.TrimSpace(raw))
	switch k {
	case "", domain.NoteKindCredit, domain.DocKindCreditNote, "NC":
		return domain.NoteKindCredit, nil
	case domain.NoteKindDebit, domain.DocKindDebitNote, "ND":
		return domain.NoteKindDebit, nil
	default:
		return "", apperr.Validation("El tipo de nota debe ser CREDIT o DEBIT")
	}
}

func (s *Service) CreateAdjustmentNote(ctx context.Context, in domain.CreateAdjustmentNoteInput) (domain.AdjustmentNote, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if err := licensegate.CheckModule(ctx, "notas_ajuste"); err != nil {
		return domain.AdjustmentNote{}, err
	}

	noteKind, err := normalizeNoteKind(in.NoteKind)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}

	invoiceID := strings.TrimSpace(in.InvoiceID)
	if invoiceID == "" {
		return domain.AdjustmentNote{}, apperr.Validation("Debes seleccionar la factura de referencia para emitir la nota")
	}
	parentInv, err := s.repo.GetInvoiceByID(ctx, tc.DBName, invoiceID)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if parentInv == nil {
		return domain.AdjustmentNote{}, apperr.NotFound("La factura referenciada " + invoiceID + " no existe")
	}
	if parentInv.DocStatus == domain.DocStatusBorrador {
		return domain.AdjustmentNote{}, apperr.Validation("No se pueden emitir notas sobre una factura en estado Borrador")
	}
	if parentInv.DocStatus == domain.DocStatusAnuladaNC {
		return domain.AdjustmentNote{}, apperr.Validation("La factura referenciada ya se encuentra anulada por Nota Crédito")
	}

	if len(in.Items) == 0 {
		return domain.AdjustmentNote{}, apperr.Validation("Debes incluir al menos un concepto o ítem en la nota")
	}
	items, subtotal, err := s.normalizeAndPriceItems(ctx, in.Items, false)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	taxTotal := 0.0
	for _, it := range items {
		taxTotal = money.RoundCents(taxTotal + (it.Subtotal * (it.TaxPct / 100.0)))
	}
	total := money.RoundCents(subtotal + taxTotal)

	if noteKind == domain.NoteKindCredit {
		available := money.RoundCents(parentInv.Total + parentInv.DebitedTotal - parentInv.CreditedTotal)
		if total > available+0.05 {
			return domain.AdjustmentNote{}, apperr.Validation("El valor de la Nota Crédito supera el valor neto facturado disponible")
		}
	}

	saveMode := strings.ToUpper(strings.TrimSpace(in.SaveMode))
	if saveMode == "" {
		saveMode = domain.SaveModeConfirm
	}
	if saveMode != domain.SaveModeDraft && saveMode != domain.SaveModeConfirm {
		return domain.AdjustmentNote{}, apperr.Validation("El modo de guardado de la nota debe ser DRAFT o CONFIRM")
	}

	reasonCode := strings.TrimSpace(in.ReasonCode)
	if reasonCode == "" {
		reasonCode = "1"
	}
	reasonDesc := strings.TrimSpace(in.ReasonDescription)
	if reasonDesc == "" {
		reasonDesc = domain.DefaultReasonDescription(noteKind, reasonCode)
	}

	customerName := strings.TrimSpace(in.CustomerName)
	if customerName == "" {
		customerName = parentInv.CustomerName
	}
	customerNIT := strings.TrimSpace(in.CustomerNIT)
	if customerNIT == "" {
		customerNIT = parentInv.CustomerNIT
	}

	issueDate := time.Now().Format("2006-01-02 15:04")
	actor := actorFromTenant(tc)

	if saveMode == domain.SaveModeDraft {
		draftID, err := s.repo.ReserveDraftNoteNumber(ctx, tc.DBName, noteKind)
		if err != nil {
			return domain.AdjustmentNote{}, err
		}
		note := domain.AdjustmentNote{
			ID:                draftID,
			Number:            draftID,
			NoteKind:          noteKind,
			InvoiceID:         parentInv.ID,
			ReferencedCUFE:    parentInv.CUFE,
			CustomerID:        parentInv.CustomerID,
			CustomerName:      customerName,
			CustomerNIT:       customerNIT,
			ReasonCode:        reasonCode,
			ReasonDescription: reasonDesc,
			RestockInventory:  noteKind == domain.NoteKindCredit && in.RestockInventory,
			DocStatus:         domain.DocStatusBorrador,
			DianStage:         domain.DianStageSinEnviar,
			Editable:          true,
			Items:             items,
			Subtotal:          subtotal,
			TaxTotal:          taxTotal,
			Total:             total,
			IssueDate:         issueDate,
			Actor:             actor,
		}
		if err := s.repo.SaveAdjustmentNote(ctx, tc.DBName, "", note); err != nil {
			return domain.AdjustmentNote{}, err
		}
		return note, nil
	}

	baseNote := domain.AdjustmentNote{
		NoteKind:          noteKind,
		InvoiceID:         parentInv.ID,
		ReferencedCUFE:    parentInv.CUFE,
		CustomerID:        parentInv.CustomerID,
		CustomerName:      customerName,
		CustomerNIT:       customerNIT,
		ReasonCode:        reasonCode,
		ReasonDescription: reasonDesc,
		RestockInventory:  noteKind == domain.NoteKindCredit && in.RestockInventory,
		Items:             items,
		Subtotal:          subtotal,
		TaxTotal:          taxTotal,
		Total:             total,
		IssueDate:         issueDate,
		Actor:             actor,
	}
	return s.applyNoteConfirmation(ctx, tc, parentInv, "", baseNote)
}

func (s *Service) applyNoteConfirmation(
	ctx context.Context,
	tc authguard.TenantContext,
	parentInv *domain.Invoice,
	oldDraftID string,
	note domain.AdjustmentNote,
) (domain.AdjustmentNote, error) {
	actor := actorFromTenant(tc)
	var officialID string
	var err error
	if note.NoteKind == domain.NoteKindDebit {
		officialID, err = s.repo.ReserveDebitNoteNumber(ctx, tc.DBName)
	} else {
		officialID, err = s.repo.ReserveCreditNoteNumber(ctx, tc.DBName)
	}
	if err != nil {
		return domain.AdjustmentNote{}, err
	}

	note.ID = officialID
	note.Number = officialID
	note.DocStatus = domain.DocStatusConfirmada
	note.DianStage = domain.DianStageSinEnviar
	note.Editable = true
	if note.ReferencedCUFE == "" {
		note.ReferencedCUFE = parentInv.CUFE
	}

	sagaKey := money.NewID("note")
	if note.NoteKind == domain.NoteKindCredit {
		if note.RestockInventory && s.inventoryPort != nil && licensegate.HasService(ctx, "ms-inventario") {
			restockItems := make([]domain.StockMovementItem, 0, len(note.Items))
			for _, it := range note.Items {
				if it.ProductID != "" {
					restockItems = append(restockItems, domain.StockMovementItem{
						ProductID:    it.ProductID,
						Quantity:     it.Quantity,
						UnitCost:     0,
						MovementType: "REINGRESO NOTA CREDITO",
						ReferenceDoc: note.ID,
						Actor:        actor,
					})
				}
			}
			if len(restockItems) > 0 {
				if err := s.inventoryPort.RestockItems(ctx, sagaKey+":nc-restock", restockItems); err != nil {
					return domain.AdjustmentNote{}, err
				}
			}
		}

		debtReduction := 0.0
		if parentInv.PendingBalance > 0 {
			debtReduction = math.Min(parentInv.PendingBalance, note.Total)
			parentInv.PendingBalance = money.RoundCents(parentInv.PendingBalance - debtReduction)
		}
		contractDelta := 0.0
		if parentInv.ContractID != "" {
			contractDelta = -note.Total
		}
		if parentInv.CustomerID != "" && (debtReduction > 0 || contractDelta != 0) && s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
			if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
				IdempotencyKey:        sagaKey + ":nc-cxc",
				CustomerID:            parentInv.CustomerID,
				ContractID:            parentInv.ContractID,
				InvoiceID:             note.ID,
				InvoiceNumber:         note.Number,
				IssueDate:             note.IssueDate,
				InvoiceTotal:          -note.Total,
				DebtDelta:             -debtReduction,
				ContractConsumedDelta: contractDelta,
			}); err != nil {
				return domain.AdjustmentNote{}, err
			}
		}

		parentInv.CreditedTotal = money.RoundCents(parentInv.CreditedTotal + note.Total)
		if note.ReasonCode == "2" || parentInv.CreditedTotal >= parentInv.Total-0.01 {
			parentInv.DocStatus = domain.DocStatusAnuladaNC
			parentInv.Status = domain.StatusAnuladaNC
			parentInv.PendingBalance = 0
		} else if parentInv.PendingBalance <= 0.009 {
			parentInv.PendingBalance = 0
			parentInv.Status = domain.StatusPagada
		}
		if err := s.repo.SaveInvoice(ctx, tc.DBName, *parentInv, ""); err != nil {
			return domain.AdjustmentNote{}, err
		}
	} else {
		parentInv.DebitedTotal = money.RoundCents(parentInv.DebitedTotal + note.Total)
		if parentInv.CustomerID != "" {
			parentInv.PendingBalance = money.RoundCents(parentInv.PendingBalance + note.Total)
			if parentInv.DocStatus != domain.DocStatusAnuladaNC && parentInv.PendingBalance > 0 {
				parentInv.Status = domain.StatusPendienteCxC
			}
			if s.customersPort != nil && licensegate.HasService(ctx, "ms-clientes") {
				contractDelta := 0.0
				if parentInv.ContractID != "" {
					contractDelta = note.Total
				}
				if err := s.customersPort.ApplyReceivableDelta(ctx, domain.ReceivableDeltaInput{
					IdempotencyKey:        sagaKey + ":nd-cxc",
					CustomerID:            parentInv.CustomerID,
					ContractID:            parentInv.ContractID,
					InvoiceID:             note.ID,
					InvoiceNumber:         note.Number,
					IssueDate:             note.IssueDate,
					InvoiceTotal:          note.Total,
					DebtDelta:             note.Total,
					ContractConsumedDelta: contractDelta,
				}); err != nil {
					return domain.AdjustmentNote{}, err
				}
			}
		}
		if err := s.repo.SaveInvoice(ctx, tc.DBName, *parentInv, ""); err != nil {
			return domain.AdjustmentNote{}, err
		}
	}

	if err := s.repo.SaveAdjustmentNote(ctx, tc.DBName, oldDraftID, note); err != nil {
		return domain.AdjustmentNote{}, err
	}

	docKind := domain.DocumentKindForNoteKind(note.NoteKind)
	_ = s.repo.UpsertDianTransmission(ctx, tc.DBName, domain.DianTransmission{
		DocumentKind:   docKind,
		DocumentID:     note.ID,
		DianStage:      domain.DianStageSinEnviar,
		ReferencedCUFE: note.ReferencedCUFE,
		Environment:    "PRODUCCION",
		Attempts:       0,
	})

	hydrated, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, note.ID)
	if err == nil && hydrated != nil {
		return *hydrated, nil
	}
	return note, nil
}

func (s *Service) ConfirmAdjustmentNote(ctx context.Context, noteID string) (domain.AdjustmentNote, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if err := licensegate.CheckModule(ctx, "notas_ajuste"); err != nil {
		return domain.AdjustmentNote{}, err
	}

	existing, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, noteID)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if existing == nil {
		return domain.AdjustmentNote{}, apperr.NotFound("La nota solicitada no existe")
	}
	if existing.DocStatus == domain.DocStatusConfirmada {
		return domain.AdjustmentNote{}, apperr.Conflict("La nota ya se encuentra confirmada")
	}
	if existing.DocStatus != domain.DocStatusBorrador {
		return domain.AdjustmentNote{}, apperr.Validation("Solo se pueden confirmar notas en estado Borrador")
	}

	parentInv, err := s.repo.GetInvoiceByID(ctx, tc.DBName, existing.InvoiceID)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if parentInv == nil {
		return domain.AdjustmentNote{}, apperr.NotFound("La factura referenciada no existe")
	}
	if parentInv.DocStatus != domain.DocStatusConfirmada {
		return domain.AdjustmentNote{}, apperr.Validation("La factura referenciada debe estar confirmada y activa")
	}

	if existing.NoteKind == domain.NoteKindCredit {
		available := money.RoundCents(parentInv.Total + parentInv.DebitedTotal - parentInv.CreditedTotal)
		if existing.Total > available+0.05 {
			return domain.AdjustmentNote{}, apperr.Validation("El valor de la Nota Crédito supera el valor disponible de la factura")
		}
	}

	existing.IssueDate = time.Now().Format("2006-01-02 15:04")
	return s.applyNoteConfirmation(ctx, tc, parentInv, existing.ID, *existing)
}

func (s *Service) UpdateAdjustmentNote(ctx context.Context, noteID string, in domain.UpdateAdjustmentNoteInput) (domain.AdjustmentNote, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if err := licensegate.CheckModule(ctx, "notas_ajuste"); err != nil {
		return domain.AdjustmentNote{}, err
	}

	existing, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, noteID)
	if err != nil {
		return domain.AdjustmentNote{}, err
	}
	if existing == nil {
		return domain.AdjustmentNote{}, apperr.NotFound("La nota solicitada no existe")
	}
	if existing.DianStage == domain.DianStageEnviada || existing.DianStage == domain.DianStageAceptada {
		return domain.AdjustmentNote{}, apperr.Validation("No se puede editar una nota ya enviada o aceptada por la DIAN")
	}

	reasonCode := strings.TrimSpace(in.ReasonCode)
	if reasonCode == "" {
		reasonCode = existing.ReasonCode
	}
	reasonDesc := strings.TrimSpace(in.ReasonDescription)
	if reasonDesc == "" {
		reasonDesc = domain.DefaultReasonDescription(existing.NoteKind, reasonCode)
	}
	customerName := strings.TrimSpace(in.CustomerName)
	if customerName == "" {
		customerName = existing.CustomerName
	}
	customerNIT := strings.TrimSpace(in.CustomerNIT)
	if customerNIT == "" {
		customerNIT = existing.CustomerNIT
	}

	if existing.DocStatus == domain.DocStatusBorrador {
		noteKind := existing.NoteKind
		if strings.TrimSpace(in.NoteKind) != "" {
			if parsedKind, kErr := normalizeNoteKind(in.NoteKind); kErr == nil {
				noteKind = parsedKind
			}
		}
		rawItems := in.Items
		if len(rawItems) == 0 {
			rawItems = existing.Items
		}
		items, subtotal, err := s.normalizeAndPriceItems(ctx, rawItems, false)
		if err != nil {
			return domain.AdjustmentNote{}, err
		}
		taxTotal := 0.0
		for _, it := range items {
			taxTotal = money.RoundCents(taxTotal + (it.Subtotal * (it.TaxPct / 100.0)))
		}
		total := money.RoundCents(subtotal + taxTotal)

		invID := strings.TrimSpace(in.InvoiceID)
		if invID == "" {
			invID = existing.InvoiceID
		}
		parentInv, err := s.repo.GetInvoiceByID(ctx, tc.DBName, invID)
		if err != nil {
			return domain.AdjustmentNote{}, err
		}
		if parentInv == nil {
			return domain.AdjustmentNote{}, apperr.NotFound("La factura referenciada no existe")
		}

		updated := *existing
		updated.NoteKind = noteKind
		updated.InvoiceID = parentInv.ID
		updated.ReferencedCUFE = parentInv.CUFE
		updated.CustomerID = parentInv.CustomerID
		updated.CustomerName = customerName
		updated.CustomerNIT = customerNIT
		updated.ReasonCode = reasonCode
		updated.ReasonDescription = reasonDesc
		updated.RestockInventory = noteKind == domain.NoteKindCredit && in.RestockInventory
		updated.Items = items
		updated.Subtotal = subtotal
		updated.TaxTotal = taxTotal
		updated.Total = total
		updated.Actor = actorFromTenant(tc)

		if err := s.repo.SaveAdjustmentNote(ctx, tc.DBName, "", updated); err != nil {
			return domain.AdjustmentNote{}, err
		}
		if strings.EqualFold(strings.TrimSpace(in.SaveMode), domain.SaveModeConfirm) {
			return s.ConfirmAdjustmentNote(ctx, updated.ID)
		}
		return updated, nil
	}

	updated := *existing
	updated.CustomerName = customerName
	updated.CustomerNIT = customerNIT
	updated.ReasonCode = reasonCode
	updated.ReasonDescription = reasonDesc
	updated.Actor = actorFromTenant(tc)

	if len(in.Items) > 0 {
		items, subtotal, err := s.normalizeAndPriceItems(ctx, in.Items, false)
		if err != nil {
			return domain.AdjustmentNote{}, err
		}
		taxTotal := 0.0
		for _, it := range items {
			taxTotal = money.RoundCents(taxTotal + (it.Subtotal * (it.TaxPct / 100.0)))
		}
		newTotal := money.RoundCents(subtotal + taxTotal)
		diff := money.RoundCents(newTotal - existing.Total)
		if math.Abs(diff) >= 0.01 {
			if parentInv, pErr := s.repo.GetInvoiceByID(ctx, tc.DBName, existing.InvoiceID); pErr == nil && parentInv != nil {
				if existing.NoteKind == domain.NoteKindCredit {
					parentInv.CreditedTotal = math.Max(0, money.RoundCents(parentInv.CreditedTotal+diff))
				} else {
					parentInv.DebitedTotal = math.Max(0, money.RoundCents(parentInv.DebitedTotal+diff))
				}
				_ = s.repo.SaveInvoice(ctx, tc.DBName, *parentInv, "")
			}
		}
		updated.Items = items
		updated.Subtotal = subtotal
		updated.TaxTotal = taxTotal
		updated.Total = newTotal
	}

	if err := s.repo.SaveAdjustmentNote(ctx, tc.DBName, "", updated); err != nil {
		return domain.AdjustmentNote{}, err
	}
	rehydrated, err := s.repo.GetAdjustmentNoteByID(ctx, tc.DBName, updated.ID)
	if err == nil && rehydrated != nil {
		return *rehydrated, nil
	}
	return updated, nil
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
