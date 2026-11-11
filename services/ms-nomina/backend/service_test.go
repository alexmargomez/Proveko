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

	"ms-nomina/internal/platform/config"
	"ms-nomina/internal/platform/money"
	"ms-nomina/internal/platform/security"
	"ms-nomina/backend"
	"ms-nomina/internal/domain"
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

func TestNominaSalaryAndPeriodInvariants(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "nomina-test-seed", false)
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
			DBName:         "db_nomina_test",
			Username:       "talento",
			Role:           "admin",
			Audience:       "ms-nomina",
			ActiveServices: []string{"ms-nomina"},
			ActiveModules:  []string{"liquidacion_nomina"},
			Nonce:          money.NewID("jti"),
		}, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set(security.PassportHeader, tok)
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		return req
	}

	// Create employee
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/nomina/employees", map[string]any{
		"name":       "Valentina Ospina",
		"docNumber":  "1020999888",
		"position":   "Analista",
		"baseSalary": 2000000,
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create employee failed: %d %s", w.Code, w.Body.String())
	}
	var empOut struct {
		Employee domain.Employee `json:"employee"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &empOut)

	// Deductions exceeding earnings -> 400 Validation
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/nomina/payrolls", map[string]any{
		"employeeId": empOut.Employee.ID,
		"period":     "2026-11-Q1",
		"baseSalary": 1000000,
		"bonuses":    50000,
		"deductions": 1200000,
	}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when deductions > earnings, got %d %s", w.Code, w.Body.String())
	}

	// Valid payroll settlement -> 201
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/nomina/payrolls", map[string]any{
		"employeeId": empOut.Employee.ID,
		"period":     "2026-11-Q1",
		"baseSalary": 1000000,
		"bonuses":    100000,
		"deductions": 80000,
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 payroll, got %d %s", w.Code, w.Body.String())
	}

	// Duplicate settlement in same period -> 409 Conflict
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/nomina/payrolls", map[string]any{
		"employeeId": empOut.Employee.ID,
		"period":     "2026-11-Q1",
		"baseSalary": 1000000,
		"bonuses":    0,
		"deductions": 80000,
	}))
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 duplicate period settlement, got %d %s", w.Code, w.Body.String())
	}
}
