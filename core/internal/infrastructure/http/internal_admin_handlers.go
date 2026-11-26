package httpadapter

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"ms-core/internal/application"
	"ms-core/internal/domain"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/authguard"
	"ms-core/internal/platform/httpx"
	"ms-core/internal/platform/security"
)

func (g *GatewayServer) handleVerifyTOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ChallengeToken string `json:"challengeToken"`
		Code           string `json:"code"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	rawTok := strings.TrimSpace(body.ChallengeToken)
	if rawTok == "" {
		authHdr := strings.TrimSpace(r.Header.Get("Authorization"))
		if strings.HasPrefix(authHdr, "Bearer ") {
			rawTok = strings.TrimSpace(strings.TrimPrefix(authHdr, "Bearer "))
		}
	}
	if rawTok == "" {
		httpx.Error(w, http.StatusUnauthorized, "Token de desafío 2FA requerido")
		return
	}
	tc, err := authguard.VerifyJWT(g.cfg.JWTSecret, rawTok)
	if err != nil || tc.ChallengePurpose != "platform_totp_verify" || strings.TrimSpace(tc.UserID) == "" {
		httpx.Error(w, http.StatusUnauthorized, "Desafío 2FA inválido o expirado")
		return
	}
	out, err := g.svc.VerifyPlatformTOTP(r.Context(), tc.UserID, body.Code)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible emitir la sesión")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                  true,
		"plane":               out.Plane,
		"token":               tok,
		"role":                out.Role,
		"internalRole":        out.InternalRole,
		"platformRole":        out.PlatformRole,
		"platformPermissions": out.PlatformPermissions,
		"allowedTenants":      out.AllowedTenants,
		"requireDataReason":   out.RequireDataReason,
		"username":            out.Username,
		"fullName":            out.FullName,
		"isCompanyAdmin":      out.IsCompanyAdmin,
		"isDemo":              out.IsDemo,
		"tenant":              out.Tenant,
		"companyTenant":       out.CompanyTenant,
	})
}

func (g *GatewayServer) handleStopImpersonation(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	out, err := g.svc.StopSupportImpersonation(r.Context(), tc)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible restaurar la sesión de plataforma")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                  true,
		"plane":               out.Plane,
		"token":               tok,
		"role":                out.Role,
		"platformRole":        out.PlatformRole,
		"platformPermissions": out.PlatformPermissions,
		"impersonating":       false,
		"tenant":              out.Tenant,
		"companyTenant":       out.CompanyTenant,
	})
}

func (g *GatewayServer) handleAdminProxy(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	isClientAnnouncementRead := r.Method == http.MethodGet &&
		(r.URL.Path == "/api/v1/admin/client-announcements" || r.URL.Path == "/api/v1/admin/client-announcements/")

	if !isClientAnnouncementRead && tc.Plane != domain.PlanePlatform && tc.Role != domain.RoleSuperAdmin {
		httpx.Error(w, http.StatusForbidden, "Acceso denegado: la consola administrativa pertenece exclusivamente al plano interno de plataforma")
		return
	}

	g.mu.RLock()
	entry, ok := g.byServiceID["ms-admin"]
	g.mu.RUnlock()
	if !ok || entry.proxy == nil {
		httpx.Error(w, http.StatusBadGateway, "El servicio de administración de plataforma (ms-admin) no está disponible temporalmente")
		return
	}

	passportTok, err := security.SignPassport(g.privKey, security.PassportClaims{
		Plane:               tc.Plane,
		TenantID:            tc.TenantID,
		UserID:              tc.UserID,
		DBName:              tc.DBName,
		Username:            tc.Username,
		Role:                tc.Role,
		PlatformRole:        tc.PlatformRole,
		PlatformPermissions: tc.PlatformPermissions,
		AllowedTenants:      tc.AllowedTenants,
		RequireDataReason:   tc.RequireDataReason,
		Impersonating:       tc.Impersonating,
		ImpersonationMode:   tc.ImpersonationMode,
		Audience:            "ms-admin",
		Scope:               "platform_admin",
	}, passportTTL)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Error al firmar pasaporte administrativo")
		return
	}
	r.Header.Del(security.PassportHeader)
	r.Header.Del(security.S2SKeyHeader)
	r.Header.Set(security.PassportHeader, passportTok)
	r.Header.Set(security.S2SKeyHeader, g.cfg.S2SSharedKey)
	entry.proxy.ServeHTTP(w, r)
}

func (g *GatewayServer) requireInternalS2S(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !security.VerifyS2SKey(g.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
			httpx.Error(w, http.StatusUnauthorized, "credencial S2S interna inválida")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (g *GatewayServer) mountInternalAdminRoutes(r chi.Router) {
	r.Route("/api/v1/core/internal-admin", func(ir chi.Router) {
		ir.Use(g.requireInternalS2S)

		ir.Get("/tenants", g.handleInternalListTenants)
		ir.Get("/tenants/{tenantId}", g.handleInternalGetTenant)
		ir.Post("/tenants", g.handleInternalCreateTenant)
		ir.Put("/tenants/{tenantId}/subscriptions", g.handleInternalUpdateSubscriptions)
		ir.Put("/tenants/{tenantId}/status", g.handleInternalUpdateStatus)
		ir.Put("/tenants/{tenantId}/billing", g.handleInternalUpdateBilling)
		ir.Put("/tenants/{tenantId}/quotas", g.handleInternalUpdateQuotas)
		ir.Put("/tenants/{tenantId}/maintenance", g.handleInternalUpdateMaintenance)
		ir.Post("/tenants/{tenantId}/revoke-sessions", g.handleInternalRevokeTenantSessions)

		ir.Get("/tenants/{tenantId}/users", g.handleInternalListTenantUsers)
		ir.Post("/tenants/{tenantId}/users", g.handleInternalCreateTenantUser)
		ir.Put("/tenants/{tenantId}/users/{userId}", g.handleInternalUpdateTenantUser)
		ir.Delete("/tenants/{tenantId}/users/{userId}", g.handleInternalDeleteTenantUser)
		ir.Post("/tenants/{tenantId}/users/{userId}/reset-password", g.handleInternalResetTenantUserPassword)
		ir.Post("/tenants/{tenantId}/users/{userId}/revoke-sessions", g.handleInternalRevokeTenantUserSessions)

		ir.Get("/platform/permissions", g.handleInternalListPlatformPermissions)
		ir.Get("/platform/roles", g.handleInternalListPlatformRoles)
		ir.Post("/platform/roles", g.handleInternalCreatePlatformRole)
		ir.Put("/platform/roles/{roleKey}", g.handleInternalUpdatePlatformRole)
		ir.Delete("/platform/roles/{roleKey}", g.handleInternalDeletePlatformRole)

		ir.Get("/platform/users", g.handleInternalListPlatformUsers)
		ir.Post("/platform/users", g.handleInternalCreatePlatformUser)
		ir.Put("/platform/users/{userId}", g.handleInternalUpdatePlatformUser)
		ir.Put("/platform/users/{userId}/self-password", g.handleInternalChangeOwnPlatformPassword)
		ir.Post("/platform/users/{userId}/revoke-sessions", g.handleInternalRevokePlatformUserSessions)
		ir.Post("/platform/users/{userId}/totp/setup", g.handleInternalSetupPlatformUserTOTP)
		ir.Delete("/platform/users/{userId}/totp", g.handleInternalDisablePlatformUserTOTP)

		ir.Get("/catalog", g.handleInternalGetCatalog)
		ir.Get("/catalog-overrides", g.handleInternalGetCatalogOverrides)
		ir.Put("/catalog-overrides", g.handleInternalSaveCatalogOverrides)
		ir.Get("/services/health", g.handleInternalServicesHealth)
		ir.Get("/activation-requests", g.handleInternalListActivationRequests)
		ir.Post("/export-passport", g.handleInternalIssueExportPassport)
	})
}

func (g *GatewayServer) handleInternalListTenants(w http.ResponseWriter, r *http.Request) {
	out, err := g.svc.Bootstrap(r.Context(), authguard.TenantContext{
		Plane:               domain.PlanePlatform,
		Role:                domain.RoleSuperAdmin,
		PlatformRole:        domain.PlatformRoleSuperAdmin,
		PlatformPermissions: []string{"*"},
		AllowedTenants:      []string{"*"},
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenants": out.Tenants})
}

func (g *GatewayServer) handleInternalGetTenant(w http.ResponseWriter, r *http.Request) {
	ten, err := g.svc.GetTenant(r.Context(), chi.URLParam(r, "tenantId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalCreateTenant(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateTenantInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.ProvisionTenantAsSuperAdmin(r.Context(), domain.RoleSuperAdmin, in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalUpdateSubscriptions(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		ActiveServices   []string `json:"activeServices"`
		ActiveModules    []string `json:"activeModules"`
		ActiveSubmodules []string `json:"activeSubmodules"`
		ActiveFeatures   []string `json:"activeFeatures"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.UpdateSubscriptions(r.Context(), domain.RoleSuperAdmin, tID, body.ActiveServices, body.ActiveModules, body.ActiveSubmodules, body.ActiveFeatures)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalUpdateStatus(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.SetTenantStatus(r.Context(), domain.RoleSuperAdmin, tID, body.Status)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalUpdateQuotas(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		MaxUsersAllowed  int    `json:"maxUsersAllowed"`
		CustomMonthlyCop *int64 `json:"customMonthlyCop,omitempty"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var ten *domain.Tenant
	var err error
	if body.MaxUsersAllowed > 0 {
		ten, err = g.svc.UpdateTenantQuotas(r.Context(), domain.RoleSuperAdmin, tID, body.MaxUsersAllowed)
		if err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	if body.CustomMonthlyCop != nil {
		ten, err = g.svc.SetTenantCustomMonthlyCop(r.Context(), tID, *body.CustomMonthlyCop)
		if err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	if ten == nil {
		ten, err = g.svc.GetTenant(r.Context(), tID)
		if err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalUpdateMaintenance(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		MaintenanceMode    bool   `json:"maintenanceMode"`
		MaintenanceMessage string `json:"maintenanceMessage"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.SetTenantMaintenance(r.Context(), tID, body.MaintenanceMode, body.MaintenanceMessage)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalRevokeTenantSessions(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	ver, err := g.svc.RevokeTenantSessions(r.Context(), tID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "sessionVersion": ver})
}

func (g *GatewayServer) handleInternalListTenantUsers(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	users, ten, err := g.svc.ListCompanyUsers(r.Context(), authguard.TenantContext{Role: domain.RoleSuperAdmin}, tID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "users": users, "tenant": ten})
}

