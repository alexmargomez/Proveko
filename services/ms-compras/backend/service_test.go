package backend_test

import (
	"bytes"
	"context"
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

	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/config"
	"ms-compras/internal/platform/money"
	"ms-compras/internal/platform/security"
	"ms-compras/backend"
	"ms-compras/internal/domain"
)

type fakeInventoryRestock struct {
	calls int
	fail  bool
}

func (f *fakeInventoryRestock) RestockItem(_ context.Context, _ domain.InventoryRestockInput) error {
	f.calls++
	if f.fail {
		return apperr.Upstream("fallo simulado en ms-inventario")
	}
	return nil
}

func TestHexagonalASTPurity(t *testing.T) {
	forbidden := []string{
		"github.com/jackc/pgx/v5",
		"github.com/go-chi/chi/v5",
		"net/http",
		"google.golang.org/grpc",
	}
	for _, dir := range []string{"../internal/domain", "../internal/application"} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			t.Fatalf("read %s: %v", dir, err)
		}
		fset := token.NewFileSet()
		for _, ent := range entries {
			if ent.IsDir() || !strings.HasSuffix(ent.Name(), ".go") {
				continue
			}
			f, err := parser.ParseFile(fset, filepath.Join(dir, ent.Name()), nil, parser.ImportsOnly)
			if err != nil {
				t.Fatalf("parse %s: %v", ent.Name(), err)
			}
			for _, imp := range f.Imports {
				impPath := strings.Trim(imp.Path.Value, `"`)
				for _, bad := range forbidden {
					if impPath == bad || strings.HasPrefix(impPath, bad+"/") {
						t.Fatalf("forbidden import %q in %s/%s", impPath, dir, ent.Name())
					}
				}
			}
		}
	}
}

func TestComprasEndToEndAndInventoryRestock(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "compras-test-seed", false)
	if err != nil {
		t.Fatal(err)
	}
	s2sKey := "test-s2s-secret"
	cfg := config.ServiceConfig{
		CommonConfig: config.CommonConfig{S2SSharedKey: s2sKey},
	}
	invMock := &fakeInventoryRestock{}
	svc, err := backend.NewService(cfg, pub, security.NewReplayGuard(1024), nil, backend.WithInventoryPort(invMock))
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()

	signReq := func(method, path string, body any, idemKey string, services []string) *http.Request {
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, path, &buf)
		tok, err := security.SignPassport(priv, security.PassportClaims{
			TenantID:       "t-1",
			DBName:         "db_compras_test",
			Username:       "comprador",
			Role:           "admin",
			Audience:       "ms-compras",
			ActiveServices: services,
			ActiveModules:  []string{"directorio_proveedores", "ordenes_compra"},
			Nonce:          money.NewID("jti"),
		}, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set(security.PassportHeader, tok)
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		if idemKey != "" {
			req.Header.Set("Idempotency-Key", idemKey)
		}
		return req
	}

	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/compras/health", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 health, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/compras/all", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without passport, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodGet, "/api/v1/compras/ui.js", nil, "", []string{"ms-compras"}))
	if w.Code != http.StatusOK || w.Body.Len() < 100 {
		t.Fatalf("expected non-empty ui.js, code=%d len=%d", w.Code, w.Body.Len())
	}

	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/compras/suppliers", map[string]any{
		"name": "Distribuciones Oriente S.A.S.",
		"nit":  "901555999-1",
	}, "idem-sup-1", []string{"ms-compras"}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create supplier failed: %d %s", w.Code, w.Body.String())
	}
	var supResp struct {
		Supplier domain.Supplier `json:"supplier"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &supResp)

	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/compras/orders", map[string]any{
		"supplierId":  supResp.Supplier.ID,
		"productId":   "prd-101",
		"productName": "Insumo Industrial",
		"warehouseId": "wh-1",
		"qty":         10,
		"unitCost":    25000,
	}, "idem-oc-1", []string{"ms-compras", "ms-inventario"}))
	if w.Code != http.StatusCreated || invMock.calls != 1 {
		t.Fatalf("expected 201 and 1 inventory call, got code=%d calls=%d body=%s", w.Code, invMock.calls, w.Body.String())
	}

	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/compras/orders", map[string]any{
		"supplierId":  supResp.Supplier.ID,
		"productId":   "prd-101",
		"productName": "Insumo Industrial",
		"warehouseId": "wh-1",
		"qty":         10,
		"unitCost":    25000,
	}, "idem-oc-1", []string{"ms-compras", "ms-inventario"}))
	if w.Code != http.StatusCreated || invMock.calls != 1 {
		t.Fatalf("idempotent replay should not call inventory again, code=%d calls=%d", w.Code, invMock.calls)
	}

	var allBefore struct {
		Orders []domain.PurchaseOrder `json:"orders"`
	}
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodGet, "/api/v1/compras/all", nil, "", []string{"ms-compras"}))
	_ = json.Unmarshal(w.Body.Bytes(), &allBefore)

	invMock.fail = true
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/compras/orders", map[string]any{
		"supplierId":  supResp.Supplier.ID,
		"productId":   "prd-101",
		"productName": "Insumo Industrial",
		"qty":         5,
		"unitCost":    25000,
	}, "idem-oc-fail", []string{"ms-compras", "ms-inventario"}))
	if w.Code < 500 {
		t.Fatalf("expected 5xx upstream failure, got %d", w.Code)
	}

	var allAfter struct {
		Orders []domain.PurchaseOrder `json:"orders"`
	}
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodGet, "/api/v1/compras/all", nil, "", []string{"ms-compras"}))
	_ = json.Unmarshal(w.Body.Bytes(), &allAfter)
	if len(allAfter.Orders) != len(allBefore.Orders) {
		t.Fatalf("expected zero phantom orders saved on inventory failure, before=%d after=%d", len(allBefore.Orders), len(allAfter.Orders))
	}
}
