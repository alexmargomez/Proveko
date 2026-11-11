package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func doHTTPRequest(t *testing.T, baseURL, method, path string, body any, headers map[string]string, cookies ...*http.Cookie) (*http.Response, []byte) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if s, ok := body.(string); ok {
			buf.WriteString(s)
		} else if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
	}
	req, err := http.NewRequest(method, baseURL+path, &buf)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	for _, ck := range cookies {
		req.AddCookie(ck)
	}
	client := &http.Client{
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("http %s %s failed: %v", method, path, err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp, data
}

func TestAuthArgon2idRBACAndPlatformGatewayDelivery(t *testing.T) {
	cl := startE2ECluster(t)

	// 1. Pre-login standardized assets from ms-platform must be delivered cleanly through Gateway
	for _, assetPath := range []string{
		"/api/v1/platform/ui-sdk.js",
		"/api/v1/platform/react-shim.js",
		"/api/v1/platform/react-dom-shim.js",
		"/api/v1/platform/jsx-runtime-shim.js",
		"/api/v1/platform/theme.css",
		"/api/v1/platform/ui-sdk.d.ts",
		"/api/v1/platform/contracts",
	} {
		resp, raw := doHTTPRequest(t, cl.coreURL, http.MethodGet, assetPath, nil, nil)
		if resp.StatusCode != http.StatusOK || len(raw) < 40 {
			t.Fatalf("expected 200 and payload from %s via Gateway, got status=%d len=%d", assetPath, resp.StatusCode, len(raw))
		}
	}

	// Direct unauthenticated call to a microservice port without Gateway Ed25519 passport MUST fail 401
	directResp, _ := doHTTPRequest(t, cl.facturacionURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, nil)
	if directResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("Zero-Trust breach: direct microservice call without Gateway passport returned %d", directResp.StatusCode)
	}

	// Suffix "/health" on a write or non-exact route MUST NOT bypass RequireServicePassport
	suffixBypass, _ := doHTTPRequest(t, cl.facturacionURL, http.MethodPost, "/api/v1/facturacion/invoices/health", map[string]any{}, nil)
	if suffixBypass.StatusCode != http.StatusUnauthorized {
		t.Fatalf("Auth-bypass regression: POST .../invoices/health without passport returned %d instead of 401", suffixBypass.StatusCode)
	}

	// Dynamic Gateway registration must block SSRF (link-local metadata IP) and reserved prefix hijacking with 403 Forbidden
	validRogueModules := []map[string]any{
		{
			"moduleKey":     "rogue_mod",
			"displayName":   "Módulo Rogue",
			"tabIcon":       "Box",
			"defaultActive": true,
			"summary":       "Prueba anti-SSRF",
		},
	}
	ssrfReg, ssrfRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/gateway/register", map[string]any{
		"serviceUrl": "http://169.254.169.254:80",
		"manifest": map[string]any{
			"serviceKey":   "ms-rogue",
			"displayName":  "Rogue Service",
			"icon":         "Shield",
			"apiPrefix":    "/api/v1/rogue",
			"uiBundlePath": "/api/v1/rogue/ui.js",
			"category":     "Seguridad",
			"summary":      "Prueba anti-SSRF",
			"modules":      validRogueModules,
		},
	}, map[string]string{"X-S2S-Key": cl.s2sKey})
	if ssrfReg.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden on SSRF link-local serviceUrl registration, got %d (%s)", ssrfReg.StatusCode, string(ssrfRaw))
	}

	hijackReg, hijackRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/gateway/register", map[string]any{
		"serviceUrl": "http://127.0.0.1:4999",
		"manifest": map[string]any{
			"serviceKey":   "ms-hijack",
			"displayName":  "Hijack Service",
			"icon":         "Shield",
			"apiPrefix":    "/api/v1/auth",
			"uiBundlePath": "/api/v1/auth/ui.js",
			"category":     "Seguridad",
			"summary":      "Prueba anti-secuestro de prefijo",
			"modules":      validRogueModules,
		},
	}, map[string]string{"X-S2S-Key": cl.s2sKey})
	if hijackReg.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when attempting to hijack reserved /api/v1/auth prefix, got %d (%s)", hijackReg.StatusCode, string(hijackRaw))
	}

	// Forged S2S bus call without valid S2S key / passport MUST fail 401
	forgedS2S, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/s2s/ms-inventario/internal-s2s/quote", map[string]any{}, map[string]string{
		"X-S2S-Key": "wrong_key",
	})
	if forgedS2S.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 on unauthorized /api/v1/s2s/* call, got %d", forgedS2S.StatusCode)
	}

	// 2. Unauthenticated requests must be rejected with 401 even with forged X-Tenant-Id
	unauthBootstrap, _ := doHTTPRequest(t, cl.coreURL, http.MethodGet, "/api/v1/bootstrap", nil, map[string]string{
		"X-Tenant-Id": "tenant-empresa-a",
	})
	if unauthBootstrap.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 on unauthenticated /bootstrap, got %d", unauthBootstrap.StatusCode)
	}

	unauthProxy, _ := doHTTPRequest(t, cl.coreURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, map[string]string{
		"X-Tenant-Id": "tenant-empresa-a",
	})
	if unauthProxy.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 on unauthenticated proxy route, got %d", unauthProxy.StatusCode)
	}

	// 3. Oversized HTTP payload (> 1 MiB) -> 413 Request Entity Too Large
	oversized := `{"username":"` + strings.Repeat("A", (1<<20)+2048) + `","password":"x"}`
	overResp, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/login", oversized, nil)
	if overResp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 413 on >1MiB request body, got %d", overResp.StatusCode)
	}

	// 4. Registering with "superadmin" substring in email must NEVER grant superadmin role
	regResp, regRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/register-tenant", map[string]any{
		"companyName":    "Comercial Andina SAS",
		"nit":            "901999888-1",
		"industry":       "Comercio Minorista",
		"adminEmail":     "hacker_superadmin@evil.example.org",
		"password":       "TenantSecurePass2026!",
		"activeServices": []string{"ms-facturacion", "ms-clientes"},
	}, nil)
	if regResp.StatusCode != http.StatusCreated && regResp.StatusCode != http.StatusOK {
		t.Fatalf("register-tenant failed (%d): %s", regResp.StatusCode, string(regRaw))
	}
	var regData struct {
		Token  string `json:"token"`
		Role   string `json:"role"`
		Tenant struct {
			ID               string   `json:"id"`
			ActiveServices   []string `json:"activeServices"`
			ActiveModules    []string `json:"activeModules"`
			ActiveSubmodules []string `json:"activeSubmodules"`
			ActiveFeatures   []string `json:"activeFeatures"`
		} `json:"tenant"`
	}
	if err := json.Unmarshal(regRaw, &regData); err != nil {
		t.Fatalf("unmarshal register response: %v", err)
	}
	if regData.Role != "cliente" {
		t.Fatalf("privilege escalation bug: expected role 'cliente', got %q", regData.Role)
	}
	if len(regData.Tenant.ActiveSubmodules) == 0 {
		t.Fatalf("expected 4-level default activeSubmodules to be populated on tenant registration")
	}

	// 5. Wrong password and unknown user login must fail with 401
	wrongPass, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"username": "hacker_superadmin@evil.example.org",
		"password": "WrongPassword123!",
	}, nil)
	if wrongPass.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 on wrong password, got %d", wrongPass.StatusCode)
	}

	unknownUser, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"username": "nonexistent_user@nowhere.example.org",
		"password": "TenantSecurePass2026!",
	}, nil)
	if unknownUser.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 on unknown user, got %d", unknownUser.StatusCode)
	}

	// 6. Tenant user cannot modify subscriptions, suspend tenants, provision tenants, impersonate, or reach /internal-s2s/* (strict 403)
	tenantHeaders := map[string]string{
		"Authorization": "Bearer " + regData.Token,
	}
	internalS2SAttempt, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/clientes/internal-s2s/receivable-delta", map[string]any{
		"customerId": "cust-1",
		"delta":      -999999,
	}, tenantHeaders)
	if internalS2SAttempt.StatusCode != http.StatusForbidden {
		t.Fatalf("Zero-Trust breach: client JWT calling /internal-s2s/* must return 403 Forbidden, got %d", internalS2SAttempt.StatusCode)
	}

	subAttempt, _ := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/tenants/"+regData.Tenant.ID+"/subscriptions", map[string]any{
		"activeServices":   []string{"ms-facturacion", "ms-nomina"},
		"activeModules":    []string{},
		"activeSubmodules": []string{},
		"activeFeatures":   []string{},
	}, tenantHeaders)
	if subAttempt.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 when tenant tries PUT /subscriptions, got %d", subAttempt.StatusCode)
	}

	statusAttempt, _ := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/core/tenants/"+regData.Tenant.ID+"/status", map[string]any{
		"status": "SUSPENDED",
	}, tenantHeaders)
	if statusAttempt.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 when tenant tries PUT /status, got %d", statusAttempt.StatusCode)
	}

	impAttempt, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/impersonate/tenant-empresa-a", nil, tenantHeaders)
	if impAttempt.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 when tenant tries POST /impersonate, got %d", impAttempt.StatusCode)
	}

	// 7. Tenant /bootstrap must ONLY expose caller's own tenant and ZERO secret hashes/DSNs
	bootResp, bootBytes := doHTTPRequest(t, cl.coreURL, http.MethodGet, "/api/v1/bootstrap", nil, tenantHeaders)
	if bootResp.StatusCode != http.StatusOK {
		t.Fatalf("tenant bootstrap failed (%d): %s", bootResp.StatusCode, string(bootBytes))
	}
	rawBoot := string(bootBytes)
	if strings.Contains(rawBoot, "sealedDsn") || strings.Contains(rawBoot, "passwordHash") {
		t.Fatalf("secret field leaked in /bootstrap payload: %s", rawBoot)
	}
	var bootData struct {
		Tenants []struct {
			ID string `json:"id"`
		} `json:"tenants"`
	}
	if err := json.Unmarshal(bootBytes, &bootData); err != nil {
		t.Fatalf("decode bootstrap: %v", err)
	}
	if len(bootData.Tenants) != 1 || bootData.Tenants[0].ID != regData.Tenant.ID {
		t.Fatalf("cross-tenant leak in /bootstrap: expected only %q, got %+v", regData.Tenant.ID, bootData.Tenants)
	}

	// 8. Superadmin login, tenant provisioning without losing superadmin session, 4-level licensing validation, suspend/reactivate & impersonation
	saLogin, saRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"username": cl.superAdminEmail,
		"password": cl.superAdminPassword,
	}, nil)
	if saLogin.StatusCode != http.StatusOK {
		t.Fatalf("superadmin login failed (%d): %s", saLogin.StatusCode, string(saRaw))
	}
	var sessionCookie *http.Cookie
	for _, ck := range saLogin.Cookies() {
		if ck.Name == "pk_session" {
			sessionCookie = ck
		}
	}
	if sessionCookie == nil || !sessionCookie.HttpOnly || sessionCookie.SameSite != http.SameSiteStrictMode {
		t.Fatalf("expected HttpOnly SameSite=Strict pk_session cookie, got %+v", sessionCookie)
	}

	// SuperAdmin provisions a new enterprise directly via POST /api/v1/core/tenants without overwriting SuperAdmin session
	provResp, provRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/core/tenants", map[string]any{
		"companyName":    "Industrias del Pacífico SAS",
		"nit":            "901777666-5",
		"businessPreset": "Comercio Mayorista",
		"adminUsername":  "gerencia@pacifico.example.org",
		"password":       "PacificoSecure2026!",
		"activeServices": []string{"ms-facturacion", "ms-inventario"},
	}, nil, sessionCookie)
	if provResp.StatusCode != http.StatusCreated {
		t.Fatalf("SuperAdmin POST /api/v1/core/tenants failed (%d): %s", provResp.StatusCode, string(provRaw))
	}
	if len(provResp.Cookies()) > 0 {
		t.Fatalf("POST /api/v1/core/tenants must not overwrite SuperAdmin pk_session cookie, got cookies: %+v", provResp.Cookies())
	}

	// 4-Level licensing enforcement: feature depending on an inactive submodule must fail 400 Bad Request
	bad4Level, bad4Raw := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/core/tenants/"+regData.Tenant.ID+"/subscriptions", map[string]any{
		"activeServices":   []string{"ms-facturacion"},
		"activeModules":    []string{"pos_mostrador"},
		"activeSubmodules": []string{}, // caja_rapida_pos omitted on purpose!
		"activeFeatures":   []string{"descuento_linea"},
	}, nil, sessionCookie)
	if bad4Level.StatusCode != http.StatusBadRequest || !strings.Contains(string(bad4Raw), "caja_rapida_pos") {
		t.Fatalf("expected 400 Bad Request mentioning parent submodule caja_rapida_pos, got %d: %s", bad4Level.StatusCode, string(bad4Raw))
	}

	good4Level, good4Raw := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/core/tenants/"+regData.Tenant.ID+"/subscriptions", map[string]any{
		"activeServices":   []string{"ms-facturacion", "ms-clientes"},
		"activeModules":    []string{"pos_mostrador", "directorio_clientes", "cartera_cxc"},
		"activeSubmodules": []string{"caja_rapida_pos", "ficha_terceros", "recaudo_abonos_cxc"},
		"activeFeatures":   []string{"descuento_linea", "cupo_credito_control"},
	}, nil, sessionCookie)
	if good4Level.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK on valid 4-level subscription hierarchy, got %d: %s", good4Level.StatusCode, string(good4Raw))
	}

	// Suspend tenant -> active JWT operational call, login, and impersonation must all fail 403 Forbidden
	suspendResp, suspendRaw := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/core/tenants/"+regData.Tenant.ID+"/status", map[string]any{
		"status": "SUSPENDED",
	}, nil, sessionCookie)
	if suspendResp.StatusCode != http.StatusOK {
		t.Fatalf("SuperAdmin suspend tenant failed (%d): %s", suspendResp.StatusCode, string(suspendRaw))
	}

	suspendedProxy, _ := doHTTPRequest(t, cl.coreURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, tenantHeaders)
	if suspendedProxy.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when suspended tenant accesses operational API, got %d", suspendedProxy.StatusCode)
	}

	suspendedLogin, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"username": "hacker_superadmin@evil.example.org",
		"password": "TenantSecurePass2026!",
	}, nil)
	if suspendedLogin.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when suspended tenant attempts login, got %d", suspendedLogin.StatusCode)
	}

	suspendedImp, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/impersonate/"+regData.Tenant.ID, nil, nil, sessionCookie)
	if suspendedImp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when attempting to impersonate a SUSPENDED tenant, got %d", suspendedImp.StatusCode)
	}

	// Reactivate tenant -> operational API and SuperAdmin impersonation succeed again
	reactivateResp, reactivateRaw := doHTTPRequest(t, cl.coreURL, http.MethodPut, "/api/v1/core/tenants/"+regData.Tenant.ID+"/status", map[string]any{
		"status": "ACTIVE",
	}, nil, sessionCookie)
	if reactivateResp.StatusCode != http.StatusOK {
		t.Fatalf("SuperAdmin reactivate tenant failed (%d): %s", reactivateResp.StatusCode, string(reactivateRaw))
	}

	restoredProxy, _ := doHTTPRequest(t, cl.coreURL, http.MethodGet, "/api/v1/facturacion/pos-state", nil, tenantHeaders)
	if restoredProxy.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK after reactivating tenant, got %d", restoredProxy.StatusCode)
	}

	saImp, saImpRaw := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/impersonate/"+regData.Tenant.ID, nil, nil, sessionCookie)
	if saImp.StatusCode != http.StatusOK {
		t.Fatalf("superadmin impersonate via cookie failed (%d): %s", saImp.StatusCode, string(saImpRaw))
	}

	logoutResp, _ := doHTTPRequest(t, cl.coreURL, http.MethodPost, "/api/v1/auth/logout", nil, nil, sessionCookie)
	if logoutResp.StatusCode != http.StatusOK {
		t.Fatalf("logout failed (%d)", logoutResp.StatusCode)
	}
}
