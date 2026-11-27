package backend_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/json"
	"go/parser"
	"go/token"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ms-facturacion/internal/platform/apperr"
	"ms-facturacion/internal/platform/authguard"
	"ms-facturacion/internal/platform/config"
	"ms-facturacion/internal/platform/security"
	"ms-facturacion/backend"
	"ms-facturacion/internal/application"
	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/infrastructure/persistence/memory"
)

type spyInventoryPort struct {
	quotes       map[string]domain.ProductQuote
	deductCalls  [][]domain.StockMovementItem
	restockCalls [][]domain.StockMovementItem
	deductErr    error
	restockErr   error
}

func (s *spyInventoryPort) QuoteProducts(_ context.Context, productIDs []string) (map[string]domain.ProductQuote, error) {
	out := make(map[string]domain.ProductQuote, len(productIDs))
	for _, id := range productIDs {
		if q, ok := s.quotes[id]; ok {
			out[id] = q
		}
	}
	return out, nil
}

func (s *spyInventoryPort) DeductStock(_ context.Context, _ string, items []domain.StockMovementItem) error {
	if s.deductErr != nil {
		return s.deductErr
	}
	cloned := append([]domain.StockMovementItem(nil), items...)
	s.deductCalls = append(s.deductCalls, cloned)
	return nil
}

func (s *spyInventoryPort) RestockItems(_ context.Context, _ string, items []domain.StockMovementItem) error {
	if s.restockErr != nil {
		return s.restockErr
	}
	cloned := append([]domain.StockMovementItem(nil), items...)
	s.restockCalls = append(s.restockCalls, cloned)
	return nil
}

type spyCustomersPort struct {
	terms      domain.CommercialTerms
	deltaCalls []domain.ReceivableDeltaInput
	failFirst  bool
}

func (s *spyCustomersPort) ResolveCommercialTerms(_ context.Context, customerID, contractID string) (domain.CommercialTerms, error) {
	res := s.terms
	if res.CustomerID == "" {
		res.CustomerID = customerID
	}
	if res.ContractID == "" {
		res.ContractID = contractID
	}
	return res, nil
}

func (s *spyCustomersPort) ApplyReceivableDelta(_ context.Context, input domain.ReceivableDeltaInput) error {
	if s.failFirst && len(s.deltaCalls) == 0 {
		return apperr.Unprocessable("El saldo supera el cupo de crédito autorizado del cliente")
	}
	s.deltaCalls = append(s.deltaCalls, input)
	return nil
}

type spyWorkshopPort struct {
	calls        int
	mechanicName string
	err          error
}

func (s *spyWorkshopPort) RegisterInvoicedOrder(_ context.Context, _, _ string, _ float64, _ string) (string, error) {
	s.calls++
	if s.err != nil {
		return "", s.err
	}
	return s.mechanicName, nil
}

type spyHospitalityPort struct {
	calls int
	err   error
}

func (s *spyHospitalityPort) CompleteRoomCheckout(_ context.Context, _, _ string) error {
	s.calls++
	return s.err
}

type spyGastroPort struct {
	calls int
	err   error
}

func (s *spyGastroPort) ClearInvoicedTable(_ context.Context, _, _ string) error {
	s.calls++
	return s.err
}

type spyPrintPort struct {
	calls int
}

func (s *spyPrintPort) RenderInvoice(_ context.Context, inv domain.Invoice) (string, error) {
	s.calls++
	return "<html><body>Factura " + inv.ID + "</body></html>", nil
}

func TestHexagonalASTPurity(t *testing.T) {
	forbiddenSubstrings := []string{
		"pgx",
		"database/sql",
		"chi",
		"net/http",
		"grpc",
		"ms-facturacion/internal/platform/dbpool",
		"ms-facturacion/internal/platform/grpcx",
		"ms-facturacion/internal/platform/httpx",
	}

	roots := []string{
		filepath.Join("..", "internal", "domain"),
		filepath.Join("..", "internal", "application"),
		filepath.Join("..", "internal", "modules"),
	}

	fset := token.NewFileSet()
	for _, root := range roots {
		err := filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if info.IsDir() || !strings.HasSuffix(path, ".go") {
				return nil
			}
			f, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
			if err != nil {
				t.Fatalf("failed to parse %s: %v", path, err)
			}
			for _, imp := range f.Imports {
				impPath := strings.Trim(imp.Path.Value, `"`)
				for _, banned := range forbiddenSubstrings {
					if strings.Contains(impPath, banned) {
						t.Errorf("hexagonal AST violation in %s: forbidden import %q (matched %q)", path, impPath, banned)
					}
				}
			}
			return nil
		})
		if err != nil {
			t.Fatalf("walk failed on %s: %v", root, err)
		}
	}
}

