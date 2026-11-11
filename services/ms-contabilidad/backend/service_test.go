package backend_test

import (
	"bytes"
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

	"ms-contabilidad/internal/platform/config"
	"ms-contabilidad/internal/platform/money"
	"ms-contabilidad/internal/platform/security"
	"ms-contabilidad/backend"
)

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

func TestContabilidadDoubleEntryInvariants(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "contabilidad-test-seed", false)
	if err != nil {
		t.Fatal(err)
	}
	s2sKey := "test-s2s-secret"
	svc, err := backend.NewService(
		config.ServiceConfig{CommonConfig: config.CommonConfig{S2SSharedKey: s2sKey}},
		pub,
		security.NewReplayGuard(1024),
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	defer svc.Close()

	signReq := func(method, path string, body any) *http.Request {
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, path, &buf)
		tok, err := security.SignPassport(priv, security.PassportClaims{
			TenantID:       "t-1",
			DBName:         "db_contab_test",
			Username:       "contador",
			Role:           "admin",
			Audience:       "ms-contabilidad",
			ActiveServices: []string{"ms-contabilidad"},
			ActiveModules:  []string{"comprobantes_puc"},
			Nonce:          money.NewID("jti"),
		}, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set(security.PassportHeader, tok)
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		return req
	}

	// Duplicate PUC code -> 409 Conflict
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/contabilidad/puc", map[string]any{
		"code":     "110505",
		"name":     "Caja Duplicada",
		"category": "Activo",
	}))
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 duplicate PUC code, got %d %s", w.Code, w.Body.String())
	}

	// Same debit and credit account -> 400 with exact double-entry message
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/contabilidad/vouchers", map[string]any{
		"debitAccountId":  "puc-110505",
		"creditAccountId": "puc-110505",
		"concept":         "Asiento inválido",
		"amount":          250000,
	}))
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "La cuenta débito y la cuenta crédito deben ser distintas para cumplir partida doble") {
		t.Fatalf("expected 400 double-entry message, got %d %s", w.Code, w.Body.String())
	}

	// Valid double-entry voucher -> 201
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/contabilidad/vouchers", map[string]any{
		"debitAccountId":  "puc-513530",
		"creditAccountId": "puc-110505",
		"concept":         "Pago energía eléctrica",
		"amount":          320000,
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 voucher, got %d %s", w.Code, w.Body.String())
	}
}