func (g *GatewayServer) handleInternalCreateTenantUser(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var in domain.CreateTenantUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.CreateCompanyUser(r.Context(), authguard.TenantContext{Role: domain.RoleSuperAdmin}, tID, in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "user": usr})
}

func (g *GatewayServer) handleInternalUpdateTenantUser(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	var in domain.UpdateTenantUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.UpdateCompanyUser(r.Context(), authguard.TenantContext{Role: domain.RoleSuperAdmin}, tID, uID, in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "user": usr})
}

func (g *GatewayServer) handleInternalResetTenantUserPassword(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	var body struct {
		Password string `json:"password"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.AdminResetTenantUserPassword(r.Context(), tID, uID, body.Password)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "user": usr})
}

func (g *GatewayServer) handleInternalRevokeTenantUserSessions(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	ver, err := g.svc.RevokeTenantUserSessions(r.Context(), tID, uID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "sessionVersion": ver})
}

func (g *GatewayServer) handleInternalListPlatformPermissions(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"permissions": domain.OfficialPlatformPermissions(),
	})
}

func (g *GatewayServer) handleInternalListPlatformRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := g.svc.ListPlatformRoles(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "roles": roles})
}

func (g *GatewayServer) handleInternalCreatePlatformRole(w http.ResponseWriter, r *http.Request) {
	var in domain.CreatePlatformRoleInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	role, err := g.svc.CreatePlatformRole(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "role": role})
}

func (g *GatewayServer) handleInternalUpdatePlatformRole(w http.ResponseWriter, r *http.Request) {
	roleKey := chi.URLParam(r, "roleKey")
	var in domain.UpdatePlatformRoleInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	role, err := g.svc.UpdatePlatformRole(r.Context(), roleKey, in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "role": role})
}

func (g *GatewayServer) handleInternalDeletePlatformRole(w http.ResponseWriter, r *http.Request) {
	if err := g.svc.DeletePlatformRole(r.Context(), chi.URLParam(r, "roleKey")); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (g *GatewayServer) handleInternalListPlatformUsers(w http.ResponseWriter, r *http.Request) {
	users, err := g.svc.ListPlatformUsers(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "users": users})
}

func (g *GatewayServer) handleInternalCreatePlatformUser(w http.ResponseWriter, r *http.Request) {
	var in domain.CreatePlatformUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	u, err := g.svc.CreatePlatformUser(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "user": u})
}

func (g *GatewayServer) handleInternalUpdatePlatformUser(w http.ResponseWriter, r *http.Request) {
	var in domain.UpdatePlatformUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	u, err := g.svc.UpdatePlatformUser(r.Context(), chi.URLParam(r, "userId"), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "user": u})
}

func (g *GatewayServer) handleInternalRevokePlatformUserSessions(w http.ResponseWriter, r *http.Request) {
	ver, err := g.svc.RevokePlatformUserSessions(r.Context(), chi.URLParam(r, "userId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "sessionVersion": ver})
}

func (g *GatewayServer) handleInternalSetupPlatformUserTOTP(w http.ResponseWriter, r *http.Request) {
	out, err := g.svc.SetupPlatformUserTOTP(r.Context(), chi.URLParam(r, "userId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "totp": out})
}

func (g *GatewayServer) handleInternalDisablePlatformUserTOTP(w http.ResponseWriter, r *http.Request) {
	u, err := g.svc.DisablePlatformUserTOTP(r.Context(), chi.URLParam(r, "userId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "user": u})
}

func (g *GatewayServer) handleInternalGetCatalog(w http.ResponseWriter, r *http.Request) {
	cat := g.svc.Catalog()
	ov, _ := g.svc.GetCatalogOverrides(r.Context())
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"catalog":   cat,
		"presets":   domain.OfficialBusinessPresets(cat),
		"pricing":   domain.DefaultPricingMatrixCOP(),
		"overrides": ov,
	})
}

func (g *GatewayServer) handleInternalGetCatalogOverrides(w http.ResponseWriter, r *http.Request) {
	ov, err := g.svc.GetCatalogOverrides(r.Context())
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "overrides": ov})
}

func (g *GatewayServer) handleInternalSaveCatalogOverrides(w http.ResponseWriter, r *http.Request) {
	var cfg domain.CatalogOverrideConfig
	if err := httpx.Decode(w, r, &cfg); err != nil {
		httpx.RespondError(w, err)
		return
	}
	saved, err := g.svc.SaveCatalogOverrides(r.Context(), cfg)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "overrides": saved})
}

func (g *GatewayServer) handleInternalListActivationRequests(w http.ResponseWriter, r *http.Request) {
	reqs, err := g.svc.ListActivationRequests(r.Context(), authguard.TenantContext{Role: domain.RoleSuperAdmin})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "requests": reqs})
}

func (g *GatewayServer) handleInternalServicesHealth(w http.ResponseWriter, r *http.Request) {
	type serviceHealthItem struct {
		ServiceKey string `json:"serviceKey"`
		APIPrefix  string `json:"apiPrefix"`
		TargetURL  string `json:"targetUrl"`
		Status     string `json:"status"`
		LatencyMs  int64  `json:"latencyMs"`
	}
	g.mu.RLock()
	entries := make([]upstreamEntry, 0, len(g.byServiceID))
	for _, e := range g.byServiceID {
		entries = append(entries, e)
	}
	g.mu.RUnlock()

	client := &http.Client{Timeout: 1500 * time.Millisecond, Transport: g.transport}
	out := make([]serviceHealthItem, 0, len(entries)+1)
	out = append(out, serviceHealthItem{
		ServiceKey: "ms-core",
		APIPrefix:  "/api/v1/core",
		TargetURL:  "local",
		Status:     "UP",
		LatencyMs:  0,
	})
	for _, e := range entries {
		start := time.Now()
		status := "DOWN"
		ctx, cancel := context.WithTimeout(r.Context(), 1200*time.Millisecond)
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(e.targetURL, "/")+"/health", nil)
		resp, err := client.Do(req)
		if err == nil && resp != nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 500 {
				status = "UP"
			}
		} else {
			req2, _ := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(e.targetURL, "/")+"/api/v1/health", nil)
			if resp2, err2 := client.Do(req2); err2 == nil && resp2 != nil {
				_ = resp2.Body.Close()
				if resp2.StatusCode >= 200 && resp2.StatusCode < 500 {
					status = "UP"
				}
			}
		}
		cancel()
		out = append(out, serviceHealthItem{
			ServiceKey: e.serviceKey,
			APIPrefix:  e.apiPrefix,
			TargetURL:  e.targetURL,
			Status:     status,
			LatencyMs:  time.Since(start).Milliseconds(),
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "services": out})
}

func (g *GatewayServer) handleInternalIssueExportPassport(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TenantID      string `json:"tenantId"`
		TargetService string `json:"targetService"`
		ActorEmail    string `json:"actorEmail"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.GetTenant(r.Context(), strings.TrimSpace(body.TenantID))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	target := strings.TrimSpace(body.TargetService)
	if target == "" {
		httpx.RespondError(w, apperr.Validation("targetService requerido"))
		return
	}
	g.mu.RLock()
	entry, ok := g.byServiceID[target]
	g.mu.RUnlock()
	if !ok {
		httpx.Error(w, http.StatusNotFound, "Microservicio destino no registrado: "+target)
		return
	}
	actor := strings.TrimSpace(body.ActorEmail)
	if actor == "" {
		actor = "platform-exporter"
	}
	tok, err := security.SignPassport(g.privKey, security.PassportClaims{
		Plane:            domain.PlanePlatform,
		TenantID:         ten.TenantID,
		DBName:           ten.DBName,
		Username:         actor,
		Role:             domain.RoleSuperAdmin,
		Audience:         target,
		ActiveServices:   ten.ActiveServices,
		ActiveModules:    ten.ActiveModules,
		ActiveSubmodules: ten.ActiveSubmodules,
		ActiveFeatures:   ten.ActiveFeatures,
	}, 60*time.Second)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible firmar pasaporte de exportación")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"passport":  tok,
		"targetUrl": entry.targetURL,
		"apiPrefix": entry.apiPrefix,
		"tenant":    ten,
	})
}

func (g *GatewayServer) issueChallengeToken(out application.AuthOutput) (string, error) {
	claims := authguard.TenantContext{
		Plane:            domain.PlanePlatform,
		UserID:           out.UserID,
		Username:         out.Username,
		FullName:         out.FullName,
		Role:             out.Role,
		PlatformRole:     out.PlatformRole,
		ChallengePurpose: "platform_totp_verify",
	}
	return authguard.SignJWT(g.cfg.JWTSecret, claims, 5*time.Minute)
}

func (g *GatewayServer) handleInternalUpdateBilling(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		PaymentStatus string `json:"paymentStatus"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.SetTenantPaymentStatus(r.Context(), tID, body.PaymentStatus)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "tenant": ten})
}

func (g *GatewayServer) handleInternalDeleteTenantUser(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	if err := g.svc.DeleteCompanyUser(r.Context(), authguard.TenantContext{Role: domain.RoleSuperAdmin}, tID, uID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (g *GatewayServer) handleInternalChangeOwnPlatformPassword(w http.ResponseWriter, r *http.Request) {
	uID := chi.URLParam(r, "userId")
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := g.svc.ChangeOwnPlatformPassword(r.Context(), uID, body.CurrentPassword, body.NewPassword); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}