func TestServerSidePriceAuthorityCommercialTermsAndIdempotency(t *testing.T) {
	repo := memory.NewRepository()
	invSpy := &spyInventoryPort{
		quotes: map[string]domain.ProductQuote{
			"prd-101": {
				ProductID:      "prd-101",
				Code:           "FIL-01",
				Name:           "Filtro Sintético Motor",
				SalePrice:      130000,
				TaxPct:         19,
				AvailableStock: 25,
			},
		},
	}
	custSpy := &spyCustomersPort{
		terms: domain.CommercialTerms{
			CustomerID:      "cli-101",
			CustomerName:    "Transportes Industriales S.A.S.",
			CustomerNIT:     "900.412.889-1",
			CustomerPhone:   "6014402211",
			CustomerAddress: "Zona Franca Bodega 8",
			ContractID:      "cnv-201",
			ContractCode:    "CNV-201",
			DiscountPct:     10,
		},
	}
	workSpy := &spyWorkshopPort{mechanicName: "Especialista Automotriz Senior"}
	printSpy := &spyPrintPort{}

	app := application.NewService(repo, application.Ports{
		Inventory: invSpy,
		Customers: custSpy,
		Workshop:  workSpy,
		Print:     printSpy,
	})

	ctx := authguard.WithContext(context.Background(), authguard.TenantContext{
		TenantID:       "ten-1",
		DBName:         "db_facturacion_test",
		Username:       "cajero@empresa.co",
		Role:           "admin",
		IdempotencyKey: "idem-inv-001",
		ActiveServices: []string{"ms-facturacion", "ms-inventario", "ms-clientes", "ms-taller", "ms-impresiones"},
		ActiveModules:  []string{"pos_mostrador", "cotizaciones", "facturas_taller", "facturacion_dian"},
		ActiveFeatures: []string{"descuento_linea", "pagos_mixtos_cxc", "asignar_mecanico", "factura_taller_pdf"},
	})

	paid := 200000.0
	input := domain.CreateInvoiceInput{
		CustomerID:        "cli-101",
		VehicleID:         "veh-01",
		Plate:             "kmn452",
		MechanicID:        "mec-01",
		LinkedWorkOrderID: "OT-701",
		WorkshopMeta: domain.WorkshopMetadata{
			VehicleBrand: "Renault Duster",
			CurrentKm:    "48500",
			NextOilKm:    "53500",
		},
		Items: []domain.InvoiceItem{
			{
				ProductID:   "prd-101",
				ItemType:    "PRODUCTO",
				Quantity:    2,
				UnitPrice:   1,
				TaxPct:      0,
				Description: "Precio manipulado desde cliente",
			},
			{
				ItemType:    "SERVICIO",
				Code:        "SRV-MNT",
				Description: "Mantenimiento preventivo general",
				Quantity:    1,
				UnitPrice:   80000,
				TaxPct:      19,
			},
		},
		PaymentMethod: "Transferencia",
		AmountPaid:    &paid,
		RenderPrint:   true,
	}

	res, err := app.CreateInvoice(ctx, input)
	if err != nil {
		t.Fatalf("CreateInvoice failed: %v", err)
	}
	if res.Replayed {
		t.Fatalf("expected first execution not to be marked replayed")
	}
	if res.Invoice.Items[0].UnitPrice != 130000 || res.Invoice.Items[0].TaxPct != 19 {
		t.Fatalf("expected server-side price override (130000 / 19%%), got %+v", res.Invoice.Items[0])
	}
	if res.Invoice.Subtotal != 340000 || res.Invoice.DiscountTotal != 34000 || res.Invoice.TaxTotal != 58140 || res.Invoice.Total != 364140 {
		t.Fatalf("unexpected invoice totals: subtotal=%v discount=%v tax=%v total=%v",
			res.Invoice.Subtotal, res.Invoice.DiscountTotal, res.Invoice.TaxTotal, res.Invoice.Total)
	}
	if res.Invoice.PendingBalance != 164140 || res.Invoice.Status != domain.StatusPendienteCxC {
		t.Fatalf("expected pending balance 164140 and Pendiente CxC, got %v / %s", res.Invoice.PendingBalance, res.Invoice.Status)
	}
	if res.Invoice.LayoutVariant != domain.LayoutTaller || res.Invoice.Plate != "KMN452" || res.Invoice.MechanicName != "Especialista Automotriz Senior" {
		t.Fatalf("unexpected workshop enrichment: %+v", res.Invoice)
	}
	if len(res.Invoice.CUFE) != 96 || res.Invoice.DianStatus != domain.DianStatusAceptada {
		t.Fatalf("expected 96-char deterministic CUFE and ACEPTADA DIAN, got cufe=%q status=%q", res.Invoice.CUFE, res.Invoice.DianStatus)
	}
	if !strings.Contains(res.PrintHTML, res.Invoice.ID) {
		t.Fatalf("expected rendered printHtml containing invoice id, got %q", res.PrintHTML)
	}

	replayed, err := app.CreateInvoice(ctx, input)
	if err != nil {
		t.Fatalf("idempotent replay failed: %v", err)
	}
	if !replayed.Replayed || replayed.Invoice.ID != res.Invoice.ID {
		t.Fatalf("expected idempotent replay of %s, got replayed=%v id=%s", res.Invoice.ID, replayed.Replayed, replayed.Invoice.ID)
	}
	if len(invSpy.deductCalls) != 1 || len(custSpy.deltaCalls) != 1 || workSpy.calls != 1 {
		t.Fatalf("expected upstream side effects once, got deduct=%d cxc=%d workshop=%d",
			len(invSpy.deductCalls), len(custSpy.deltaCalls), workSpy.calls)
	}
}

