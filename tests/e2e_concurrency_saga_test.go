package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

var (
	buildOnce sync.Once
	buildErr  error
	binDir    string
)

func compiledBinaries(t *testing.T) map[string]string {
	t.Helper()
	root := repoRoot(t)
	buildOnce.Do(func() {
		dir, err := os.MkdirTemp("", "platform-e2e-bins-*")
		if err != nil {
			buildErr = err
			return
		}
		binDir = dir
		targets := []struct {
			key string
			dir string
		}{
			{"ms-core", filepath.Join(root, "core")},
			{"ms-platform", filepath.Join(root, "services", "ms-platform")},
			{"ms-impresiones", filepath.Join(root, "services", "ms-impresiones")},
			{"ms-clientes", filepath.Join(root, "services", "ms-clientes")},
			{"ms-inventario", filepath.Join(root, "services", "ms-inventario")},
			{"ms-compras", filepath.Join(root, "services", "ms-compras")},
			{"ms-facturacion", filepath.Join(root, "services", "ms-facturacion")},
		}
		for _, tgt := range targets {
			out := filepath.Join(binDir, tgt.key)
			cmd := exec.Command("go", "build", "-o", out, "./cmd/main.go")
			cmd.Dir = tgt.dir
			cmd.Env = append(os.Environ(), "GOWORK=off", "CGO_ENABLED=0")
			if raw, bErr := cmd.CombinedOutput(); bErr != nil {
				buildErr = fmt.Errorf("build %s failed: %w\n%s", tgt.key, bErr, string(raw))
				return
			}
		}
	})
	if buildErr != nil {
		t.Fatalf("compile standalone E2E binaries: %v", buildErr)
	}
	return map[string]string{
		"ms-core":        filepath.Join(binDir, "ms-core"),
		"ms-platform":    filepath.Join(binDir, "ms-platform"),
		"ms-impresiones": filepath.Join(binDir, "ms-impresiones"),
		"ms-clientes":    filepath.Join(binDir, "ms-clientes"),
		"ms-inventario":  filepath.Join(binDir, "ms-inventario"),
		"ms-compras":     filepath.Join(binDir, "ms-compras"),
		"ms-facturacion": filepath.Join(binDir, "ms-facturacion"),
	}
}

func freeTCPPort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("allocate ephemeral tcp port: %v", err)
	}
	port := l.Addr().(*net.TCPAddr).Port
	_ = l.Close()
	return port
}

type e2eCluster struct {
	coreURL            string
	facturacionURL     string
	s2sKey             string
	saToken            string
	superAdminEmail    string
	superAdminPassword string
}

