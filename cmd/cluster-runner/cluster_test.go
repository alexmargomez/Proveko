package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/alexmargomez/proveko/pkg/config"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	cfg := config.Config{
		NodeRole:      "cluster",
		BackendPort:   4000,
		FrontendPort:  5173,
		ClusterSecret: "test-cluster-secret-2026",
		JWTSecret:     "test-jwt-secret-2026",
		AppDomain:     "localhost",
	}
	rt, err := NewClusterRuntime(cfg)
	if err != nil {
		t.Fatalf("NewClusterRuntime error: %v", err)
	}
	return httptest.NewServer(rt.Handler)
}

func doJSON(t *testing.T, srv *httptest.Server, method, path, token, tenantID string, body any) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, srv.URL+path, reader)
	if err != nil {
		t.Fatalf("new request error: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if tenantID != "" {
		req.Header.Set("X-Tenant-Id", tenantID)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("http do error: %v", err)
	}
	defer resp.Body.Close()
	var parsed map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&parsed)
	return resp.StatusCode, parsed
}

func TestFourLevelLicensingHierarchy(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	status, _ := doJSON(t, srv, http.MethodPut, "/api/v1/core/tenants/demo-empresa/subscriptions", "", "", map[string]any{
		"activeServices": []string{"ms-facturacion", "ms-impresiones"},
		"activeModules":  []string{"pos_mostrador"},
		"activeFeatures": []string{"asignar_mecanico"},
	})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400 when activating asignar_mecanico without facturas_taller module, got %d", status)
	}

	status, _ = doJSON(t, srv, http.MethodPut, "/api/v1/core/tenants/demo-empresa/subscriptions", "", "", map[string]any{
		"activeServices": []string{"ms-facturacion", "ms-impresiones"},
		"activeModules":  []string{"pos_mostrador"},
		"activeFeatures": []string{"descuento_linea"},
	})
	if status != http.StatusOK {
		t.Fatalf("expected 200 for valid independent feature subscription, got %d", status)
	}

	status, _ = doJSON(t, srv, http.MethodGet, "/api/v1/bascula/all", "", "demo-empresa", nil)
	if status != http.StatusForbidden {
		t.Fatalf("expected 403 when calling disabled microservice ms-bascula, got %d", status)
	}
}

func TestMultiTenantDatabaseIsolation(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	stA, regA := doJSON(t, srv, http.MethodPost, "/api/v1/core/register", "", "", map[string]any{
		"companyName":   "Ferreteria Alfa SAS",
		"nit":           "900111222-1",
		"adminUsername": "alfa@empresa.co",
	})
	if stA != http.StatusCreated {
		t.Fatalf("register A failed: %d", stA)
	}
	tokA := regA["token"].(string)
	tenA := regA["tenant"].(map[string]any)
	if tenA["dbName"] != "db_ferreteria_alfa_sas" {
		t.Fatalf("unexpected dbName for tenant A: %v", tenA["dbName"])
	}

	stB, regB := doJSON(t, srv, http.MethodPost, "/api/v1/core/register", "", "", map[string]any{
		"companyName":   "Hotel Bravo SAS",
		"nit":           "900333444-2",
		"adminUsername": "bravo@empresa.co",
	})
	if stB != http.StatusCreated {
		t.Fatalf("register B failed: %d", stB)
	}
	tokB := regB["token"].(string)

	stCust, _ := doJSON(t, srv, http.MethodPost, "/api/v1/clientes/customers", tokA, "", map[string]any{
		"docType": "NIT",
		"nit":     "800999888-7",
		"name":    "Constructora Exclusiva De Alfa",
	})
	if stCust != http.StatusCreated {
		t.Fatalf("create customer in A failed: %d", stCust)
	}

	_, listB := doJSON(t, srv, http.MethodGet, "/api/v1/clientes/all", tokB, "", nil)
	rawB, _ := json.Marshal(listB["customers"])
	if strings.Contains(string(rawB), "Constructora Exclusiva De Alfa") {
		t.Fatalf("tenant isolation breach: customer from DB A leaked into DB B")
	}
}

