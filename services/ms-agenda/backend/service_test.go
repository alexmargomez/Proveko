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

	"ms-agenda/internal/platform/config"
	"ms-agenda/internal/platform/money"
	"ms-agenda/internal/platform/security"
	"ms-agenda/backend"
	"ms-agenda/internal/domain"
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

func TestAgendaAntiOverlapInvariant(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "agenda-test-seed", false)
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
			DBName:         "db_agenda_test",
			Username:       "recepcion",
			Role:           "admin",
			Audience:       "ms-agenda",
			ActiveServices: []string{"ms-agenda"},
			ActiveModules:  []string{"calendario_citas"},
			Nonce:          money.NewID("jti"),
		}, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set(security.PassportHeader, tok)
		req.Header.Set(security.S2SKeyHeader, s2sKey)
		return req
	}

	// Create resource
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/agenda/resources", map[string]any{
		"name":      "Dr. Alejandro Ríos",
		"specialty": "Valoración Clínica",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create resource failed: %d %s", w.Code, w.Body.String())
	}
	var resOut struct {
		Resource domain.ProfResource `json:"resource"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resOut)

	// Book slot
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/agenda/appointments", map[string]any{
		"resourceId":   resOut.Resource.ID,
		"customerName": "Paciente Uno",
		"dateTime":     "2026-12-15T14:30",
		"serviceName":  "Consulta",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create appointment failed: %d %s", w.Code, w.Body.String())
	}
	var aptOut struct {
		Appointment domain.Appointment `json:"appointment"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &aptOut)

	// Overlapping slot for same resource -> 409 Conflict
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodPost, "/api/v1/agenda/appointments", map[string]any{
		"resourceId":   resOut.Resource.ID,
		"customerName": "Paciente Dos",
		"dateTime":     "2026-12-15 14:30",
		"serviceName":  "Control",
	}))
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict on overlapping appointment, got %d %s", w.Code, w.Body.String())
	}

	// Cancel first appointment -> slot becomes free again
	w = httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, signReq(http.MethodDelete, "/api/v1/agenda/appointments/"+aptOut.Appointment.ID, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 delete appointment, got %d", w.Code)
	}
}