func startE2ECluster(t *testing.T) *e2eCluster {
	t.Helper()
	bins := compiledBinaries(t)

	s2sKey := "e2e_mesh_s2s_shared_key_2026_strict"
	seed := "e2e_cluster_ed25519_seed_32bytes"
	saEmail := "superadmin@plataforma.local"
	saPass := "ClusterSuperAdmin2026!"

	corePort := freeTCPPort(t)
	platPort := freeTCPPort(t)
	coreURL := fmt.Sprintf("http://127.0.0.1:%d", corePort)
	platURL := fmt.Sprintf("http://127.0.0.1:%d", platPort)

	spawnProc := func(name, binPath string, extraEnv []string) {
		var logBuf bytes.Buffer
		cmd := exec.Command(binPath)
		cmd.Dir = t.TempDir()
		baseEnv := []string{
			"PATH=" + os.Getenv("PATH"),
			"HOME=" + os.TempDir(),
			"APP_ENV=test",
			"S2S_SHARED_KEY=" + s2sKey,
			"ALLOWED_ORIGINS=http://localhost:4000",
		}
		cmd.Env = append(baseEnv, extraEnv...)
		cmd.Stdout = &logBuf
		cmd.Stderr = &logBuf
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

	// 1. Boot Central Gateway (ms-core)
	spawnProc("ms-core", bins["ms-core"], []string{
		"SERVICE_NAME=ms-core",
		"PORT=" + strconv.Itoa(corePort),
		"JWT_SECRET=e2e_cluster_jwt_secret_2026_strict!!",
		"VAULT_KEK=e2e_cluster_vault_kek_2026_strict!!!",
		"CORE_ED25519_SEED=" + seed,
		"SUPERADMIN_EMAIL=" + saEmail,
		"SUPERADMIN_PASSWORD=" + saPass,
		"MS_PLATFORM_URL=" + platURL,
	})
	waitForStatus(t, coreURL+"/api/v1/health", http.StatusOK)

	// 2. Boot ms-platform + independent business microservices wired ONLY via GATEWAY_URL!
	// Notice CORE_PUBLIC_KEY is omitted so every microservice fetches it from GATEWAY_URL/api/v1/gateway/public-key
	// and registers itself dynamically via POST GATEWAY_URL/api/v1/gateway/register!
	spawnProc("ms-platform", bins["ms-platform"], []string{
		"SERVICE_NAME=ms-platform",
		"PORT=" + strconv.Itoa(platPort),
		"GATEWAY_URL=" + coreURL,
		"SERVICE_PUBLIC_URL=" + platURL,
	})
	waitForStatus(t, coreURL+"/api/v1/platform/ui-sdk.js", http.StatusOK)

	svcList := []struct {
		key    string
		prefix string
	}{
		{"ms-impresiones", "/api/v1/impresiones"},
		{"ms-clientes", "/api/v1/clientes"},
		{"ms-inventario", "/api/v1/inventario"},
		{"ms-compras", "/api/v1/compras"},
		{"ms-facturacion", "/api/v1/facturacion"},
	}

	var facURL string
	for _, svc := range svcList {
		p := freeTCPPort(t)
		u := fmt.Sprintf("http://127.0.0.1:%d", p)
		if svc.key == "ms-facturacion" {
			facURL = u
		}
		spawnProc(svc.key, bins[svc.key], []string{
			"SERVICE_NAME=" + svc.key,
			"PORT=" + strconv.Itoa(p),
			"GATEWAY_URL=" + coreURL,
			"SERVICE_PUBLIC_URL=" + u,
		})
		waitForStatus(t, u+"/health", http.StatusOK)
	}

	// Authenticate superadmin and verify all 5 services completed dynamic Gateway registration
	status, raw := clusterCall(t, coreURL, http.MethodPost, "/api/v1/auth/login", "", "", map[string]any{
		"username": saEmail,
		"password": saPass,
	})
	if status != http.StatusOK {
		t.Fatalf("superadmin login failed (%d): %s", status, string(raw))
	}
	var loginOut struct {
		Token string `json:"token"`
	}
	_ = json.Unmarshal(raw, &loginOut)

	// Wait until Gateway routes to every dynamically registered service (status != 502)
	for _, svc := range svcList {
		waitForGatewayUpstreamRegistered(t, coreURL+svc.prefix+"/manifest", loginOut.Token)
	}

	return &e2eCluster{
		coreURL:            coreURL,
		facturacionURL:     facURL,
		s2sKey:             s2sKey,
		saToken:            loginOut.Token,
		superAdminEmail:    saEmail,
		superAdminPassword: saPass,
	}
}

func waitForStatus(t *testing.T, targetURL string, want int) {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(targetURL)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == want {
				return
			}
		}
		time.Sleep(40 * time.Millisecond)
	}
	t.Fatalf("timeout waiting for %s to return HTTP %d", targetURL, want)
}

