package tests

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

func extractJSONToken(t *testing.T, raw []byte) string {
	t.Helper()
	var out struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.Token == "" {
		t.Fatalf("token missing in response: %v (%s)", err, string(raw))
	}
	return out.Token
}

var demoDatasetMarkers = []string{
	"FEVP-9012",
	"COT-3011",
	"Inversiones Andinas",
	"Distribuidora del Valle",
	"Inversiones del Norte",
	"prd-seed-",
	"Kit Mantenimiento Preventivo",
	"ING-301",
	"EGR-506",
	"BCO-206",
	"Distribuidora Industrial Andina",
	"OC-801",
	"CMP-901",
	"901.482.190-4",
	"RPT-801",
	"Camila Restrepo",
	"Punta de Anca",
	"KLP842",
	"Ricardo Ospina",
	"TRK941",
	"Hernando Quintero",
	"Laura Marcela",
	"Gala Sinf",
	"Comercializadora Andina",
}

var tenantReadEndpoints = []struct {
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

func readTenantEndpoint(t *testing.T, cl *e2eCluster, token, path string) string {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	var lastStatus int
	var lastBody []byte
	for time.Now().Before(deadline) {
		lastStatus, lastBody = clusterCall(t, cl.coreURL, http.MethodGet, path, token, "", nil)
		if lastStatus == http.StatusOK {
			return string(lastBody)
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("GET %s failed with %d: %s", path, lastStatus, string(lastBody))
	return ""
}

func assertNoDemoMarkers(t *testing.T, svc, path, body string) {
	t.Helper()
	for _, marker := range demoDatasetMarkers {
		if strings.Contains(body, marker) {
			t.Fatalf("TENANT ISOLATION BREACH: new company received demo record %q from %s (%s): %s", marker, svc, path, body)
		}
	}
}

func TestNewTenantStartsEmptyAndNeverInheritsDemoDataset(t *testing.T) {
	cl := startE2ECluster(t)

	bootedInLightCluster := map[string]bool{
		"ms-facturacion": true,
		"ms-inventario":  true,
		"ms-clientes":    true,
		"ms-compras":     true,
		"ms-impresiones": true,
	}
	services := make([]string, 0, len(bootedInLightCluster))
	for svc := range bootedInLightCluster {
		services = append(services, svc)
	}
	_, token := registerClusterTenant(t, cl, "Ferretería Nueva Esperanza SAS", "901555666-3", "admin@nuevaesperanza.example.org", services)

	for _, ep := range tenantReadEndpoints {
		if !bootedInLightCluster[ep.svc] {
			continue
		}
		body := readTenantEndpoint(t, cl, token, ep.path)
		assertNoDemoMarkers(t, ep.svc, ep.path, body)
	}

	stDemo, rawDemo := clusterCall(t, cl.coreURL, http.MethodPost, "/api/v1/core/demo-session", "", "", map[string]any{
		"rolePreview": "admin_empresa",
	})
	if stDemo != http.StatusOK {
		t.Fatalf("demo session failed (%d): %s", stDemo, string(rawDemo))
	}
	demoToken := extractJSONToken(t, rawDemo)
	demoInvoices := readTenantEndpoint(t, cl, demoToken, "/api/v1/facturacion/pos-state")
	if !strings.Contains(demoInvoices, "FEVP-9012") {
		t.Fatalf("demo company must keep its showcase dataset, got: %s", demoInvoices)
	}
}