func TestLicenseGatesAndCreditValidation(t *testing.T) {
	repo := memory.NewRepository()
	workSpy := &spyWorkshopPort{mechanicName: "Técnico"}
	app := application.NewService(repo, application.Ports{
		Workshop: workSpy,
	})

	baseTC := authguard.TenantContext{
		TenantID:       "ten-2",
		DBName:         "db_gates_test",
		Username:       "cajero@empresa.co",
		Role:           "cajero",
		ActiveServices: []string{"ms-facturacion", "ms-taller"},
		ActiveModules:  []string{"pos_mostrador"},
		ActiveFeatures: []string{},
	}

	partialPaid := 10000.0
	_, err := app.CreateInvoice(authguard.WithContext(context.Background(), baseTC), domain.CreateInvoiceInput{
		CustomerID: "cli-101",
		Items: []domain.InvoiceItem{
			{ItemType: "SERVICIO", Description: "Servicio técnico", Quantity: 1, UnitPrice: 50000, TaxPct: 19},
		},
		AmountPaid: &partialPaid,
	})
	if !apperr.IsKind(err, apperr.KindForbidden) {
		t.Fatalf("expected Forbidden when pagos_mixtos_cxc is disabled, got %v", err)
	}

	tcWithCredit := baseTC
	tcWithCredit.ActiveFeatures = []string{"pagos_mixtos_cxc"}
	_, err = app.CreateInvoice(authguard.WithContext(context.Background(), tcWithCredit), domain.CreateInvoiceInput{
		CustomerID: "",
		Items: []domain.InvoiceItem{
			{ItemType: "SERVICIO", Description: "Servicio técnico", Quantity: 1, UnitPrice: 50000, TaxPct: 19},
		},
		AmountPaid: &partialPaid,
	})
	if !apperr.IsKind(err, apperr.KindValidation) {
		t.Fatalf("expected Validation error when credit invoice has empty customerId, got %v", err)
	}

	resNoModules, err := app.CreateInvoice(authguard.WithContext(context.Background(), tcWithCredit), domain.CreateInvoiceInput{
		CustomerID:        "cli-101",
		CustomerName:      "Cliente Corporativo",
		CustomerNIT:       "900111222-3",
		VehicleID:         "veh-99",
		Plate:             "XYZ987",
		MechanicID:        "mec-01",
		LinkedWorkOrderID: "OT-999",
		LayoutVariant:     "factura_taller",
		Items: []domain.InvoiceItem{
			{ItemType: "SERVICIO", Description: "Servicio general", Quantity: 1, UnitPrice: 50000, TaxPct: 19},
		},
	})
	if err != nil {
		t.Fatalf("expected cash invoice without workshop/dian modules to succeed, got %v", err)
	}
	if resNoModules.Invoice.Plate != "" || resNoModules.Invoice.LayoutVariant != "" || resNoModules.Invoice.MechanicID != "" {
		t.Fatalf("expected workshop metadata stripped when facturas_taller disabled, got %+v", resNoModules.Invoice)
	}
	if resNoModules.Invoice.CUFE != "" || resNoModules.Invoice.DianStatus != "" {
		t.Fatalf("expected DIAN fields empty when facturacion_dian disabled, got %+v", resNoModules.Invoice)
	}
	if workSpy.calls != 0 {
		t.Fatalf("expected zero workshop upstream calls when facturas_taller disabled, got %d", workSpy.calls)
	}

	_, err = app.CreateQuote(authguard.WithContext(context.Background(), tcWithCredit), domain.CreateQuoteInput{
		CustomerName: "Prospecto",
		Items:        []domain.InvoiceItem{{ItemType: "SERVICIO", Description: "Consultoría", Quantity: 1, UnitPrice: 100000}},
	})
	if !apperr.IsKind(err, apperr.KindForbidden) {
		t.Fatalf("expected Forbidden on CreateQuote when cotizaciones module inactive, got %v", err)
	}
}

