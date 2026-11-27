package backend_test

import (
	"bytes"
	"crypto/ed25519"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"ms-comandas/backend"
	"ms-comandas/internal/domain"
	"ms-comandas/internal/platform/config"
	"ms-comandas/internal/platform/security"
)

type testEnv struct {
	srv    *backend.Service
	priv   ed25519.PrivateKey
	s2sKey string
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	priv, pub, err := security.LoadCoreKeyPair("", "comandas-test-seed", false)
	if err != nil {
		t.Fatalf("LoadCoreKeyPair failed: %v", err)
	}
	s2sKey := "test-s2s-shared-secret"
	cfg := config.ServiceConfig{
		CommonConfig: config.CommonConfig{
			ServiceName:    "ms-comandas",
			S2SSharedKey:   s2sKey,
			AllowedOrigins: []string{"*"},
		},
	}
	srv := backend.NewService(cfg, pub, security.NewReplayGuard(1024), nil)
	return &testEnv{
		srv:    srv,
		priv:   priv,
		s2sKey: s2sKey,
	}
}

func (e *testEnv) doJSON(t *testing.T, method, path, dbName, scope string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		payload = raw
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(security.S2SKeyHeader, e.s2sKey)

	passport, err := security.SignPassport(e.priv, security.PassportClaims{
		TenantID:         "ten-test",
		DBName:           dbName,
		Username:         "admin",
		Role:             "ADMIN",
		Audience:         "ms-comandas",
		Scope:            scope,
		ActiveServices:   []string{"ms-comandas"},
		ActiveModules:    []string{"mapa_mesas", "monitor_cocina"},
		ActiveSubmodules: []string{"atencion_salon", "despacho_comandas"},
		ActiveFeatures:   []string{"notas_preparacion"},
	}, 30*time.Second)
	if err != nil {
		t.Fatalf("SignPassport: %v", err)
	}
	req.Header.Set(security.PassportHeader, passport)

	rec := httptest.NewRecorder()
	e.srv.Handler().ServeHTTP(rec, req)
	return rec
}

func TestDemoSeedMultiChannelAndRealTenantEmptyStart(t *testing.T) {
	env := newTestEnv(t)

	demoRes := env.doJSON(t, http.MethodGet, "/api/v1/comandas/tables", "db_demo_empresa", "", nil)
	if demoRes.Code != http.StatusOK {
		t.Fatalf("expected 200 for demo state, got %d: %s", demoRes.Code, demoRes.Body.String())
	}
	var demoState struct {
		OK       bool                 `json:"ok"`
		Tables   []domain.DiningTable `json:"tables"`
		Products []domain.MenuItem    `json:"products"`
	}
	if err := json.Unmarshal(demoRes.Body.Bytes(), &demoState); err != nil {
		t.Fatalf("unmarshal demo state: %v", err)
	}

	seenChannels := map[string]bool{}
	seenStages := map[string]bool{}
	for _, tbl := range demoState.Tables {
		seenChannels[tbl.Channel] = true
		seenStages[tbl.OrderStage] = true
	}

	for _, ch := range []string{domain.ChannelMesa, domain.ChannelDomicilio, domain.ChannelParaLlevar} {
		if !seenChannels[ch] {
			t.Fatalf("expected demo seed to contain channel %s, got %+v", ch, seenChannels)
		}
	}
	for _, stg := range []string{domain.StageLibre, domain.StageNueva, domain.StagePreparando, domain.StageLista, domain.StageEntregada} {
		if !seenStages[stg] {
			t.Fatalf("expected demo seed to contain stage %s, got %+v", stg, seenStages)
		}
	}

	realRes := env.doJSON(t, http.MethodGet, "/api/v1/comandas/tables", "db_empresa_real", "", nil)
	if realRes.Code != http.StatusOK {
		t.Fatalf("expected 200 for real tenant state, got %d: %s", realRes.Code, realRes.Body.String())
	}
	var realState struct {
		Tables   []domain.DiningTable `json:"tables"`
		Products []domain.MenuItem    `json:"products"`
	}
	if err := json.Unmarshal(realRes.Body.Bytes(), &realState); err != nil {
		t.Fatalf("unmarshal real state: %v", err)
	}
	if len(realState.Tables) != 0 || len(realState.Products) != 0 {
		t.Fatalf("expected real tenant to start completely empty, got %d tables and %d products", len(realState.Tables), len(realState.Products))
	}
}