func TestPosInvoiceGrpcOrchestrationAndWorkshopPdf(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	_, posBefore := doJSON(t, srv, http.MethodGet, "/api/v1/facturacion/pos-state", "", "demo-empresa", nil)
	products := posBefore["products"].([]any)
	firstProd := products[0].(map[string]any)
	prodID := firstProd["id"].(string)
	initialStock := firstProd["stock"].(float64)

	vehicles := posBefore["vehicles"].([]any)
	vehID := vehicles[0].(map[string]any)["id"].(string)
	workers := posBefore["workers"].([]any)
	workerID := workers[0].(map[string]any)["id"].(string)

	status, invRes := doJSON(t, srv, http.MethodPost, "/api/v1/facturacion/invoices", "", "demo-empresa", map[string]any{
		"vehicleId":   vehID,
		"mechanicId":  workerID,
		"renderPrint": true,
		"items": []map[string]any{
			{"kind": "PRODUCTO", "refId": prodID, "code": "PRD-1", "name": "Aceite Sintético", "qty": 2, "price": 45000, "taxPct": 19},
			{"kind": "SERVICIO", "refId": "SRV-1", "code": "MO-1", "name": "Sincronización Motor", "qty": 1, "price": 120000, "taxPct": 0},
		},
	})
	if status != http.StatusCreated {
		t.Fatalf("expected 201 creating invoice, got %d: %v", status, invRes)
	}

	invoice := invRes["invoice"].(map[string]any)
	if invoice["layoutVariant"] != "factura_taller" {
		t.Fatalf("expected layoutVariant=factura_taller, got %v", invoice["layoutVariant"])
	}
	printHTML := invRes["printHtml"].(string)
	if !strings.Contains(printHTML, "Placa") || invoice["cufe"] == "" {
		t.Fatalf("expected workshop printable HTML with Placa and DIAN CUFE")
	}

	_, invAfter := doJSON(t, srv, http.MethodGet, "/api/v1/inventario/all", "", "demo-empresa", nil)
	for _, pRaw := range invAfter["products"].([]any) {
		pm := pRaw.(map[string]any)
		if pm["id"].(string) == prodID {
			if pm["stock"].(float64) != initialStock-2 {
				t.Fatalf("expected gRPC stock deduction from %.0f to %.0f, got %.0f", initialStock, initialStock-2, pm["stock"].(float64))
			}
		}
	}

	_, tallerAfter := doJSON(t, srv, http.MethodGet, "/api/v1/taller/all", "", "demo-empresa", nil)
	foundGross := false
	for _, wRaw := range tallerAfter["workers"].([]any) {
		wm := wRaw.(map[string]any)
		if wm["id"].(string) == workerID && wm["totalDayGross"].(float64) >= 120000 {
			foundGross = true
		}
	}
	if !foundGross {
		t.Fatalf("expected gRPC mechanic labor accumulation in ms-taller")
	}
}

func TestHotelCheckoutAndScaleConsecutive(t *testing.T) {
	srv := newTestServer(t)
	defer srv.Close()

	_, roomsBefore := doJSON(t, srv, http.MethodGet, "/api/v1/hoteleria/rooms", "", "demo-empresa", nil)
	var freeRoomID, guestID string
	for _, rRaw := range roomsBefore["rooms"].([]any) {
		rm := rRaw.(map[string]any)
		if rm["status"].(string) == "Disponible" {
			freeRoomID = rm["id"].(string)
			break
		}
	}
	guestID = roomsBefore["customers"].([]any)[0].(map[string]any)["id"].(string)

	stChk, _ := doJSON(t, srv, http.MethodPost, "/api/v1/hoteleria/checkin", "", "demo-empresa", map[string]any{
		"roomId":  freeRoomID,
		"guestId": guestID,
		"nights":  2,
	})
	if stChk != http.StatusCreated && stChk != http.StatusOK {
		t.Fatalf("hotel checkin failed: %d", stChk)
	}

	stInv, _ := doJSON(t, srv, http.MethodPost, "/api/v1/facturacion/invoices", "", "demo-empresa", map[string]any{
		"customerId":   guestID,
		"linkedRoomId": freeRoomID,
		"items": []map[string]any{
			{"kind": "SERVICIO", "code": "ALOJ", "name": "Alojamiento 2 noches", "qty": 2, "price": 180000, "taxPct": 19},
		},
	})
	if stInv != http.StatusCreated {
		t.Fatalf("hotel checkout invoice failed: %d", stInv)
	}

	_, roomsAfter := doJSON(t, srv, http.MethodGet, "/api/v1/hoteleria/rooms", "", "demo-empresa", nil)
	for _, rRaw := range roomsAfter["rooms"].([]any) {
		rm := rRaw.(map[string]any)
		if rm["id"].(string) == freeRoomID && rm["status"].(string) != "Disponible" {
			t.Fatalf("expected room %s to return to Disponible via gRPC checkout, got %s", freeRoomID, rm["status"])
		}
	}

	_, basBefore := doJSON(t, srv, http.MethodGet, "/api/v1/bascula/all", "", "demo-empresa", nil)
	vehID := basBefore["vehicles"].([]any)[0].(map[string]any)["id"].(string)
	drvID := basBefore["drivers"].([]any)[0].(map[string]any)["id"].(string)
	carID := basBefore["carriers"].([]any)[0].(map[string]any)["id"].(string)
	routeID := basBefore["routes"].([]any)[0].(map[string]any)["id"].(string)

	stBas, basCreated := doJSON(t, srv, http.MethodPost, "/api/v1/bascula/tickets", "", "demo-empresa", map[string]any{
		"vehicleId": vehID,
		"driverId":  drvID,
		"carrierId": carID,
		"cargoId":   routeID,
		"grossKg":   42500,
		"tareKg":    14200,
	})
	if stBas != http.StatusCreated {
		t.Fatalf("scale ticket failed: %d", stBas)
	}
	tkt := basCreated["ticket"].(map[string]any)
	if tkt["netKg"].(float64) != 28300 || !strings.HasPrefix(tkt["id"].(string), "BAS-") {
		t.Fatalf("unexpected scale ticket result: %v", tkt)
	}
}