func TestSagaCompensationOnReceivableAndDownstreamFailures(t *testing.T) {
	t.Run("compensates deducted stock when receivable delta fails", func(t *testing.T) {
		repo := memory.NewRepository()
		invSpy := &spyInventoryPort{
			quotes: map[string]domain.ProductQuote{
				"prd-101": {ProductID: "prd-101", Code: "PRD-101", Name: "Repuesto A", SalePrice: 100000, TaxPct: 19},
			},
		}
		custSpy := &spyCustomersPort{
			terms:     domain.CommercialTerms{CustomerID: "cli-101", CustomerName: "Cliente", CustomerNIT: "900123456-7"},
			failFirst: true,
		}
		app := application.NewService(repo, application.Ports{
			Inventory: invSpy,
			Customers: custSpy,
		})

		ctx := authguard.WithContext(context.Background(), authguard.TenantContext{
			TenantID:       "ten-saga-1",
			DBName:         "db_saga_case_a",
			Username:       "cajero@empresa.co",
			Role:           "admin",
			ActiveServices: []string{"ms-facturacion", "ms-inventario", "ms-clientes"},
			ActiveModules:  []string{"pos_mostrador"},
			ActiveFeatures: []string{"pagos_mixtos_cxc"},
		})

		beforeList, _ := repo.ListInvoices(ctx, "db_saga_case_a")
		zeroPaid := 0.0
		_, err := app.CreateInvoice(ctx, domain.CreateInvoiceInput{
			CustomerID: "cli-101",
			Items:      []domain.InvoiceItem{{ProductID: "prd-101", ItemType: "PRODUCTO", Quantity: 3}},
			AmountPaid: &zeroPaid,
		})
		if !apperr.IsKind(err, apperr.KindUnprocessable) {
			t.Fatalf("expected Unprocessable error from customer credit limit, got %v", err)
		}
		if len(invSpy.deductCalls) != 1 || len(invSpy.restockCalls) != 1 {
			t.Fatalf("expected 1 deduct and 1 compensating restock, got deduct=%d restock=%d",
				len(invSpy.deductCalls), len(invSpy.restockCalls))
		}
		restocked := invSpy.restockCalls[0][0]
		if restocked.ProductID != "prd-101" || restocked.Quantity != 3 || restocked.MovementType != "REVERSO SAGA" || restocked.UnitCost != 0 {
			t.Fatalf("unexpected compensating stock payload: %+v", restocked)
		}
		afterList, _ := repo.ListInvoices(ctx, "db_saga_case_a")
		if len(afterList) != len(beforeList) {
			t.Fatalf("expected zero phantom invoices persisted, before=%d after=%d", len(beforeList), len(afterList))
		}
	})

	t.Run("compensates both receivable delta and stock when downstream hospitality checkout fails", func(t *testing.T) {
		repo := memory.NewRepository()
		invSpy := &spyInventoryPort{
			quotes: map[string]domain.ProductQuote{
				"prd-202": {ProductID: "prd-202", Code: "MIN-02", Name: "Kit Minibar", SalePrice: 50000, TaxPct: 0},
			},
		}
		custSpy := &spyCustomersPort{
			terms: domain.CommercialTerms{
				CustomerID:   "cli-202",
				CustomerName: "Corporación Hotelera",
				CustomerNIT:  "901888777-6",
				ContractID:   "cnv-500",
			},
		}
		hospSpy := &spyHospitalityPort{
			err: apperr.Conflict("La habitación ya fue cerrada por otro turno"),
		}
		app := application.NewService(repo, application.Ports{
			Inventory:   invSpy,
			Customers:   custSpy,
			Hospitality: hospSpy,
		})

		ctx := authguard.WithContext(context.Background(), authguard.TenantContext{
			TenantID:       "ten-saga-2",
			DBName:         "db_saga_case_b",
			Username:       "recepcion@empresa.co",
			Role:           "admin",
			ActiveServices: []string{"ms-facturacion", "ms-inventario", "ms-clientes", "ms-hoteleria"},
			ActiveModules:  []string{"pos_mostrador"},
			ActiveFeatures: []string{"pagos_mixtos_cxc"},
		})

		beforeList, _ := repo.ListInvoices(ctx, "db_saga_case_b")
		paid := 20000.0
		_, err := app.CreateInvoice(ctx, domain.CreateInvoiceInput{
			CustomerID:   "cli-202",
			ContractID:   "cnv-500",
			LinkedRoomID: "hab-302",
			Items: []domain.InvoiceItem{
				{ProductID: "prd-202", ItemType: "PRODUCTO", Quantity: 2},
				{ItemType: "SERVICIO", Code: "ALJ-302", Description: "Noche Habitación Ejecutiva", Quantity: 1, UnitPrice: 200000, TaxPct: 0},
			},
			AmountPaid: &paid,
		})
		if !apperr.IsKind(err, apperr.KindConflict) {
			t.Fatalf("expected Conflict from hospitality port, got %v", err)
		}
		if len(custSpy.deltaCalls) != 2 {
			t.Fatalf("expected 2 receivable calls (apply + compensation), got %d", len(custSpy.deltaCalls))
		}
		applied := custSpy.deltaCalls[0]
		compensated := custSpy.deltaCalls[1]
		if applied.DebtDelta != 280000 || applied.ContractConsumedDelta != 300000 {
			t.Fatalf("unexpected forward receivable delta: %+v", applied)
		}
		if compensated.DebtDelta != -280000 || compensated.ContractConsumedDelta != -300000 {
			t.Fatalf("unexpected compensating receivable delta: %+v", compensated)
		}
		if len(invSpy.restockCalls) != 1 || invSpy.restockCalls[0][0].MovementType != "REVERSO SAGA" {
			t.Fatalf("expected compensating stock restock, got %+v", invSpy.restockCalls)
		}
		afterList, _ := repo.ListInvoices(ctx, "db_saga_case_b")
		if len(afterList) != len(beforeList) {
			t.Fatalf("expected zero phantom invoices persisted, before=%d after=%d", len(beforeList), len(afterList))
		}
	})
}