func TestMultiChannelOrdersLifecycleAndClearTable(t *testing.T) {
	env := newTestEnv(t)
	dbName := "db_restaurante_norte"

	createMenuRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/menu-items", dbName, "", map[string]any{
		"name":      "Cazuela Artesanal de Mariscos",
		"category":  "Restaurante — Fuertes",
		"salePrice": 46000,
		"taxPct":    8,
	})
	if createMenuRes.Code != http.StatusCreated {
		t.Fatalf("create menu item failed (%d): %s", createMenuRes.Code, createMenuRes.Body.String())
	}

	createTblRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables", dbName, "", map[string]any{
		"name":   "Mesa 10",
		"zone":   "Salón Principal",
		"waiter": "Laura Pineda",
		"guests": 4,
	})
	if createTblRes.Code != http.StatusCreated {
		t.Fatalf("create table failed (%d): %s", createTblRes.Code, createTblRes.Body.String())
	}
	var tblWrap struct {
		Table domain.DiningTable `json:"table"`
	}
	_ = json.Unmarshal(createTblRes.Body.Bytes(), &tblWrap)
	if tblWrap.Table.OrderStage != domain.StageLibre || tblWrap.Table.Status != domain.StatusLibre {
		t.Fatalf("expected new table to start LIBRE/Libre, got %s/%s", tblWrap.Table.OrderStage, tblWrap.Table.Status)
	}

	addItemRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables/"+tblWrap.Table.ID+"/items", dbName, "", map[string]any{
		"productId": "mnu-201",
		"qty":       2,
		"note":      "Sin cilantro",
	})
	if addItemRes.Code != http.StatusOK {
		t.Fatalf("add item failed (%d): %s", addItemRes.Code, addItemRes.Body.String())
	}
	_ = json.Unmarshal(addItemRes.Body.Bytes(), &tblWrap)
	if tblWrap.Table.OrderStage != domain.StageNueva || tblWrap.Table.Status != domain.StatusOcupada || tblWrap.Table.OrderCode != "#0001" {
		t.Fatalf("expected table after item add to be NUEVA/Ocupada/#0001, got %s/%s/%s", tblWrap.Table.OrderStage, tblWrap.Table.Status, tblWrap.Table.OrderCode)
	}

	kitchenRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables/"+tblWrap.Table.ID+"/send-kitchen", dbName, "", map[string]any{})
	if kitchenRes.Code != http.StatusOK {
		t.Fatalf("send-kitchen failed (%d): %s", kitchenRes.Code, kitchenRes.Body.String())
	}
	_ = json.Unmarshal(kitchenRes.Body.Bytes(), &tblWrap)
	if tblWrap.Table.OrderStage != domain.StagePreparando || tblWrap.Table.Status != domain.StatusEnCocina {
		t.Fatalf("expected PREPARANDO/En Cocina, got %s/%s", tblWrap.Table.OrderStage, tblWrap.Table.Status)
	}

	readyRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables/"+tblWrap.Table.ID+"/ready", dbName, "", map[string]any{})
	if readyRes.Code != http.StatusOK {
		t.Fatalf("ready failed (%d): %s", readyRes.Code, readyRes.Body.String())
	}
	_ = json.Unmarshal(readyRes.Body.Bytes(), &tblWrap)
	if tblWrap.Table.OrderStage != domain.StageLista || tblWrap.Table.Status != domain.StatusOcupada {
		t.Fatalf("expected LISTA/Ocupada, got %s/%s", tblWrap.Table.OrderStage, tblWrap.Table.Status)
	}

	deliverTblRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables/"+tblWrap.Table.ID+"/stage", dbName, "", map[string]any{
		"stage": "ENTREGADA",
	})
	if deliverTblRes.Code != http.StatusOK {
		t.Fatalf("stage ENTREGADA failed (%d): %s", deliverTblRes.Code, deliverTblRes.Body.String())
	}
	_ = json.Unmarshal(deliverTblRes.Body.Bytes(), &tblWrap)
	if tblWrap.Table.OrderStage != domain.StageEntregada || tblWrap.Table.Status != domain.StatusOcupada {
		t.Fatalf("expected ENTREGADA/Ocupada, got %s/%s", tblWrap.Table.OrderStage, tblWrap.Table.Status)
	}

	invalidDomRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/orders", dbName, "", map[string]any{
		"channel":      "DOMICILIO",
		"customerName": "Cliente Sin Direccion",
		"items": []map[string]any{
			{"productId": "mnu-201", "qty": 1},
		},
	})
	if invalidDomRes.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when DOMICILIO lacks deliveryAddress, got %d", invalidDomRes.Code)
	}

	domRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/orders", dbName, "", map[string]any{
		"channel":         "DOMICILIO",
		"customerName":    "Mariana Duque",
		"customerPhone":   "301 555 0199",
		"deliveryAddress": "Av. Las Palmas Km 4 Casa 12",
		"paymentHint":     "Efectivo contraentrega",
		"items": []map[string]any{
			{"productId": "mnu-201", "qty": 2, "note": "Empaque sellado"},
		},
	})
	if domRes.Code != http.StatusCreated {
		t.Fatalf("create DOMICILIO order failed (%d): %s", domRes.Code, domRes.Body.String())
	}
	var domWrap struct {
		Table domain.DiningTable `json:"table"`
	}
	_ = json.Unmarshal(domRes.Body.Bytes(), &domWrap)
	if domWrap.Table.Channel != domain.ChannelDomicilio || domWrap.Table.OrderStage != domain.StageNueva || domWrap.Table.OrderCode != "#0002" {
		t.Fatalf("unexpected domicilio ticket: %+v", domWrap.Table)
	}
	if domWrap.Table.Total != 92000 {
		t.Fatalf("expected domicilio total 92000, got %.2f", domWrap.Table.Total)
	}

	for _, step := range []struct {
		stage  string
		status string
	}{
		{domain.StagePreparando, domain.StatusEnCocina},
		{domain.StageLista, domain.StatusOcupada},
		{domain.StageEntregada, domain.StatusOcupada},
	} {
		stRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/tables/"+domWrap.Table.ID+"/stage", dbName, "", map[string]any{
			"stage": step.stage,
		})
		if stRes.Code != http.StatusOK {
			t.Fatalf("stage %s failed (%d): %s", step.stage, stRes.Code, stRes.Body.String())
		}
		_ = json.Unmarshal(stRes.Body.Bytes(), &domWrap)
		if domWrap.Table.OrderStage != step.stage || domWrap.Table.Status != step.status {
			t.Fatalf("expected %s/%s, got %s/%s", step.stage, step.status, domWrap.Table.OrderStage, domWrap.Table.Status)
		}
	}

	clrMesaRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/internal-s2s/clear-table", dbName, security.ScopeS2SInternal, map[string]any{
		"idempotencyKey": "clr-mesa-10",
		"tableId":        tblWrap.Table.ID,
		"invoiceNumber":  "FEVP-1001",
	})
	if clrMesaRes.Code != http.StatusOK {
		t.Fatalf("clear mesa failed (%d): %s", clrMesaRes.Code, clrMesaRes.Body.String())
	}

	clrDomRes := env.doJSON(t, http.MethodPost, "/api/v1/comandas/internal-s2s/clear-table", dbName, security.ScopeS2SInternal, map[string]any{
		"idempotencyKey": "clr-dom-02",
		"tableId":        domWrap.Table.ID,
		"invoiceNumber":  "FEVP-1002",
	})
	if clrDomRes.Code != http.StatusOK {
		t.Fatalf("clear domicilio failed (%d): %s", clrDomRes.Code, clrDomRes.Body.String())
	}

	finalStateRes := env.doJSON(t, http.MethodGet, "/api/v1/comandas/tables", dbName, "", nil)
	var finalState struct {
		Tables []domain.DiningTable `json:"tables"`
	}
	_ = json.Unmarshal(finalStateRes.Body.Bytes(), &finalState)
	if len(finalState.Tables) != 1 {
		t.Fatalf("expected standalone domicilio ticket to be removed after invoicing while physical mesa remains, got %d records", len(finalState.Tables))
	}
	if finalState.Tables[0].ID != tblWrap.Table.ID || finalState.Tables[0].OrderStage != domain.StageLibre || finalState.Tables[0].Status != domain.StatusLibre {
		t.Fatalf("expected physical table to reset to LIBRE/Libre, got %+v", finalState.Tables[0])
	}
}
