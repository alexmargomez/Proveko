package security_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"ms-core/internal/platform/authguard"
	"ms-core/internal/platform/cryptovault"
	"ms-core/internal/platform/dbpool"
	"ms-core/internal/platform/httpx"
	"ms-core/internal/platform/licensegate"
	"ms-core/internal/platform/money"
	"ms-core/internal/platform/security"
)

func TestEd25519PassportSingleUseAndHopReplayProtection(t *testing.T) {
	priv, pub, err := security.LoadCoreKeyPair("", "unit_test_seed_32_bytes_material", false)
	if err != nil {
		t.Fatalf("LoadCoreKeyPair: %v", err)
	}
	verifierPub, err := security.LoadVerifierPublicKey("", "unit_test_seed_32_bytes_material", false)
	if err != nil || !bytes.Equal(pub, verifierPub) {
		t.Fatalf("LoadVerifierPublicKey mismatch: %v", err)
	}

	if _, _, prodErr := security.LoadCoreKeyPair("", "seed", true); prodErr == nil {
		t.Fatalf("expected error in production without explicit CORE_PRIVATE_KEY")
	}
	if _, prodErr := security.LoadVerifierPublicKey("", "seed", true); prodErr == nil {
		t.Fatalf("expected error in production without explicit CORE_PUBLIC_KEY")
	}

	replay := security.NewReplayGuard(1024)
	token, err := security.SignPassport(priv, security.PassportClaims{
		TenantID:       "tenant-empresa-a",
		DBName:         "db_empresa_a_1a2b3c4d",
		Username:       "admin@empresa.local",
		Role:           "cliente",
		Audience:       "ms-clientes",
		ActiveServices: []string{"ms-clientes", "ms-facturacion"},
	}, 30*time.Second)
	if err != nil {
		t.Fatalf("SignPassport: %v", err)
	}

	if _, audErr := security.VerifyPassport(verifierPub, token, "ms-nomina", replay); audErr == nil {
		t.Fatalf("expected audience mismatch error")
	}
	claims, err := security.VerifyPassport(verifierPub, token, "ms-clientes", replay)
	if err != nil || claims.TenantID != "tenant-empresa-a" {
		t.Fatalf("VerifyPassport valid failed: %v", err)
	}
	if _, repErr := security.VerifyPassport(verifierPub, token, "ms-clientes", replay); repErr == nil {
		t.Fatalf("expected replay rejection on second VerifyPassport call")
	}

	hopReplay := security.NewReplayGuard(1024)
	hop1, _ := security.NewNonceHex()
	if _, hopErr := security.VerifyHopPassport(verifierPub, token, hop1, hopReplay); hopErr != nil {
		t.Fatalf("VerifyHopPassport fresh hop failed: %v", hopErr)
	}
	if _, hopRepErr := security.VerifyHopPassport(verifierPub, token, hop1, hopReplay); hopRepErr == nil {
		t.Fatalf("expected replay error when reusing identical S2S hop nonce")
	}

	if security.VerifyS2SKey("", "") || security.VerifyS2SKey("secret", "") || security.VerifyS2SKey("", "secret") {
		t.Fatalf("VerifyS2SKey must fail closed when any key is empty")
	}

	mw := httpx.RequireServicePassport("ms-clientes", verifierPub, "s2s_secret_123", security.NewReplayGuard(256))
	protected := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc := authguard.FromContext(r.Context())
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenantId": tc.TenantID})
	}))

	freshToken, _ := security.SignPassport(priv, security.PassportClaims{
		TenantID:       "tenant-empresa-a",
		DBName:         "db_empresa_a_1a2b3c4d",
		Username:       "admin@empresa.local",
		Role:           "cliente",
		Audience:       "ms-clientes",
		ActiveServices: []string{"ms-clientes"},
	}, 30*time.Second)

	r1 := httptest.NewRecorder()
	protected.ServeHTTP(r1, httptest.NewRequest(http.MethodGet, "/all", nil))
	if r1.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without S2S headers, got %d", r1.Code)
	}

	reqValid := httptest.NewRequest(http.MethodGet, "/all", nil)
	reqValid.Header.Set(security.S2SKeyHeader, "s2s_secret_123")
	reqValid.Header.Set(security.PassportHeader, freshToken)
	r2 := httptest.NewRecorder()
	protected.ServeHTTP(r2, reqValid)
	if r2.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid S2S passport, got %d", r2.Code)
	}

	r3 := httptest.NewRecorder()
	protected.ServeHTTP(r3, reqValid)
	if r3.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on replayed HTTP passport, got %d", r3.Code)
	}
}

func TestHttpLimitsVaultAndDBSanitization(t *testing.T) {
	oversized := `{"name":"` + strings.Repeat("A", (1<<20)+2048) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/items", strings.NewReader(oversized))
	rec := httptest.NewRecorder()
	var dst struct {
		Name string `json:"name"`
	}
	if err := httpx.Decode(rec, req, &dst); err == nil {
		t.Fatalf("expected error on >1MiB request body")
	} else {
		httpx.RespondError(rec, err)
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("expected 413 on oversized body, got %d", rec.Code)
		}
	}

	sealed, err := cryptovault.SealDSN("kek_secret_alpha", "tenant-1", "postgres://u:p@db:5432/db_t1")
	if err != nil || strings.Contains(sealed, "postgres://") {
		t.Fatalf("SealDSN failed or leaked plaintext: %v", err)
	}
	plain, err := cryptovault.UnsealDSN("kek_secret_alpha", "tenant-1", sealed)
	if err != nil || plain != "postgres://u:p@db:5432/db_t1" {
		t.Fatalf("UnsealDSN failed: %v / %q", err, plain)
	}
	if _, wrongTenantErr := cryptovault.UnsealDSN("kek_secret_alpha", "tenant-2", sealed); wrongTenantErr == nil {
		t.Fatalf("expected AAD mismatch error when unsealing DSN for wrong tenant")
	}

	dbA, errA := dbpool.BuildUniqueTenantDBName("Empresa Rápida S.A.S!", "900111222-1")
	dbB, errB := dbpool.BuildUniqueTenantDBName("Empresa Rápida S.A.S?", "900111222-2")
	if errA != nil || errB != nil || dbA == dbB {
		t.Fatalf("expected distinct valid DB names for distinct NITs, got %q (%v) / %q (%v)", dbA, errA, dbB, errB)
	}
	if _, err := dbpool.SanitizeTenantDBName("db_ok; DROP DATABASE postgres;--"); err == nil {
		t.Fatalf("expected SanitizeTenantDBName to reject SQL injection attempt")
	}

	if wac := money.WeightedAverageCost(10, 1000, 10, 2000); wac != 1500 {
		t.Fatalf("expected WAC 1500, got %v", wac)
	}
	if err := licensegate.ValidateCatalog([]licensegate.ServiceManifest{{
		ServiceKey: "*",
		APIPrefix:  "/api/v1/wild",
	}}); err == nil {
		t.Fatalf("expected ValidateCatalog to reject '*' wildcard serviceKey")
	}
}