func waitForGatewayUpstreamRegistered(t *testing.T, gatewayEndpoint, token string) {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		req, _ := http.NewRequest(http.MethodGet, gatewayEndpoint, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode != http.StatusBadGateway {
				return
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("timeout waiting for upstream auto-registration on %s", gatewayEndpoint)
}

func clusterCall(t *testing.T, baseURL, method, path, token, idemKey string, body any) (int, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, baseURL+path, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if idemKey != "" {
		req.Header.Set("Idempotency-Key", idemKey)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("http %s %s failed: %v", method, path, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, data
}

func registerClusterTenant(t *testing.T, cl *e2eCluster, name, nit, email string, services []string) (tenantID, token string) {
	t.Helper()
	st, raw := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/auth/register-tenant", "", "", map[string]any{
		"companyName":    name,
		"nit":            nit,
		"industry":       "Comercio e Industria",
		"adminEmail":     email,
		"password":       "TenantE2EPass2026!",
		"activeServices": services,
	})
	if st != http.StatusCreated && st != http.StatusOK {
		t.Fatalf("register-tenant failed (%d): %s", st, string(raw))
	}
	var out struct {
		Token  string `json:"token"`
		Tenant struct {
			ID string `json:"id"`
		} `json:"tenant"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal tenant registration: %v", err)
	}
	return out.Tenant.ID, out.Token
}

func TestImpresionesXSSAndCSSInjectionSanitization(t *testing.T) {
	cl := startE2ECluster(t)
	_, token := registerClusterTenant(t, cl, "Editorial Segura SAS", "901200300-1", "segura@editorial.example.org", []string{
		"ms-impresiones",
		"ms-facturacion",
	})

	st, raw := clusterCall(t, cl.coreURL, http.MethodPut, "/api/v1/impresiones/branding", token, "idem-brand-1", map[string]any{
		"companyName":   "Editorial <script>alert('brand')</script>",
		"nit":           "901200300-1",
		"primaryColor":  "red;}</style><script>alert('css')</script>",
		"defaultFormat": "carta_membrete",
	})
	if st != http.StatusOK {
		t.Fatalf("PUT /branding failed (%d): %s", st, string(raw))
	}

	stRender, rawRender := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/impresiones/render", token, "idem-render-1", map[string]any{
		"document_type":   "FACTURA DE VENTA",
		"document_number": "FEVP-9999",
		"customer_name":   "<script>alert('xss')</script>",
		"notes":           "<img src=x onerror=alert(1)>",
		"grand_total":     125000,
		"items": []map[string]any{
			{"code": "PRD-1", "description": "<b>Item</b><script>bad()</script>", "quantity": 1, "unit_price": 125000, "subtotal": 125000},
		},
	})
	if stRender != http.StatusOK {
		t.Fatalf("POST /render failed (%d): %s", stRender, string(rawRender))
	}
	var renderOut struct {
		HTMLPrintable string `json:"html_printable"`
	}
	if err := json.Unmarshal(rawRender, &renderOut); err != nil || renderOut.HTMLPrintable == "" {
		t.Fatalf("decode render response failed: %v", err)
	}
	if strings.Contains(renderOut.HTMLPrintable, "<script>alert(") || strings.Contains(renderOut.HTMLPrintable, "<img src=x onerror=") {
		t.Fatalf("XSS vulnerability: unescaped HTML payload found in rendered output:\n%s", renderOut.HTMLPrintable)
	}
	if !strings.Contains(renderOut.HTMLPrintable, "#023047") {
		t.Fatalf("CSS injection defense failed: invalid primaryColor did not fall back to #023047")
	}
}

func TestDynamicMicroFrontendBundleServingAndLicenseEnforcement(t *testing.T) {
	cl := startE2ECluster(t)
	_, token := registerClusterTenant(t, cl, "Distribuidora MFE SAS", "901444555-9", "mfe@distribuidora.example.org", []string{
		"ms-facturacion",
	})

	stJS, rawJS := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/facturacion/ui.js", token, "", nil)
	if stJS != http.StatusOK || len(rawJS) < 200 || !strings.Contains(string(rawJS), "@platform/ui-sdk") {
		t.Fatalf("expected 200 and externalized @platform/ui-sdk ESM bundle from /api/v1/facturacion/ui.js, got status=%d len=%d", stJS, len(rawJS))
	}

	stForbidden, _ := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/compras/all", token, "", nil)
	if stForbidden != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for unsubscribed service ms-compras, got %d", stForbidden)
	}
}

func TestConcurrencyRace50GoroutinesZeroOversellingOverGatewayS2S(t *testing.T) {
	cl := startE2ECluster(t)
	_, token := registerClusterTenant(t, cl, "Ferretería Concurrencia SAS", "901777888-3", "ops@ferreteria.example.org", []string{
		"ms-facturacion",
		"ms-inventario",
		"ms-clientes",
	})

	stProd, rawProd := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/inventario/products", token, "idem-seed-prod", map[string]any{
		"name":      "Taladro Percutor Industrial",
		"category":  "Herramientas",
		"costPrice": 180000,
		"salePrice": 250000,
		"taxPct":    19,
		"stock":     10,
		"minStock":  2,
	})
	if stProd != http.StatusCreated && stProd != http.StatusOK {
		t.Fatalf("create product failed (%d): %s", stProd, string(rawProd))
	}
	var prodResp struct {
		Product struct {
			ID string `json:"id"`
		} `json:"product"`
	}
	if err := json.Unmarshal(rawProd, &prodResp); err != nil || prodResp.Product.ID == "" {
		t.Fatalf("invalid create product response: %s", string(rawProd))
	}
	productID := prodResp.Product.ID

	const workers = 50
	var createdCount atomic.Int32
	var conflictCount atomic.Int32
	var otherStatus atomic.Int32

	var wg sync.WaitGroup
	startGate := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-startGate
			idem := fmt.Sprintf("race-pos-buy-%03d", idx)
			code, _ := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/facturacion/invoices", token, idem, map[string]any{
				"customerName":  "Comprador Mostrador",
				"paymentMethod": "Efectivo",
				"amountPaid":    350000,
				"items": []map[string]any{
					{
						"productId":   productID,
						"description": "Taladro Percutor Industrial",
						"itemType":    "PRODUCTO",
						"quantity":    1,
						"unitPrice":   250000,
						"taxPct":      19,
					},
				},
			})
			switch code {
			case http.StatusCreated, http.StatusOK:
				createdCount.Add(1)
			case http.StatusConflict:
				conflictCount.Add(1)
			default:
				otherStatus.Add(1)
			}
		}(i)
	}
	close(startGate)
	wg.Wait()

	if createdCount.Load() != 10 || conflictCount.Load() != 40 || otherStatus.Load() != 0 {
		t.Fatalf("concurrency invariant violated: expected 10 created & 40 conflicts, got created=%d conflict=%d other=%d",
			createdCount.Load(), conflictCount.Load(), otherStatus.Load())
	}

	stInv, rawInv := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/inventario/all", token, "", nil)
	if stInv != http.StatusOK {
		t.Fatalf("GET /inventario/all failed (%d)", stInv)
	}
	var invState struct {
		Products []struct {
			ID    string  `json:"id"`
			Stock float64 `json:"stock"`
		} `json:"products"`
	}
	_ = json.Unmarshal(rawInv, &invState)
	found := false
	for _, p := range invState.Products {
		if p.ID == productID {
			found = true
			if p.Stock != 0 {
				t.Fatalf("expected final stock == 0 after race test, got %v", p.Stock)
			}
		}
	}
	if !found {
		t.Fatalf("created product %s missing from inventory state", productID)
	}
}

func TestIdempotencyPriceAuthoritySagaCompensationAndWACOverGateway(t *testing.T) {
	cl := startE2ECluster(t)
	tenantID, token := registerClusterTenant(t, cl, "Autopartes Saga SAS", "901666777-5", "finanzas@autopartes.example.org", []string{
		"ms-facturacion",
		"ms-inventario",
		"ms-clientes",
		"ms-compras",
	})

	stSub, rawSub := clusterCall(t, cl.coreURL, http.MethodPut, "/api/v1/tenants/"+tenantID+"/subscriptions", cl.saToken, "", map[string]any{
		"activeServices": []string{"ms-facturacion", "ms-inventario", "ms-clientes", "ms-compras"},
		"activeModules":  []string{"pos_mostrador", "productos_stock", "directorio_clientes", "cartera_cxc", "directorio_proveedores", "ordenes_compra"},
		"activeFeatures": []string{"pagos_mixtos_cxc", "cupo_credito_control"},
	})
	if stSub != http.StatusOK {
		t.Fatalf("update subscriptions failed (%d): %s", stSub, string(rawSub))
	}

	stP, rawP := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/inventario/products", token, "idem-saga-prod", map[string]any{
		"name":      "Batería Sellada 12V",
		"category":  "Eléctricos",
		"costPrice": 40000,
		"salePrice": 80000,
		"taxPct":    0,
		"stock":     20,
		"minStock":  3,
	})
	if stP != http.StatusCreated && stP != http.StatusOK {
		t.Fatalf("seed product failed (%d): %s", stP, string(rawP))
	}
	var prodOut struct {
		Product struct {
			ID string `json:"id"`
		} `json:"product"`
	}
	_ = json.Unmarshal(rawP, &prodOut)
	prodID := prodOut.Product.ID

	invoicePayload := map[string]any{
		"customerName":  "Cliente Contado",
		"paymentMethod": "Efectivo",
		"amountPaid":    160000,
		"items": []map[string]any{
			{
				"productId":   prodID,
				"description": "Batería Sellada 12V",
				"itemType":    "PRODUCTO",
				"quantity":    2,
				"unitPrice":   1,
				"taxPct":      0,
			},
		},
	}
	stInv1, rawInv1 := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/facturacion/invoices", token, "idem-fixed-key-01", invoicePayload)
	if stInv1 != http.StatusCreated && stInv1 != http.StatusOK {
		t.Fatalf("first invoice failed (%d): %s", stInv1, string(rawInv1))
	}
	var inv1 struct {
		Invoice struct {
			ID     string  `json:"id"`
			Number string  `json:"number"`
			Total  float64 `json:"total"`
		} `json:"invoice"`
	}
	_ = json.Unmarshal(rawInv1, &inv1)
	if inv1.Invoice.Total != 160000 {
		t.Fatalf("price authority violation: expected server total 160000, got %v", inv1.Invoice.Total)
	}

	stInv2, rawInv2 := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/facturacion/invoices", token, "idem-fixed-key-01", invoicePayload)
	if stInv2 != http.StatusCreated && stInv2 != http.StatusOK {
		t.Fatalf("idempotent replay failed (%d): %s", stInv2, string(rawInv2))
	}
	var inv2 struct {
		Invoice struct {
			Number string `json:"number"`
		} `json:"invoice"`
	}
	_ = json.Unmarshal(rawInv2, &inv2)
	if inv2.Invoice.Number != inv1.Invoice.Number {
		t.Fatalf("idempotency violation: expected same invoice number %q, got %q", inv1.Invoice.Number, inv2.Invoice.Number)
	}

	assertStockAndCost := func(expectedStock, expectedCost float64) {
		t.Helper()
		_, rawAll := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/inventario/all", token, "", nil)
		var st struct {
			Products []struct {
				ID        string  `json:"id"`
				Stock     float64 `json:"stock"`
				CostPrice float64 `json:"costPrice"`
			} `json:"products"`
		}
		_ = json.Unmarshal(rawAll, &st)
		for _, p := range st.Products {
			if p.ID == prodID {
				if p.Stock != expectedStock {
					t.Fatalf("expected stock=%v, got %v", expectedStock, p.Stock)
				}
				if expectedCost > 0 && p.CostPrice != expectedCost {
					t.Fatalf("expected costPrice=%v, got %v", expectedCost, p.CostPrice)
				}
				return
			}
		}
		t.Fatalf("product %s not found", prodID)
	}
	assertStockAndCost(18, 40000)

	stCust, rawCust := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/clientes/customers", token, "idem-cust-1", map[string]any{
		"name":        "Transportes Crédito Limitado SAS",
		"nit":         "900555111-2",
		"creditLimit": 100000,
	})
	if stCust != http.StatusCreated && stCust != http.StatusOK {
		t.Fatalf("create customer failed (%d): %s", stCust, string(rawCust))
	}
	var custOut struct {
		Customer struct {
			ID string `json:"id"`
		} `json:"customer"`
	}
	_ = json.Unmarshal(rawCust, &custOut)

	stOverCredit, rawOverCredit := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/facturacion/invoices", token, "idem-saga-fail-credit", map[string]any{
		"customerId":    custOut.Customer.ID,
		"paymentMethod": "Crédito",
		"amountPaid":    0,
		"items": []map[string]any{
			{
				"productId":   prodID,
				"description": "Batería Sellada 12V",
				"itemType":    "PRODUCTO",
				"quantity":    3,
				"unitPrice":   80000,
				"taxPct":      0,
			},
		},
	})
	if stOverCredit != http.StatusUnprocessableEntity && stOverCredit != http.StatusConflict {
		t.Fatalf("expected 422/409 when exceeding customer credit limit, got %d: %s", stOverCredit, string(rawOverCredit))
	}

	assertStockAndCost(18, 40000)

	stSup, rawSup := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/compras/suppliers", token, "idem-sup-1", map[string]any{
		"name": "Importadora Mayorista SAS",
		"nit":  "800111999-4",
	})
	if stSup != http.StatusCreated && stSup != http.StatusOK {
		t.Fatalf("create supplier failed (%d): %s", stSup, string(rawSup))
	}
	var supOut struct {
		Supplier struct {
			ID string `json:"id"`
		} `json:"supplier"`
	}
	_ = json.Unmarshal(rawSup, &supOut)

	stOC, rawOC := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/compras/orders", token, "idem-oc-1", map[string]any{
		"supplierId": supOut.Supplier.ID,
		"productId":  prodID,
		"qty":        18,
		"unitCost":   60000,
	})
	if stOC != http.StatusCreated && stOC != http.StatusOK {
		t.Fatalf("create purchase order failed (%d): %s", stOC, string(rawOC))
	}

	assertStockAndCost(36, 50000)
}

func TestMultiTenantDatabaseIsolation(t *testing.T) {
	cl := startE2ECluster(t)
	_, tokenA := registerClusterTenant(t, cl, "Clínica Norte SAS", "901000111-1", "admin@norte.example.org", []string{"ms-clientes"})
	_, tokenB := registerClusterTenant(t, cl, "Clínica Sur SAS", "901000222-2", "admin@sur.example.org", []string{"ms-clientes"})

	stCreate, rawCreate := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/clientes/customers", tokenA, "idem-iso-a", map[string]any{
		"name": "Paciente Exclusivo Norte",
		"nit":  "1020304050",
	})
	if stCreate != http.StatusCreated && stCreate != http.StatusOK {
		t.Fatalf("tenant A create customer failed (%d): %s", stCreate, string(rawCreate))
	}

	stListB, rawListB := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/clientes/all", tokenB, "", nil)
	if stListB != http.StatusOK {
		t.Fatalf("tenant B list customers failed (%d)", stListB)
	}
	if strings.Contains(string(rawListB), "Paciente Exclusivo Norte") {
		t.Fatalf("CRITICAL TENANT ISOLATION BREACH: Tenant B saw Tenant A's customer!")
	}
}

func TestConcurrentSameIdempotencyKeyAndPartialWarehouseTransfer(t *testing.T) {
	cl := startE2ECluster(t)
	_, token := registerClusterTenant(t, cl, "Logística Exacta SAS", "901333444-8", "ops@logisticaexacta.example.org", []string{
		"ms-facturacion",
		"ms-inventario",
	})

	stP, rawP := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/inventario/products", token, "idem-seed-idemrace", map[string]any{
		"name":        "Compresor Neumático 2HP",
		"category":    "Maquinaria",
		"warehouseId": "wh-principal",
		"costPrice":   300000,
		"salePrice":   500000,
		"taxPct":      0,
		"stock":       20,
		"minStock":    2,
	})
	if stP != http.StatusCreated && stP != http.StatusOK {
		t.Fatalf("seed product failed (%d): %s", stP, string(rawP))
	}
	var prodOut struct {
		Product struct {
			ID   string `json:"id"`
			Code string `json:"code"`
		} `json:"product"`
	}
	_ = json.Unmarshal(rawP, &prodOut)
	prodID := prodOut.Product.ID
	prodCode := prodOut.Product.Code

	// 1. 20 concurrent goroutines firing simultaneously with the EXACT SAME Idempotency-Key
	const parallelCallers = 20
	results := make([]string, parallelCallers)
	statuses := make([]int, parallelCallers)
	var wg sync.WaitGroup
	gate := make(chan struct{})
	for i := 0; i < parallelCallers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-gate
			st, raw := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/facturacion/invoices", token, "same-idem-key-burst-20", map[string]any{
				"customerName":  "Cliente Concurrente Idempotente",
				"paymentMethod": "Efectivo",
				"amountPaid":    1000000,
				"items": []map[string]any{
					{
						"productId":   prodID,
						"description": "Compresor Neumático 2HP",
						"itemType":    "PRODUCTO",
						"quantity":    2,
						"unitPrice":   500000,
						"taxPct":      0,
					},
				},
			})
			statuses[idx] = st
			var resp struct {
				Invoice struct {
					Number string `json:"number"`
				} `json:"invoice"`
			}
			_ = json.Unmarshal(raw, &resp)
			results[idx] = resp.Invoice.Number
		}(i)
	}
	close(gate)
	wg.Wait()

	expectedNum := results[0]
	if expectedNum == "" {
		t.Fatalf("expected valid invoice number on concurrent idempotent call, got empty (status=%d)", statuses[0])
	}
	for i := 0; i < parallelCallers; i++ {
		if statuses[i] != http.StatusCreated && statuses[i] != http.StatusOK {
			t.Fatalf("worker %d returned unexpected HTTP %d", i, statuses[i])
		}
		if results[i] != expectedNum {
			t.Fatalf("concurrent idempotency race: worker %d got invoice %q instead of %q", i, results[i], expectedNum)
		}
	}

	// Verify stock was deducted ONLY ONCE (20 - 2 = 18)
	_, rawAfterRace := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/inventario/all", token, "", nil)
	var invAfterRace struct {
		Products []struct {
			ID          string  `json:"id"`
			Code        string  `json:"code"`
			WarehouseID string  `json:"warehouseId"`
			Stock       float64 `json:"stock"`
		} `json:"products"`
	}
	_ = json.Unmarshal(rawAfterRace, &invAfterRace)
	for _, p := range invAfterRace.Products {
		if p.ID == prodID && p.Stock != 18 {
			t.Fatalf("concurrent same-idem-key double-deducted stock: expected 18, got %v", p.Stock)
		}
	}

	// 2. Partial warehouse transfer: move 7 of 18 units from wh-principal to wh-auxiliar -> 11 in wh-principal & 7 in wh-auxiliar
	stTr, rawTr := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/inventario/products/"+prodID+"/transfer", token, "idem-partial-transfer-7", map[string]any{
		"targetWarehouseId": "wh-auxiliar",
		"qty":               7,
		"note":              "Abastecimiento parcial sala de ventas",
	})
	if stTr != http.StatusOK {
		t.Fatalf("partial warehouse transfer failed (%d): %s", stTr, string(rawTr))
	}

	_, rawAfterTransfer := clusterCall(t, cl.coreURL, http.MethodGet, "/api/v1/inventario/all", token, "", nil)
	var invAfterTransfer struct {
		Products []struct {
			ID          string  `json:"id"`
			Code        string  `json:"code"`
			WarehouseID string  `json:"warehouseId"`
			Stock       float64 `json:"stock"`
		} `json:"products"`
	}
	_ = json.Unmarshal(rawAfterTransfer, &invAfterTransfer)

	var originStock, destStock float64
	var foundOrigin, foundDest bool
	for _, p := range invAfterTransfer.Products {
		if p.Code == prodCode && p.WarehouseID == "wh-principal" {
			foundOrigin = true
			originStock = p.Stock
		}
		if p.Code == prodCode && p.WarehouseID == "wh-auxiliar" {
			foundDest = true
			destStock = p.Stock
		}
	}
	if !foundOrigin || !foundDest || originStock != 11 || destStock != 7 {
		t.Fatalf("partial warehouse transfer corrupted stock: foundOrigin=%v (stock=%v, want 11), foundDest=%v (stock=%v, want 7)",
			foundOrigin, originStock, foundDest, destStock)
	}
}

