package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"
)

type safeLogBuf struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (s *safeLogBuf) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.Write(p)
}

func (s *safeLogBuf) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.String()
}

func TestRealPostgresProductionBootAndAll17Services(t *testing.T) {
	pgHost := os.Getenv("TEST_PG_HOST")
	if pgHost == "" {
		t.Skip("skipping real PostgreSQL 16 production cluster verification (TEST_PG_HOST not set)")
	}
	pgPort := os.Getenv("TEST_PG_PORT")
	if pgPort == "" {
		pgPort = "5432"
	}
	pgUser := os.Getenv("TEST_PG_USER")
	if pgUser == "" {
		pgUser = "postgres"
	}
	pgPass := os.Getenv("TEST_PG_PASSWORD")
	if pgPass == "" {
		pgPass = "postgres"
	}

	root := repoRoot(t)
	tmpBins := t.TempDir()

	allServices := []string{
		"ms-platform",
		"ms-agenda",
		"ms-bascula",
		"ms-caja",
		"ms-clientes",
		"ms-comandas",
		"ms-compras",
		"ms-contabilidad",
		"ms-facturacion",
		"ms-hoteleria",
		"ms-impresiones",
		"ms-inventario",
		"ms-nomina",
		"ms-reportes",
		"ms-taller",
		"ms-taquilla",
	}

	buildTarget := func(name, dir string) string {
		out := filepath.Join(tmpBins, name)
		cmd := exec.Command("go", "build", "-o", out, "./cmd/main.go")
		cmd.Dir = dir
		cmd.Env = append(os.Environ(), "GOWORK=off", "CGO_ENABLED=0")
		if raw, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("build %s failed: %v\n%s", name, err, string(raw))
		}
		return out
	}

	coreBin := buildTarget("ms-core", filepath.Join(root, "core"))
	svcBins := make(map[string]string, len(allServices))
	for _, svc := range allServices {
		svcBins[svc] = buildTarget(svc, filepath.Join(root, "services", svc))
	}

	corePort := freeTCPPort(t)
	coreURL := fmt.Sprintf("http://127.0.0.1:%d", corePort)
	s2sKey := "prod_enterprise_s2s_shared_secret_key_2026_verified"
	jwtSecret := "prod_enterprise_jwt_signing_secret_key_2026_verified"
	controlDB := fmt.Sprintf("db_ctrl_%d", time.Now().UnixNano()%1000000)
	databaseURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", pgUser, pgPass, pgHost, pgPort, controlDB)

	logsBySvc := make(map[string]*safeLogBuf)
	startDaemon := func(name, bin string, port int, extraEnv ...string) {
		buf := &safeLogBuf{}
		logsBySvc[name] = buf
		cmd := exec.Command(bin)
		cmd.Dir = t.TempDir()
		env := []string{
			"PATH=" + os.Getenv("PATH"),
			"HOME=" + os.TempDir(),
			"APP_ENV=production",
			"SERVICE_NAME=" + name,
			"PORT=" + strconv.Itoa(port),
			"GATEWAY_URL=" + coreURL,
			"SERVICE_PUBLIC_URL=" + fmt.Sprintf("http://127.0.0.1:%d", port),
			"S2S_SHARED_KEY=" + s2sKey,
			"DATABASE_URL=" + databaseURL,
		}
		cmd.Env = append(env, extraEnv...)
		cmd.Stdout = buf
		cmd.Stderr = buf
		if err := cmd.Start(); err != nil {
			t.Fatalf("start %s failed: %v", name, err)
		}
		t.Cleanup(func() {
			if cmd.Process != nil {
				_ = cmd.Process.Kill()
				_, _ = cmd.Process.Wait()
			}
		})
	}

	waitHealth := func(name, url string, timeout time.Duration) {
		deadline := time.Now().Add(timeout)
		for time.Now().Before(deadline) {
			resp, err := http.Get(url)
			if err == nil {
				_ = resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					return
				}
			}
			time.Sleep(120 * time.Millisecond)
		}
		t.Fatalf("%s failed to become healthy at %s.\nLogs:\n%s", name, url, logsBySvc[name].String())
	}

	// 1. Boot ms-platform and all 15 microservices BEFORE ms-core in APP_ENV=production
	svcPorts := make(map[string]int, len(allServices))
	for _, svc := range allServices {
		p := freeTCPPort(t)
		svcPorts[svc] = p
		startDaemon(svc, svcBins[svc], p)
	}

	for _, svc := range allServices {
		waitHealth(svc, fmt.Sprintf("http://127.0.0.1:%d/health", svcPorts[svc]), 10*time.Second)
	}

	// 2. Boot ms-core in APP_ENV=production against real PostgreSQL (auto-creating controlDB + SeedDemoTenant JSONB)
	platURL := fmt.Sprintf("http://127.0.0.1:%d", svcPorts["ms-platform"])
	startDaemon("ms-core", coreBin, corePort,
		"JWT_SECRET="+jwtSecret,
		"MS_PLATFORM_URL="+platURL,
		"SUPERADMIN_EMAIL=superadmin@plataforma.local",
		"SUPERADMIN_PASSWORD=ProdSuperAdmin2026!",
	)
	waitHealth("ms-core", coreURL+"/api/v1/health", 15*time.Second)

	// 3. Provision a real PostgreSQL tenant with ALL 15 business microservices enabled
	bizServices := allServices[1:]
	regResp, regRaw := doHTTPRequest(t, coreURL, http.MethodPost, "/api/v1/auth/register-tenant", map[string]any{
		"companyName":    "Grupo Empresarial Andino S.A.S.",
		"nit":            "901888777-9",
		"industry":       "Multisectorial",
		"adminEmail":     "gerencia@corporativo-verifica.co",
		"password":       "EnterpriseProdPass2026!",
		"activeServices": bizServices,
	}, nil)
	if regResp.StatusCode != http.StatusCreated && regResp.StatusCode != http.StatusOK {
		t.Fatalf("register-tenant on real PostgreSQL failed (%d): %s\nms-core logs:\n%s", regResp.StatusCode, string(regRaw), logsBySvc["ms-core"].String())
	}
	var regOut struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(regRaw, &regOut); err != nil || regOut.Token == "" {
		t.Fatalf("decode register-tenant token failed: %v (%s)", err, string(regRaw))
	}
	authHeaders := map[string]string{
		"Authorization": "Bearer " + regOut.Token,
	}

	// 4. Verify all 15 microservices migrate, seed, and answer 200 OK over Gateway against real PostgreSQL
	serviceReadEndpoints := []struct {
		svc  string
		path string
	}{
		{"ms-facturacion", "/api/v1/facturacion/pos-state"},
		{"ms-inventario", "/api/v1/inventario/all"},
		{"ms-clientes", "/api/v1/clientes/all"},
		{"ms-compras", "/api/v1/compras/all"},
		{"ms-caja", "/api/v1/caja/summary"},
		{"ms-comandas", "/api/v1/comandas/tables"},
		{"ms-hoteleria", "/api/v1/hoteleria/rooms"},
		{"ms-taller", "/api/v1/taller/all"},
		{"ms-bascula", "/api/v1/bascula/all"},
		{"ms-agenda", "/api/v1/agenda/all"},
		{"ms-contabilidad", "/api/v1/contabilidad/all"},
		{"ms-nomina", "/api/v1/nomina/all"},
		{"ms-taquilla", "/api/v1/taquilla/all"},
		{"ms-reportes", "/api/v1/reportes/all"},
		{"ms-impresiones", "/api/v1/impresiones/branding"},
	}

	for _, ep := range serviceReadEndpoints {
		deadline := time.Now().Add(15 * time.Second)
		var lastStatus int
		var lastBody []byte
		for time.Now().Before(deadline) {
			resp, raw := doHTTPRequest(t, coreURL, http.MethodGet, ep.path, nil, authHeaders)
			lastStatus = resp.StatusCode
			lastBody = raw
			if resp.StatusCode == http.StatusOK {
				break
			}
			time.Sleep(250 * time.Millisecond)
		}
		if lastStatus != http.StatusOK {
			t.Fatalf("real PostgreSQL GET %s (%s) failed with %d: %s\nService logs:\n%s",
				ep.path, ep.svc, lastStatus, string(lastBody), logsBySvc[ep.svc].String())
		}
	}

	// 5. Exercise JSONB INSERT + idempotent JSONB SELECT replay on real PostgreSQL
	for attempt := 1; attempt <= 2; attempt++ {
		idemHeaders := map[string]string{
			"Authorization":   "Bearer " + regOut.Token,
			"Idempotency-Key": "pg16-idem-agenda-res-001",
		}
		resResp, resRaw := doHTTPRequest(t, coreURL, http.MethodPost, "/api/v1/agenda/resources", map[string]any{
			"name":      "Especialista Planta Norte",
			"specialty": "Ingeniería Industrial",
			"phone":     "3105550199",
		}, idemHeaders)
		if resResp.StatusCode != http.StatusCreated && resResp.StatusCode != http.StatusOK {
			t.Fatalf("attempt %d POST /api/v1/agenda/resources with JSONB idempotency failed (%d): %s", attempt, resResp.StatusCode, string(resRaw))
		}
	}

	for attempt := 1; attempt <= 2; attempt++ {
		idemHeaders := map[string]string{
			"Authorization":   "Bearer " + regOut.Token,
			"Idempotency-Key": "pg16-idem-caja-inc-001",
		}
		incResp, incRaw := doHTTPRequest(t, coreURL, http.MethodPost, "/api/v1/caja/incomes", map[string]any{
			"description":   "Recaudo corporativo mostrador",
			"paymentMethod": "Transferencia",
			"amount":        250000,
		}, idemHeaders)
		if incResp.StatusCode != http.StatusCreated && incResp.StatusCode != http.StatusOK {
			t.Fatalf("attempt %d POST /api/v1/caja/incomes with JSONB idempotency failed (%d): %s", attempt, incResp.StatusCode, string(incRaw))
		}
	}

	// 6. Exercise core_control.tenant_users CRUD, per-user RBAC, and immediate deleted-user revocation on real PostgreSQL 16
	empResp, empRaw := doHTTPRequest(t, coreURL, http.MethodPost, "/api/v1/core/company/users", map[string]any{
		"fullName":        "Carlos Cajero PG16",
		"username":        "cajero.pg16@corporativo-verifica.co",
		"password":        "CajaPg16Pass2026!",
		"internalRole":    "cajero",
		"isCompanyAdmin":  false,
		"allowedServices": []string{"ms-facturacion", "ms-clientes"},
		"allowedModules":  []string{"pos_mostrador", "directorio_clientes"},
	}, authHeaders)
	if empResp.StatusCode != http.StatusCreated {
		t.Fatalf("real PostgreSQL POST /company/users failed (%d): %s", empResp.StatusCode, string(empRaw))
	}
	var createdEmp struct {
		User struct {
			UserID string `json:"userId"`
		} `json:"user"`
	}
	if err := json.Unmarshal(empRaw, &createdEmp); err != nil || createdEmp.User.UserID == "" {
		t.Fatalf("decode created PG16 employee: %v (%s)", err, string(empRaw))
	}

	empLogin, empLoginRaw := doHTTPRequest(t, coreURL, http.MethodPost, "/api/v1/core/login", map[string]any{
		"username": "cajero.pg16@corporativo-verifica.co",
		"password": "CajaPg16Pass2026!",
	}, nil)
	if empLogin.StatusCode != http.StatusOK {
		t.Fatalf("real PostgreSQL employee login failed (%d): %s", empLogin.StatusCode, string(empLoginRaw))
	}
	var empAuth struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(empLoginRaw, &empAuth); err != nil || empAuth.Token == "" {
		t.Fatalf("decode PG16 employee token: %v", err)
	}
	empHeaders := map[string]string{"Authorization": "Bearer " + empAuth.Token}

	if r, _ := doHTTPRequest(t, coreURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, empHeaders); r.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for PG16 cashier on assigned ms-facturacion, got %d", r.StatusCode)
	}
	if r, _ := doHTTPRequest(t, coreURL, http.MethodGet, "/api/v1/inventario/all", nil, empHeaders); r.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for PG16 cashier on unassigned ms-inventario, got %d", r.StatusCode)
	}

	if r, raw := doHTTPRequest(t, coreURL, http.MethodDelete, "/api/v1/core/company/users/"+createdEmp.User.UserID, nil, authHeaders); r.StatusCode != http.StatusOK {
		t.Fatalf("real PostgreSQL DELETE /company/users/%s failed (%d): %s", createdEmp.User.UserID, r.StatusCode, string(raw))
	}
	if r, _ := doHTTPRequest(t, coreURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, empHeaders); r.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized after deleting PG16 employee, got %d", r.StatusCode)
	}
}
