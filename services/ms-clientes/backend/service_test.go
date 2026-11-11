package backend_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/json"
	"go/parser"
	"go/token"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ms-clientes/internal/platform/apperr"
	"ms-clientes/internal/platform/authguard"
	"ms-clientes/internal/platform/config"
	"ms-clientes/internal/platform/security"
	"ms-clientes/backend"
	"ms-clientes/internal/application"
	"ms-clientes/internal/domain"
	"ms-clientes/internal/infrastructure/persistence/memory"
)

func TestHexagonalASTPurity(t *testing.T) {
	forbiddenSubstrings := []string{
		"pgx",
		"database/sql",
		"chi",
		"net/http",
		"grpc",
		"ms-clientes/internal/platform/dbpool",
		"ms-clientes/internal/platform/grpcx",
		"ms-clientes/internal/platform/httpx",
	}

	roots := []string{
		filepath.Join("..", "internal", "domain"),
		filepath.Join("..", "internal", "application"),
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

func TestApplicationAndGRPCInvariants(t *testing.T) {
	repo := memory.NewRepository()
	app := application.NewService(repo)

	ctxWithFeatures := authguard.WithContext(context.Background(), authguard.TenantContext{
		TenantID:       "ten-1",
		DBName:         "db_corporativo_01",
		Username:       "admin@empresa.co",
		Role:           "admin",
		ActiveServices: []string{"ms-clientes"},
		ActiveModules:  []string{"directorio_clientes", "cartera_cxc", "contratos_convenios"},
		ActiveFeatures: []string{"cupo_credito_control"},
	})

	terms, err := app.ResolveCommercialTerms(ctxWithFeatures, "cli-101", "")
	if err != nil {
		t.Fatalf("ResolveCommercialTerms failed: %v", err)
	}
	if terms.DiscountPct != 8 || terms.ContractCode != "CNV-201" {
		t.Fatalf("unexpected commercial terms: %+v", terms)
	}

	_, err = app.ApplyReceivableDelta(ctxWithFeatures, domain.ReceivableDeltaInput{
		IdempotencyKey: "idem-over-limit",
		CustomerID:     "cli-101",
		InvoiceID:      "FV-9001",
		InvoiceNumber:  "FV-9001",
		InvoiceTotal:   14000000,
		DebtDelta:      14000000,
	})
	if !apperr.IsKind(err, apperr.KindUnprocessable) || err.Error() != "El saldo supera el cupo de crédito autorizado del cliente" {
		t.Fatalf("expected credit limit unprocessable error, got: %v", err)
	}

	ctxWithoutCreditFeature := authguard.WithContext(context.Background(), authguard.TenantContext{
		TenantID:       "ten-1",
		DBName:         "db_corporativo_01",
		Username:       "admin@empresa.co",
		Role:           "admin",
		ActiveServices: []string{"ms-clientes"},
		ActiveModules:  []string{"directorio_clientes", "cartera_cxc", "contratos_convenios"},
		ActiveFeatures: []string{},
	})
	res, err := app.ApplyReceivableDelta(ctxWithoutCreditFeature, domain.ReceivableDeltaInput{
		IdempotencyKey: "idem-allow-no-feature",
		CustomerID:     "cli-103",
		InvoiceID:      "FV-9002",
		InvoiceNumber:  "FV-9002",
		InvoiceTotal:   9000000,
		DebtDelta:      9000000,
	})
	if err != nil || !res.Ok || res.UpdatedDebt != 9000000 {
		t.Fatalf("expected delta allowed when feature disabled, got res=%+v err=%v", res, err)
	}

	resDup, err := app.ApplyReceivableDelta(ctxWithoutCreditFeature, domain.ReceivableDeltaInput{
		IdempotencyKey: "idem-allow-no-feature",
		CustomerID:     "cli-103",
		InvoiceID:      "FV-9002",
		InvoiceNumber:  "FV-9002",
		InvoiceTotal:   9000000,
		DebtDelta:      9000000,
	})
	if err != nil || resDup.UpdatedDebt != 9000000 {
		t.Fatalf("expected idempotent replay to keep debt at 9000000, got %+v err=%v", resDup, err)
	}

	_, err = app.ApplyReceivableDelta(ctxWithFeatures, domain.ReceivableDeltaInput{
		IdempotencyKey:        "idem-over-ceiling",
		CustomerID:            "cli-101",
		ContractID:            "cnv-201",
		InvoiceID:             "FV-9003",
		InvoiceTotal:          21000000,
		DebtDelta:             0,
		ContractConsumedDelta: 21000000,
	})
	if !apperr.IsKind(err, apperr.KindUnprocessable) || err.Error() != "El consumo supera el tope presupuestal del contrato" {
		t.Fatalf("expected contract ceiling unprocessable error, got: %v", err)
	}

	compRes, err := app.ApplyReceivableDelta(ctxWithFeatures, domain.ReceivableDeltaInput{
		IdempotencyKey: "idem-saga-compensation",
		CustomerID:     "cli-103",
		InvoiceID:      "FV-9002",
		DebtDelta:      -9500000,
	})
	if err != nil || compRes.UpdatedDebt != 0 {
		t.Fatalf("expected saga compensation to clamp debt at 0, got %+v err=%v", compRes, err)
	}

	_, err = app.RegisterAbono(ctxWithFeatures, "FV-1048", domain.RegisterAbonoInput{
		Amount: 950000,
		Method: "Efectivo",
	})
	if !apperr.IsKind(err, apperr.KindConflict) || err.Error() != "El valor del abono excede el saldo pendiente de la factura" {
		t.Fatalf("expected abono conflict error, got: %v", err)
	}

	updatedRec, err := app.RegisterAbono(ctxWithFeatures, "FV-1048", domain.RegisterAbonoInput{
		Amount: 440000,
		Method: "Transferencia Bancaria",
		Note:   "Pago parcial verificado",
	})
	if err != nil {
		t.Fatalf("RegisterAbono failed: %v", err)
	}
	if updatedRec.PendingBalance != 500000 || len(updatedRec.Abonos) != 1 || !strings.HasPrefix(updatedRec.Abonos[0].ID, "ABN-") {
		t.Fatalf("unexpected updated receivable after abono: %+v", updatedRec)
	}
}

func TestHTTPZeroTrustAndEndpoints(t *testing.T) {
	seed := sha256.Sum256([]byte("test_seed_clientes_hexagonal"))
	priv := ed25519.NewKeyFromSeed(seed[:])
	pub := priv.Public().(ed25519.PublicKey)
	s2sKey := "s2s-clientes-secret"
	replay := security.NewReplayGuard(1024)

	cfg := config.ServiceConfig{
		CommonConfig: config.CommonConfig{
			Environment:    "development",
			ServiceName:    "ms-clientes",
			HTTPPort:       4102,
			GRPCPort:       9102,
			S2SSharedKey:   s2sKey,
			AllowedOrigins: []string{"http://localhost:5173"},
		},
	}

	svc := backend.NewService(cfg, pub, replay, nil)
	ts := httptest.NewServer(svc.Handler())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v1/clientes/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on health, got %v err=%v", resp, err)
	}
	_ = resp.Body.Close()

	unauthResp, err := http.Get(ts.URL + "/api/v1/clientes/all")
	if err != nil || unauthResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without passport, got %v err=%v", unauthResp, err)
	}
	_ = unauthResp.Body.Close()

	doSigned := func(method, path string, body any) *http.Response {
		t.Helper()
		passport, signErr := security.SignPassport(priv, security.PassportClaims{
			TenantID:       "ten-http",
			DBName:         "db_empresa_http",
			Username:       "operador@empresa.co",
			Role:           "admin",
			Audience:       "ms-clientes",
			ActiveServices: []string{"ms-clientes"},
			ActiveModules:  []string{"directorio_clientes", "cartera_cxc", "contratos_convenios"},
			ActiveFeatures: []string{"cupo_credito_control"},
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
		res, doErr := http.DefaultClient.Do(req)
		if doErr != nil {
			t.Fatalf("HTTP call failed: %v", doErr)
		}
		return res
	}

	allRes := doSigned(http.MethodGet, "/api/v1/clientes/all", nil)
	if allRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on GET /all, got %d", allRes.StatusCode)
	}
	var allPayload map[string]any
	if err := json.NewDecoder(allRes.Body).Decode(&allPayload); err != nil {
		t.Fatalf("decode /all failed: %v", err)
	}
	_ = allRes.Body.Close()
	for _, key := range []string{"nextCustomerCode", "nextContractCode", "nextTariffCode", "customers", "contracts", "tariffs", "pendingInvoices"} {
		if _, exists := allPayload[key]; !exists {
			t.Fatalf("missing key %q in GET /all response", key)
		}
	}

	trfRes := doSigned(http.MethodPost, "/api/v1/clientes/tariffs", map[string]any{
		"name":        "Tarifa Aliado Estratégico",
		"discountPct": 15,
	})
	if trfRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on POST /tariffs, got %d", trfRes.StatusCode)
	}
	_ = trfRes.Body.Close()

	cntRes := doSigned(http.MethodPost, "/api/v1/clientes/contracts", map[string]any{
		"name":          "Convenio Corporativo Regional",
		"entityNit":     "901.200.300-4",
		"tariffId":      "trf-104",
		"budgetCeiling": 30000000,
	})
	if cntRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on POST /contracts, got %d", cntRes.StatusCode)
	}
	_ = cntRes.Body.Close()

	custRes := doSigned(http.MethodPost, "/customers", map[string]any{
		"name":        "Suministros Industriales S.A.S.",
		"nit":         "901.555.888-2",
		"phone":       "6013004455",
		"email":       "compras@suministros.co",
		"address":     "Zona Industrial Bodega 12",
		"contractId":  "cnv-203",
		"creditLimit": 12000000,
	})
	if custRes.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on POST /customers, got %d", custRes.StatusCode)
	}
	_ = custRes.Body.Close()

	delConflict := doSigned(http.MethodDelete, "/api/v1/clientes/customers/cli-101", nil)
	if delConflict.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 deleting customer with debt, got %d", delConflict.StatusCode)
	}
	_ = delConflict.Body.Close()

	delOk := doSigned(http.MethodDelete, "/api/v1/clientes/customers/cli-103", nil)
	if delOk.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 deleting debt-free customer, got %d", delOk.StatusCode)
	}
	_ = delOk.Body.Close()
}
