package tests

import (
	"archive/zip"
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func generateTestTOTP(secret string, at time.Time) string {
	b32 := base32.StdEncoding.WithPadding(base32.NoPadding)
	key, err := b32.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil {
		return "000000"
	}
	counter := uint64(at.Unix() / 30)
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(buf[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	code := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])
	return fmt.Sprintf("%06d", code%1000000)
}

func adminDoJSON(t *testing.T, method, url, token string, body any) (int, map[string]any) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal json: %v", err)
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, rdr)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("http %s %s failed: %v", method, url, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	out := map[string]any{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out)
	}
	return resp.StatusCode, out
}

func TestPlatformStaffRBAC2FAAuditImpersonationAndCSVExport(t *testing.T) {
	cl := startE2ECluster(t)
	root := repoRoot(t)

	adminBin := filepath.Join(t.TempDir(), "ms-admin")
	buildCmd := exec.Command("go", "build", "-o", adminBin, "./cmd/main.go")
	buildCmd.Dir = filepath.Join(root, "services", "ms-admin")
	buildCmd.Env = append(os.Environ(), "GOWORK=off", "CGO_ENABLED=0")
	if out, err := buildCmd.CombinedOutput(); err != nil {
		t.Fatalf("failed to build ms-admin: %v\n%s", err, string(out))
	}

	adminPort := freeTCPPort(t)
	adminURL := fmt.Sprintf("http://127.0.0.1:%d", adminPort)
	adminProc := exec.Command(adminBin)
	adminProc.Dir = t.TempDir()
	adminProc.Env = []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + os.TempDir(),
		"APP_ENV=test",
		"SERVICE_NAME=ms-admin",
		"PORT=" + strconv.Itoa(adminPort),
		"GATEWAY_URL=" + cl.coreURL,
		"SERVICE_PUBLIC_URL=" + adminURL,
		"S2S_SHARED_KEY=" + cl.s2sKey,
		"ALLOWED_ORIGINS=http://localhost:4000",
	}
	if err := adminProc.Start(); err != nil {
		t.Fatalf("failed to start ms-admin: %v", err)
	}
	t.Cleanup(func() {
		if adminProc.Process != nil {
			_ = adminProc.Process.Kill()
			_, _ = adminProc.Process.Wait()
		}
	})
	waitForStatus(t, adminURL+"/health", http.StatusOK)

	// Wait until ms-admin registers with Core Gateway
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		st, _ := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/admin/overview", cl.saToken, nil)
		if st == http.StatusOK {
			break
		}
		time.Sleep(150 * time.Millisecond)
	}

	// 1. Register a real client tenant and verify strict plane isolation (403 on /api/v1/admin/*)
	regStatus, regBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/register", "", map[string]any{
		"companyName":    "Empresa Aislada Admin Test S.A.S.",
		"nit":            "901.777.888-1",
		"adminFullName":  "Admin Cliente",
		"adminUsername":  "admin@aislada.co",
		"password":       "ClaveCliente2026*",
		"businessPreset": "comercio",
	})
	if regStatus != http.StatusCreated {
		t.Fatalf("register tenant expected 201, got %d: %v", regStatus, regBody)
	}
	tenantToken := regBody["token"].(string)
	tenantObj := regBody["tenant"].(map[string]any)
	tenantID := tenantObj["tenantId"].(string)

	// Add 1 real customer in ms-clientes so CSV export has business rows
	cStatus, cBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/clientes/customers", tenantToken, map[string]any{
		"name":  "Cliente Exportable SAS",
		"nit":   "800.123.456-7",
		"email": "export@cliente.co",
		"phone": "3001112233",
	})
	if cStatus != http.StatusCreated && cStatus != http.StatusOK {
		t.Fatalf("create customer expected 200/201, got %d: %v", cStatus, cBody)
	}

	// Tenant token MUST receive 403 Forbidden on /api/v1/admin/overview
	forbStatus, _ := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/admin/overview", tenantToken, nil)
	if forbStatus != http.StatusForbidden {
		t.Fatalf("expected 403 for tenant calling /api/v1/admin/overview, got %d", forbStatus)
	}

	// 2. Login as SuperAdmin (platform plane)
	saStatus, saBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/login", "", map[string]any{
		"username": cl.superAdminEmail,
		"password": cl.superAdminPassword,
	})
	if saStatus != http.StatusOK {
		t.Fatalf("superadmin login expected 200, got %d: %v", saStatus, saBody)
	}
	if saBody["plane"] != "platform" {
		t.Fatalf("expected plane=platform, got %v", saBody["plane"])
	}
	saToken := saBody["token"].(string)

	// 3. Create custom platform role & staff user with TOTP 2FA enabled
	roleStatus, roleBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/staff/roles", saToken, map[string]any{
		"roleKey":           "soporte_custom",
		"displayName":       "Soporte Personalizado",
		"description":       "Soporte solo lectura con motivo obligatorio",
		"requireMfa":        false,
		"requireDataReason": true,
		"permissions":       []string{"empresas.ver", "datos_negocio.ver", "soporte.impersonar_lectura", "datos_negocio.exportar_csv"},
	})
	if roleStatus != http.StatusCreated {
		t.Fatalf("create custom platform role expected 201, got %d: %v", roleStatus, roleBody)
	}

	suStatus, suBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/staff/users", saToken, map[string]any{
		"email":          "soporte.n1@plataforma.local",
		"fullName":       "Soporte N1",
		"password":       "SoporteClave2026*",
		"roleKey":        "soporte_custom",
		"mfaRequired":    false,
		"allowedTenants": []string{"*"},
	})
	if suStatus != http.StatusCreated {
		t.Fatalf("create staff user expected 201, got %d: %v", suStatus, suBody)
	}
	staffUserID := suBody["user"].(map[string]any)["userId"].(string)

	// Activate TOTP 2FA for staff user
	totpStatus, totpBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/staff/users/"+staffUserID+"/totp/setup", saToken, map[string]any{})
	if totpStatus != http.StatusOK {
		t.Fatalf("totp setup expected 200, got %d: %v", totpStatus, totpBody)
	}
	totpSecret := totpBody["totp"].(map[string]any)["secret"].(string)
	if totpSecret == "" {
		t.Fatalf("expected non-empty TOTP secret")
	}

	// Staff login step 1 MUST require TOTP challenge
	sLogin1Status, sLogin1 := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/login", "", map[string]any{
		"username": "soporte.n1@plataforma.local",
		"password": "SoporteClave2026*",
	})
	if sLogin1Status != http.StatusOK || sLogin1["requiresTotp"] != true {
		t.Fatalf("expected requiresTotp=true on step 1, got %d: %v", sLogin1Status, sLogin1)
	}
	challengeTok := sLogin1["challengeToken"].(string)

	// Challenge token MUST NOT be accepted on protected endpoints
	chalReject, _ := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/admin/overview", challengeTok, nil)
	if chalReject != http.StatusUnauthorized {
		t.Fatalf("challenge token must be rejected with 401, got %d", chalReject)
	}

	// Verify TOTP step 2 with valid RFC 6238 code
	validCode := generateTestTOTP(totpSecret, time.Now())
	sLogin2Status, sLogin2 := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/verify-totp", "", map[string]any{
		"challengeToken": challengeTok,
		"code":           validCode,
	})
	if sLogin2Status != http.StatusOK {
		t.Fatalf("verify-totp expected 200, got %d: %v", sLogin2Status, sLogin2)
	}
	soporteToken := sLogin2["token"].(string)

	// 4. Create Auditor user and verify 403 on write mutation
	audStatus, _ := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/staff/users", saToken, map[string]any{
		"email":    "auditor@plataforma.local",
		"fullName": "Auditor Externo",
		"password": "AuditorClave2026*",
		"roleKey":  "auditor",
	})
	if audStatus != http.StatusCreated {
		t.Fatalf("create auditor expected 201, got %d", audStatus)
	}
	_, audLogin := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/login", "", map[string]any{
		"username": "auditor@plataforma.local",
		"password": "AuditorClave2026*",
	})
	audToken := audLogin["token"].(string)

	audWriteStatus, _ := adminDoJSON(t, "PUT", cl.coreURL+"/api/v1/admin/tenants/"+tenantID+"/status", audToken, map[string]any{"status": "SUSPENDED"})
	if audWriteStatus != http.StatusForbidden {
		t.Fatalf("auditor write mutation expected 403, got %d", audWriteStatus)
	}

	// 5. Controlled Support Impersonation (require reason + readonly enforcement)
	noReasonStatus, _ := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/impersonate", soporteToken, map[string]any{
		"tenantId": tenantID,
		"mode":     "readonly",
		"reason":   "",
	})
	if noReasonStatus != http.StatusBadRequest {
		t.Fatalf("impersonation without required reason expected 400, got %d", noReasonStatus)
	}

	impStatus, impBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/core/impersonate", soporteToken, map[string]any{
		"tenantId":        tenantID,
		"mode":            "readonly",
		"reason":          "Ticket #4821 - Revisar cliente",
		"durationMinutes": 15,
	})
	if impStatus != http.StatusOK {
		t.Fatalf("readonly impersonation expected 200, got %d: %v", impStatus, impBody)
	}
	roToken := impBody["token"].(string)

	// GET business data -> 200 OK; POST business data -> 403 Forbidden
	roGetStatus, _ := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/clientes/all", roToken, nil)
	if roGetStatus != http.StatusOK {
		t.Fatalf("readonly impersonation GET expected 200, got %d", roGetStatus)
	}
	roPostStatus, _ := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/clientes/customers", roToken, map[string]any{
		"name":  "No Debe Crearse",
		"docId": "9999999",
	})
	if roPostStatus != http.StatusForbidden {
		t.Fatalf("readonly impersonation POST expected 403, got %d", roPostStatus)
	}

	// 6. Session revocation invalidates active tenant JWT immediately (401)
	revStatus, _ := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/tenants/"+tenantID+"/revoke-sessions", saToken, map[string]any{})
	if revStatus != http.StatusOK {
		t.Fatalf("revoke tenant sessions expected 200, got %d", revStatus)
	}
	afterRevStatus, _ := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/core/bootstrap", tenantToken, nil)
	if afterRevStatus != http.StatusUnauthorized {
		t.Fatalf("revoked tenant JWT expected 401, got %d", afterRevStatus)
	}

	// 7. Commercial catalog visibility override hides ms-hoteleria from public catalog
	ovStatus, _ := adminDoJSON(t, "PUT", cl.coreURL+"/api/v1/admin/catalog/overrides", saToken, map[string]any{
		"services": map[string]any{
			"ms-hoteleria": map[string]any{
				"serviceKey":       "ms-hoteleria",
				"visibleInStore":   false,
				"publiclySellable": false,
			},
		},
		"presets": map[string]any{},
	})
	if ovStatus != http.StatusOK {
		t.Fatalf("catalog overrides expected 200, got %d", ovStatus)
	}
	pubStatus, pubBody := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/core/public-catalog", "", nil)
	if pubStatus != http.StatusOK {
		t.Fatalf("public-catalog expected 200, got %d", pubStatus)
	}
	for _, rawSvc := range pubBody["catalog"].([]any) {
		if rawSvc.(map[string]any)["serviceKey"] == "ms-hoteleria" {
			t.Fatalf("ms-hoteleria should be hidden from public-catalog after override")
		}
	}

	// 8. Excel-compatible ZIP CSV export per client
	expStatus, expBody := adminDoJSON(t, "POST", cl.coreURL+"/api/v1/admin/tenants/"+tenantID+"/exports", soporteToken, map[string]any{
		"reason": "Solicitud formal cliente #901",
	})
	if expStatus != http.StatusCreated {
		t.Fatalf("create CSV export expected 201, got %d: %v", expStatus, expBody)
	}
	dlPath := expBody["downloadUrl"].(string)
	req, _ := http.NewRequest("GET", cl.coreURL+dlPath, nil)
	req.Header.Set("Authorization", "Bearer "+soporteToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("download export zip failed: %v", err)
	}
	zipBytes, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("download zip expected 200, got %d", resp.StatusCode)
	}
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		t.Fatalf("invalid zip returned: %v", err)
	}
	foundSummary := false
	foundCustomers := false
	for _, f := range zr.File {
		rc, _ := f.Open()
		content, _ := io.ReadAll(rc)
		_ = rc.Close()
		if len(content) < 3 || content[0] != 0xEF || content[1] != 0xBB || content[2] != 0xBF {
			t.Fatalf("CSV file %s missing UTF-8 BOM for Excel compatibility", f.Name)
		}
		if !bytes.Contains(content, []byte("Sin registros")) && !bytes.Contains(content, []byte(";")) {
			t.Fatalf("CSV file %s missing semicolon delimiter", f.Name)
		}
		if f.Name == "00_resumen_empresa.csv" {
			foundSummary = true
		}
		if strings.Contains(f.Name, "clientes") && bytes.Contains(content, []byte("Cliente Exportable SAS")) {
			foundCustomers = true
		}
	}
	if !foundSummary || !foundCustomers {
		t.Fatalf("expected summary and exported customer row inside ZIP (summary=%v, customers=%v)", foundSummary, foundCustomers)
	}

	// 9. Verify Audit Log captured actions
	auditStatus, auditBody := adminDoJSON(t, "GET", cl.coreURL+"/api/v1/admin/audit?limit=50", audToken, nil)
	if auditStatus != http.StatusOK {
		t.Fatalf("auditor reading audit log expected 200, got %d", auditStatus)
	}
	logsBytes, _ := json.Marshal(auditBody["logs"])
	logsStr := string(logsBytes)
	for _, expectedAction := range []string{"plataforma.rol_crear", "plataforma.usuario_crear", "plataforma.totp_activar", "usuarios_cliente.revocar_sesiones", "datos_negocio.exportar_csv"} {
		if !strings.Contains(logsStr, expectedAction) {
			t.Fatalf("audit log missing expected action %s", expectedAction)
		}
	}
}