func TestHTTPZeroTrustAndEndpoints(t *testing.T) {
	seed := sha256.Sum256([]byte("test_seed_facturacion_hexagonal"))
	priv := ed25519.NewKeyFromSeed(seed[:])
	pub := priv.Public().(ed25519.PublicKey)
	s2sKey := "s2s-facturacion-secret"
	replay := security.NewReplayGuard(1024)

	cfg := config.ServiceConfig{
		CommonConfig: config.CommonConfig{
			Environment:    "development",
			ServiceName:    "ms-facturacion",
			HTTPPort:       4101,
			GRPCPort:       9101,
			S2SSharedKey:   s2sKey,
			AllowedOrigins: []string{"http://localhost:5173"},
		},
	}

	gastroSpy := &spyGastroPort{}
	svc := backend.NewService(cfg, pub, replay, nil, backend.Clients{}, backend.WithPorts(application.Ports{
		Gastro: gastroSpy,
	}))
	ts := httptest.NewServer(svc.Handler())
	defer ts.Close()

	healthResp, err := http.Get(ts.URL + "/api/v1/facturacion/health")
	if err != nil || healthResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on health, got %v err=%v", healthResp, err)
	}
	_ = healthResp.Body.Close()

	unauthResp, err := http.Get(ts.URL + "/api/v1/facturacion/pos-state")
	if err != nil || unauthResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without passport, got %v err=%v", unauthResp, err)
	}
	_ = unauthResp.Body.Close()

	doSigned := func(method, path, idemKey string, body any) *http.Response {
		t.Helper()
		passport, signErr := security.SignPassport(priv, security.PassportClaims{
			TenantID:       "ten-http",
			DBName:         "db_facturacion_http",
			Username:       "operador@empresa.co",
			Role:           "admin",
			Audience:       "ms-facturacion",
			ActiveServices: []string{"ms-facturacion", "ms-comandas"},
			ActiveModules:  []string{"pos_mostrador", "cotizaciones", "facturas_taller", "facturacion_dian"},
			ActiveFeatures: []string{"descuento_linea", "pagos_mixtos_cxc", "asignar_mecanico", "factura_taller_pdf"},
		}, 30*time.Second)
		if signErr != nil {
			t.Fatalf("SignPassport failed: %v", signErr)
		}

		var reader *bytes.Reader
		if body != nil {
			raw, _ := json.Marshal(body)
			reader = bytes.NewReader(raw)
		} else {
			reader = bytes.NewReader(nil)
		}
		req, reqErr := http.NewRequest(method, ts.URL+path, reader)
		if reqErr != nil {
			t.Fatalf("NewRequest failed: %v", reqErr)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		req.Header.Set(security.PassportHeader, passport)
		if idemKey != "" {
			req.Header.Set("Idempotency-Key", idemKey)
		}
		res, doErr := http.DefaultClient.Do(req)
		if doErr != nil {
			t.Fatalf("HTTP call failed: %v", doErr)
		}
		return res
	}

	manifestRes := doSigned(http.MethodGet, "/api/v1/facturacion/manifest", "", nil)
	if manifestRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /manifest, got %d", manifestRes.StatusCode)
	}
	var manifestBody map[string]any
	if err := json.NewDecoder(manifestRes.Body).Decode(&manifestBody); err != nil {
		t.Fatalf("decode manifest failed: %v", err)
	}
	_ = manifestRes.Body.Close()
	if manifestBody["serviceKey"] != "ms-facturacion" {
		t.Fatalf("unexpected serviceKey in manifest: %v", manifestBody["serviceKey"])
	}

	uiRes := doSigned(http.MethodGet, "/api/v1/facturacion/ui.js", "", nil)
	uiBytes, _ := io.ReadAll(uiRes.Body)
	_ = uiRes.Body.Close()
	if uiRes.StatusCode != http.StatusOK || len(uiBytes) < 1024 {
		t.Fatalf("expected embedded MFE bundle >1KB, got status=%d bytes=%d", uiRes.StatusCode, len(uiBytes))
	}

	posRes := doSigned(http.MethodGet, "/api/v1/facturacion/pos-state", "", nil)
	if posRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /pos-state, got %d", posRes.StatusCode)
	}
	var posPayload map[string]any
	_ = json.NewDecoder(posRes.Body).Decode(&posPayload)
	_ = posRes.Body.Close()
	for _, k := range []string{"nextInvoiceNumber", "nextQuoteNumber", "invoices", "quotes", "summary"} {
		if _, ok := posPayload[k]; !ok {
			t.Fatalf("missing key %q in /pos-state response", k)
		}
	}

	invPayload := map[string]any{
		"customerName":  "Mesa Ejecutiva Salón Principal",
		"customerNit":   "901444555-9",
		"linkedTableId": "mesa-04",
		"paymentMethod": "Efectivo",
		"items": []map[string]any{
			{
				"kind":   "SERVICIO",
				"refId":  "cmd-101",
				"code":   "GAS-01",
				"name":   "Menú Ejecutivo Corporativo",
				"qty":    2,
				"price":  45000,
				"taxPct": 8,
			},
		},
	}

	invRes1 := doSigned(http.MethodPost, "/api/v1/facturacion/invoices", "http-idem-001", invPayload)
	if invRes1.StatusCode != http.StatusCreated {
		raw, _ := io.ReadAll(invRes1.Body)
		_ = invRes1.Body.Close()
		t.Fatalf("expected 201 on POST /invoices, got %d: %s", invRes1.StatusCode, string(raw))
	}
	var invBody1 map[string]any
	_ = json.NewDecoder(invRes1.Body).Decode(&invBody1)
	_ = invRes1.Body.Close()

	invRes2 := doSigned(http.MethodPost, "/api/v1/facturacion/invoices", "http-idem-001", invPayload)
	if invRes2.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on idempotent POST /invoices replay, got %d", invRes2.StatusCode)
	}
	var invBody2 map[string]any
	_ = json.NewDecoder(invRes2.Body).Decode(&invBody2)
	_ = invRes2.Body.Close()

	invMap1 := invBody1["invoice"].(map[string]any)
	invMap2 := invBody2["invoice"].(map[string]any)
	if invMap1["id"] != invMap2["id"] || gastroSpy.calls != 1 {
		t.Fatalf("expected identical invoice id on replay and 1 gastro call, got id1=%v id2=%v gastroCalls=%d",
			invMap1["id"], invMap2["id"], gastroSpy.calls)
	}

	sumRes := doSigned(http.MethodGet, "/api/v1/facturacion/summary", "", nil)
	if sumRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on /summary, got %d", sumRes.StatusCode)
	}
	var sumPayload map[string]any
	_ = json.NewDecoder(sumRes.Body).Decode(&sumPayload)
	_ = sumRes.Body.Close()
	for _, k := range []string{"cashSales", "digitalSales", "cashCollected", "digitalCollected", "totalSales"} {
		if _, ok := sumPayload[k]; !ok {
			t.Fatalf("missing key %q in /summary response", k)
		}
	}

	quoteRes := doSigned(http.MethodPost, "/api/v1/facturacion/quotes", "", map[string]any{
		"customerName": "Empresa Industrial del Norte S.A.S.",
		"customerNit":  "900999888-1",
		"items": []map[string]any{
			{"itemType": "SERVICIO", "code": "COT-01", "description": "Servicio de calibración anual", "quantity": 1, "unitPrice": 650000, "taxPct": 19},
		},
	})
	if quoteRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on POST /quotes, got %d", quoteRes.StatusCode)
	}
	_ = quoteRes.Body.Close()
}

