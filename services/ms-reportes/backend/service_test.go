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

	"ms-reportes/internal/platform/config"
	"ms-reportes/internal/platform/money"
	"ms-reportes/internal/platform/security"
	"ms-reportes/backend"
	"ms-reportes/internal/domain"
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

func TestReportesSnapshotsAndExecutive(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "reportes-test-seed", false)
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

	signReq := func(method, path string, body any, idemKey string) *http.Request {
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, path, &buf)
		tok, err := security.SignPassport(priv, security.PassportClaims{
			TenantID:       "t-1",
			DBName:         "db_reportes_test",
			Username:       "gerente",
			Role:           "admin",
			Audience:       "ms-reportes",
			ActiveServices: []string{"ms-reportes"},
			ActiveModules:  []string{"centro_reportes"},
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

	// Create snapshot
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/reportes/snapshots", map[string]any{
		"totalSales":              9500000,
		"totalCollected":          8200000,
		"totalPendingReceivables": 1300000,
		"totalExpenses":           2100000,
		"inventoryCostValue":      5400000,
		"inventorySaleValue":      8900000,
		"lowStockCount":           1,
		"customersCount":          7,
		"notes":                   "Cierre mensual",
	}, "idem-rpt-1"))
	if w.Code != http.StatusCreated {
		t.Fatalf("create snapshot failed: %d %s", w.Code, w.Body.String())
	}
	var snapOut struct {
		Snapshot domain.ExecutiveSnapshot `json:"snapshot"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &snapOut)
	if snapOut.Snapshot.NetOperatingProfit != 7400000 {
		t.Fatalf("expected net profit 7400000, got %v", snapOut.Snapshot.NetOperatingProfit)
	}

	// Executive report reflects latest snapshot
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodGet, "/api/v1/reportes/executive", nil, ""))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), snapOut.Snapshot.Code) {
		t.Fatalf("expected 200 executive report containing %s, got %d %s", snapOut.Snapshot.Code, w.Code, w.Body.String())
	}
}
