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

	"ms-taquilla/internal/platform/config"
	"ms-taquilla/internal/platform/money"
	"ms-taquilla/internal/platform/security"
	"ms-taquilla/backend"
	"ms-taquilla/internal/domain"
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

func TestTaquillaCapacityInvariant(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "taquilla-test-seed", false)
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
			DBName:         "db_taquilla_test",
			Username:       "taquillero",
			Role:           "admin",
			Audience:       "ms-taquilla",
			ActiveServices: []string{"ms-taquilla"},
			ActiveModules:  []string{"venta_boletas"},
			Nonce:          money.NewID("jti"),
		}, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set(security.PassportHeader, tok)
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		return req
	}

	// Create event with capacity 5
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/taquilla/events", map[string]any{
		"name":      "Función Privada",
		"zone":      "VIP",
		"basePrice": 50000,
		"capacity":  5,
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create event failed: %d %s", w.Code, w.Body.String())
	}
	var evOut struct {
		Event domain.TicketingEvent `json:"event"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &evOut)

	// Sell 4 tickets -> OK
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/taquilla/tickets", map[string]any{
		"eventId":   evOut.Event.ID,
		"qty":       4,
		"unitPrice": 50000,
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("sell 4 tickets failed: %d %s", w.Code, w.Body.String())
	}

	// Sell 2 more tickets (4 + 2 > 5) -> 409 Conflict with exact message
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/taquilla/tickets", map[string]any{
		"eventId":   evOut.Event.ID,
		"qty":       2,
		"unitPrice": 50000,
	}))
	if w.Code != http.StatusConflict || !strings.Contains(w.Body.String(), "Aforo agotado o insuficiente para la localidad seleccionada") {
		t.Fatalf("expected 409 capacity message, got %d %s", w.Code, w.Body.String())
	}
}