func TestFourStageLifecycleTwoStepDianAndAdjustmentNotes(t *testing.T) {
	repo := memory.NewRepository()
	invSpy := &spyInventoryPort{
		quotes: map[string]domain.ProductQuote{
			"prd-500": {
				ProductID:      "prd-500",
				Code:           "PRD-500",
				Name:           "Disco de Freno Ventilado",
				SalePrice:      100000,
				TaxPct:         19,
				AvailableStock: 50,
			},
		},
	}
	custSpy := &spyCustomersPort{
		terms: domain.CommercialTerms{
			CustomerID:   "cli-500",
			CustomerName: "Flota Continental S.A.S.",
			CustomerNIT:  "900000000-0",
		},
	}
	hospSpy := &spyHospitalityPort{}

	app := application.NewService(repo, application.Ports{
		Inventory:   invSpy,
		Customers:   custSpy,
		Hospitality: hospSpy,
	})

	ctx := authguard.WithContext(context.Background(), authguard.TenantContext{
		TenantID:       "ten-4stage",
		DBName:         "db_4stage_test",
		Username:       "facturador@empresa.co",
		Role:           "admin",
		ActiveServices: []string{"ms-facturacion", "ms-inventario", "ms-clientes", "ms-hoteleria"},
		ActiveModules:  []string{"pos_mostrador", "notas_ajuste", "cotizaciones", "facturas_taller", "facturacion_dian"},
		ActiveFeatures: []string{"descuento_linea", "pagos_mixtos_cxc"},
	})

	paid := 100000.0
	draftRes, err := app.CreateInvoice(ctx, domain.CreateInvoiceInput{
		SaveMode:         domain.SaveModeDraft,
		InvoiceType:      domain.InvoiceTypeHoteleria,
		CustomerID:       "cli-500",
		LinkedRoomID:     "suite-401",
		PurchaseOrderRef: "OC-991",
		DueDate:          "2026-12-31",
		Items: []domain.InvoiceItem{
			{ProductID: "prd-500", ItemType: "PRODUCTO", Quantity: 1},
		},
		PaymentMethod: "Crédito / Cartera CxC",
		AmountPaid:    &paid,
		Notes:         "Borrador inicial",
	})
	if err != nil {
		t.Fatalf("CreateInvoice DRAFT failed: %v", err)
	}
	if !strings.HasPrefix(draftRes.Invoice.ID, "BOR-") || draftRes.Invoice.DocStatus != domain.DocStatusBorrador || !draftRes.Invoice.Editable {
		t.Fatalf("expected BOR-* draft editable invoice, got %+v", draftRes.Invoice)
	}
	if len(invSpy.deductCalls) != 0 || len(custSpy.deltaCalls) != 0 || hospSpy.calls != 0 {
		t.Fatalf("expected zero side effects on DRAFT, got deduct=%d cxc=%d hosp=%d",
			len(invSpy.deductCalls), len(custSpy.deltaCalls), hospSpy.calls)
	}

	if _, err := app.SendToDian(ctx, domain.DianSendInput{DocumentKind: "INVOICE", DocumentID: draftRes.Invoice.ID}); !apperr.IsKind(err, apperr.KindValidation) {
		t.Fatalf("expected Validation error sending unconfirmed draft to DIAN, got %v", err)
	}

	updDraftRes, err := app.UpdateInvoice(ctx, draftRes.Invoice.ID, domain.UpdateInvoiceInput{
		InvoiceType:      domain.InvoiceTypeHoteleria,
		CustomerID:       "cli-500",
		LinkedRoomID:     "suite-401",
		PurchaseOrderRef: "OC-991",
		DueDate:          "2026-12-31",
		Items: []domain.InvoiceItem{
			{ProductID: "prd-500", ItemType: "PRODUCTO", Quantity: 2},
		},
		PaymentMethod: "Crédito / Cartera CxC",
		AmountPaid:    &paid,
		Notes:         "Borrador ajustado a 2 unidades",
	})
	if err != nil {
		t.Fatalf("UpdateInvoice on DRAFT failed: %v", err)
	}
	if updDraftRes.Invoice.ID != draftRes.Invoice.ID || updDraftRes.Invoice.Total != 238000 {
		t.Fatalf("expected updated draft total 238000 on same ID, got %+v", updDraftRes.Invoice)
	}

	confRes, err := app.ConfirmInvoice(ctx, draftRes.Invoice.ID, false)
	if err != nil {
		t.Fatalf("ConfirmInvoice failed: %v", err)
	}
	if !strings.HasPrefix(confRes.Invoice.ID, "FEVP-") || confRes.Invoice.DocStatus != domain.DocStatusConfirmada {
		t.Fatalf("expected FEVP-* confirmed invoice, got %+v", confRes.Invoice)
	}
	if confRes.Invoice.DianStage != domain.DianStageSinEnviar || confRes.Invoice.CUFE != "" || !confRes.Invoice.Editable {
		t.Fatalf("expected SIN_ENVIAR without auto-CUFE and editable=true, got %+v", confRes.Invoice)
	}
	if len(invSpy.deductCalls) != 1 || len(custSpy.deltaCalls) != 1 || hospSpy.calls != 1 {
		t.Fatalf("expected 1 deduct, 1 cxc, 1 room checkout on confirm, got deduct=%d cxc=%d hosp=%d",
			len(invSpy.deductCalls), len(custSpy.deltaCalls), hospSpy.calls)
	}
	stAfterConfirm, _ := app.GetPosState(ctx)
	for _, iv := range stAfterConfirm.Invoices {
		if iv.ID == draftRes.Invoice.ID {
			t.Fatalf("expected old draft %s to be replaced upon confirmation", draftRes.Invoice.ID)
		}
	}

	send1, err := app.SendToDian(ctx, domain.DianSendInput{
		DocumentKind: domain.DocKindInvoice,
		DocumentID:   confRes.Invoice.ID,
	})
	if err != nil {
		t.Fatalf("SendToDian Step 1 failed: %v", err)
	}
	if send1.Transmission.DianStage != domain.DianStageEnviada || send1.Transmission.TrackID == "" || send1.Transmission.Attempts != 1 {
		t.Fatalf("unexpected DIAN Step 1 transmission: %+v", send1.Transmission)
	}
	if send1.Invoice == nil || send1.Invoice.Editable {
		t.Fatalf("expected invoice locked (editable=false) while ENVIADA, got %+v", send1.Invoice)
	}

	if _, err := app.UpdateInvoice(ctx, confRes.Invoice.ID, domain.UpdateInvoiceInput{
		CustomerID: "cli-500",
		Items:      []domain.InvoiceItem{{ProductID: "prd-500", ItemType: "PRODUCTO", Quantity: 2}},
	}); !apperr.IsKind(err, apperr.KindValidation) {
		t.Fatalf("expected Validation error editing ENVIADA invoice, got %v", err)
	}

	rejRes, err := app.RespondDian(ctx, domain.DianRespondInput{
		DocumentKind: domain.DocKindInvoice,
		DocumentID:   confRes.Invoice.ID,
		Outcome:      "REJECTED",
	})
	if err != nil {
		t.Fatalf("RespondDian REJECTED failed: %v", err)
	}
	if rejRes.Transmission.DianStage != domain.DianStageRechazada || rejRes.Transmission.RejectionCode != "DIAN-RUT-04" {
		t.Fatalf("unexpected DIAN rejection state: %+v", rejRes.Transmission)
	}
	if rejRes.Invoice == nil || !rejRes.Invoice.Editable || rejRes.Invoice.CUFE != "" {
		t.Fatalf("expected rejected invoice unlocked (editable=true) with empty CUFE, got %+v", rejRes.Invoice)
	}

	fixedRes, err := app.UpdateInvoice(ctx, confRes.Invoice.ID, domain.UpdateInvoiceInput{
		InvoiceType:   domain.InvoiceTypeHoteleria,
		CustomerID:    "cli-500",
		CustomerName:  "Flota Continental S.A.S.",
		CustomerNIT:   "901.555.888-3",
		PaymentMethod: "Crédito / Cartera CxC",
		AmountPaid:    &paid,
		Items: []domain.InvoiceItem{
			{ProductID: "prd-500", ItemType: "PRODUCTO", Quantity: 3},
		},
		Notes: "NIT corregido y cantidad actualizada a 3",
	})
	if err != nil {
		t.Fatalf("UpdateInvoice on RECHAZADA invoice failed: %v", err)
	}
	if fixedRes.Invoice.CustomerNIT != "901.555.888-3" || fixedRes.Invoice.Total != 357000 || fixedRes.Invoice.PendingBalance != 257000 {
		t.Fatalf("unexpected updated confirmed invoice: %+v", fixedRes.Invoice)
	}
	if len(invSpy.restockCalls) != 1 || len(invSpy.deductCalls) != 2 || len(custSpy.deltaCalls) != 2 {
		t.Fatalf("expected stock restock+deduct and cxc diff on confirmed edit, got restock=%d deduct=%d cxc=%d",
			len(invSpy.restockCalls), len(invSpy.deductCalls), len(custSpy.deltaCalls))
	}

	send2, err := app.SendToDian(ctx, domain.DianSendInput{
		DocumentKind: domain.DocKindInvoice,
		DocumentID:   confRes.Invoice.ID,
	})
	if err != nil || send2.Transmission.Attempts != 2 {
		t.Fatalf("expected Attempt #2 on DIAN re-send, got %+v err=%v", send2.Transmission, err)
	}

	accRes, err := app.RespondDian(ctx, domain.DianRespondInput{
		DocumentKind: domain.DocKindInvoice,
		DocumentID:   confRes.Invoice.ID,
		Outcome:      "ACCEPTED",
	})
	if err != nil {
		t.Fatalf("RespondDian ACCEPTED failed: %v", err)
	}
	if len(accRes.Transmission.CUFEOrCUDE) != 96 || accRes.Invoice == nil || accRes.Invoice.Editable || accRes.Invoice.DianStatus != domain.DianStatusAceptada {
		t.Fatalf("expected 96-char CUFE and permanently locked invoice, got tx=%+v inv=%+v", accRes.Transmission, accRes.Invoice)
	}

	if _, err := app.UpdateInvoice(ctx, confRes.Invoice.ID, domain.UpdateInvoiceInput{
		CustomerID: "cli-500",
		Items:      []domain.InvoiceItem{{ProductID: "prd-500", ItemType: "PRODUCTO", Quantity: 3}},
	}); !apperr.IsKind(err, apperr.KindValidation) {
		t.Fatalf("expected Validation error editing ACEPTADA invoice, got %v", err)
	}

	draftNC, err := app.CreateAdjustmentNote(ctx, domain.CreateAdjustmentNoteInput{
		SaveMode:         domain.SaveModeDraft,
		NoteKind:         domain.NoteKindCredit,
		InvoiceID:        confRes.Invoice.ID,
		ReasonCode:       "1",
		RestockInventory: true,
		Items: []domain.InvoiceItem{
			{ProductID: "prd-500", Code: "PRD-500", Description: "Devolución 1 disco", ItemType: "PRODUCTO", Quantity: 1, UnitPrice: 100000, TaxPct: 19},
		},
	})
	if err != nil {
		t.Fatalf("CreateAdjustmentNote DRAFT failed: %v", err)
	}
	if draftNC.DocStatus != domain.DocStatusBorrador || len(invSpy.restockCalls) != 1 {
		t.Fatalf("expected draft NC without restocking yet, got %+v", draftNC)
	}

	confNC, err := app.ConfirmAdjustmentNote(ctx, draftNC.ID)
	if err != nil {
		t.Fatalf("ConfirmAdjustmentNote failed: %v", err)
	}
	if !strings.HasPrefix(confNC.ID, "NC-") || confNC.DocStatus != domain.DocStatusConfirmada || confNC.Total != 119000 {
		t.Fatalf("expected confirmed NC-*, got %+v", confNC)
	}
	if len(invSpy.restockCalls) != 2 || len(custSpy.deltaCalls) != 3 {
		t.Fatalf("expected restock + negative CxC delta on NC confirm, got restock=%d cxc=%d",
			len(invSpy.restockCalls), len(custSpy.deltaCalls))
	}
	if custSpy.deltaCalls[2].DebtDelta != -119000 {
		t.Fatalf("expected negative DebtDelta -119000 from NC, got %+v", custSpy.deltaCalls[2])
	}

	if _, err := app.SendToDian(ctx, domain.DianSendInput{DocumentKind: domain.DocKindCreditNote, DocumentID: confNC.ID}); err != nil {
		t.Fatalf("SendToDian CREDIT_NOTE failed: %v", err)
	}
	ncAcc, err := app.RespondDian(ctx, domain.DianRespondInput{
		DocumentKind: domain.DocKindCreditNote,
		DocumentID:   confNC.ID,
		Outcome:      "ACCEPTED",
	})
	if err != nil || ncAcc.AdjustmentNote == nil || len(ncAcc.AdjustmentNote.CUDE) != 96 {
		t.Fatalf("expected 96-char CUDE on accepted Credit Note, got %+v err=%v", ncAcc, err)
	}

	confND, err := app.CreateAdjustmentNote(ctx, domain.CreateAdjustmentNoteInput{
		SaveMode:   domain.SaveModeConfirm,
		NoteKind:   domain.NoteKindDebit,
		InvoiceID:  confRes.Invoice.ID,
		ReasonCode: "2",
		Items: []domain.InvoiceItem{
			{Code: "FLETE", Description: "Recargo flete urgente", ItemType: "SERVICIO", Quantity: 1, UnitPrice: 40000, TaxPct: 0},
		},
	})
	if err != nil || !strings.HasPrefix(confND.ID, "ND-") {
		t.Fatalf("expected confirmed ND-*, got %+v err=%v", confND, err)
	}
	if len(custSpy.deltaCalls) != 4 || custSpy.deltaCalls[3].DebtDelta != 40000 {
		t.Fatalf("expected positive DebtDelta +40000 from ND, got %+v", custSpy.deltaCalls)
	}

	finalState, err := app.GetPosState(ctx)
	if err != nil {
		t.Fatalf("GetPosState failed: %v", err)
	}
	if len(finalState.AdjustmentNotes) != 2 || len(finalState.DianTransmissions) != 3 {
		t.Fatalf("expected 2 adjustment notes and 3 DIAN transmissions, got notes=%d txs=%d",
			len(finalState.AdjustmentNotes), len(finalState.DianTransmissions))
	}
}

