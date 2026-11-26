package httpadapter

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-admin/internal/application"
	"ms-admin/internal/domain"
	"ms-admin/internal/platform/config"
	"ms-admin/internal/platform/httpx"
	"ms-admin/internal/platform/security"
)

type actorCtxKey struct{}

type Handler struct {
	cfg    config.ServiceConfig
	pubKey ed25519.PublicKey
	replay *security.ReplayGuard
	svc    *application.AdminService
}

func NewHandler(cfg config.ServiceConfig, pubKey ed25519.PublicKey, replay *security.ReplayGuard, svc *application.AdminService) *Handler {
	return &Handler{
		cfg:    cfg,
		pubKey: pubKey,
		replay: replay,
		svc:    svc,
	}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-admin"})
	})
	r.Get("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-admin"})
	})

	r.Route("/api/v1/admin", func(ar chi.Router) {
		ar.Use(h.passportMiddleware)

		ar.Get("/client-announcements", h.handleClientAnnouncements)
		ar.Get("/overview", h.handleOverview)
		ar.Get("/services/health", h.handleServicesHealth)
		ar.Get("/activation-requests", h.handleActivationRequests)

		ar.Get("/tenants", h.handleListTenants)
		ar.Post("/tenants", h.handleCreateTenant)
		ar.Get("/tenants/{tenantId}", h.handleGetTenant)
		ar.Put("/tenants/{tenantId}/subscriptions", h.handleUpdateSubscriptions)
		ar.Put("/tenants/{tenantId}/status", h.handleUpdateTenantStatus)
		ar.Put("/tenants/{tenantId}/billing", h.handleUpdateTenantBilling)
		ar.Put("/tenants/{tenantId}/quotas", h.handleUpdateTenantQuotas)
		ar.Put("/tenants/{tenantId}/maintenance", h.handleUpdateTenantMaintenance)
		ar.Post("/tenants/{tenantId}/revoke-sessions", h.handleRevokeTenantSessions)
		ar.Get("/tenants/{tenantId}/metadata", h.handleGetTenantMetadata)
		ar.Put("/tenants/{tenantId}/metadata", h.handleUpdateTenantMetadata)

		ar.Get("/tenants/{tenantId}/users", h.handleListTenantUsers)
		ar.Post("/tenants/{tenantId}/users", h.handleCreateTenantUser)
		ar.Put("/tenants/{tenantId}/users/{userId}", h.handleUpdateTenantUser)
		ar.Delete("/tenants/{tenantId}/users/{userId}", h.handleDeleteTenantUser)
		ar.Post("/tenants/{tenantId}/users/{userId}/reset-password", h.handleResetTenantUserPassword)
		ar.Post("/tenants/{tenantId}/users/{userId}/revoke-sessions", h.handleRevokeTenantUserSessions)

		ar.Get("/exports", h.handleListAllExports)
		ar.Post("/tenants/{tenantId}/exports", h.handleCreateExport)
		ar.Get("/tenants/{tenantId}/exports", h.handleListExports)
		ar.Get("/exports/{jobId}/download", h.handleDownloadExport)

		ar.Get("/catalog", h.handleGetCatalog)
		ar.Put("/catalog/overrides", h.handleSaveCatalogOverrides)

		ar.Get("/feature-flags", h.handleListFeatureFlags)
		ar.Put("/feature-flags", h.handleUpsertFeatureFlag)
		ar.Delete("/feature-flags/{flagKey}", h.handleDeleteFeatureFlag)

		ar.Get("/announcements", h.handleListAnnouncements)
		ar.Post("/announcements", h.handleCreateAnnouncement)
		ar.Put("/announcements/{announcementId}", h.handleUpdateAnnouncement)
		ar.Delete("/announcements/{announcementId}", h.handleDeleteAnnouncement)

		ar.Get("/staff/permissions", h.handleListPermissions)
		ar.Get("/staff/roles", h.handleListRoles)
		ar.Post("/staff/roles", h.handleCreateRole)
		ar.Put("/staff/roles/{roleKey}", h.handleUpdateRole)
		ar.Delete("/staff/roles/{roleKey}", h.handleDeleteRole)

		ar.Get("/staff/users", h.handleListStaffUsers)
		ar.Post("/staff/users", h.handleCreateStaffUser)
		ar.Put("/staff/users/{userId}", h.handleUpdateStaffUser)
		ar.Post("/staff/users/{userId}/revoke-sessions", h.handleRevokeStaffUserSessions)
		ar.Post("/staff/users/{userId}/totp/setup", h.handleSetupStaffUserTOTP)
		ar.Delete("/staff/users/{userId}/totp", h.handleDisableStaffUserTOTP)

		ar.Get("/me", h.handleGetMyAccount)
		ar.Post("/me/totp/setup", h.handleSetupMyTOTP)
		ar.Delete("/me/totp", h.handleDisableMyTOTP)
		ar.Put("/me/password", h.handleChangeMyPassword)

		ar.Get("/audit", h.handleListAudit)
		ar.Get("/audit/export-csv", h.handleExportAuditCSV)
	})

	return r
}

func (h *Handler) passportMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !security.VerifyS2SKey(h.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
			httpx.Error(w, http.StatusUnauthorized, "credencial S2S inválida en ms-admin")
			return
		}
		rawPassport := strings.TrimSpace(r.Header.Get(security.PassportHeader))
		claims, err := security.VerifyPassport(h.pubKey, rawPassport, "ms-admin", h.replay)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "pasaporte administrativo inválido: "+err.Error())
			return
		}
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
		actor := domain.ActorContext{
			Plane:               claims.Plane,
			UserID:              claims.UserID,
			Email:               claims.Username,
			Role:                claims.Role,
			PlatformRole:        claims.PlatformRole,
			PlatformPermissions: claims.PlatformPermissions,
			AllowedTenants:      claims.AllowedTenants,
			RequireDataReason:   claims.RequireDataReason,
			TenantID:            claims.TenantID,
			IPAddress:           ip,
			UserAgent:           r.UserAgent(),
		}
		ctx := context.WithValue(r.Context(), actorCtxKey{}, actor)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func actorFrom(r *http.Request) domain.ActorContext {
	if a, ok := r.Context().Value(actorCtxKey{}).(domain.ActorContext); ok {
		return a
	}
	return domain.ActorContext{}
}

func (h *Handler) handleClientAnnouncements(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	list, err := h.svc.ListClientAnnouncements(r.Context(), actor.TenantID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "announcements": list})
}

func (h *Handler) handleOverview(w http.ResponseWriter, r *http.Request) {
	out, err := h.svc.Overview(r.Context(), actorFrom(r))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) handleServicesHealth(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "plataforma.salud_servicios"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/services/health", nil)
}

func (h *Handler) handleActivationRequests(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "empresas.ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/activation-requests", nil)
}

func (h *Handler) handleListTenants(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "empresas.ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "GET", "/api/v1/core/internal-admin/tenants", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		if rawList, ok := payload["tenants"].([]any); ok {
			filtered := make([]any, 0, len(rawList))
			for _, item := range rawList {
				if m, ok := item.(map[string]any); ok {
					tID, _ := m["tenantId"].(string)
					if actor.CanAccessTenant(tID) {
						filtered = append(filtered, m)
					}
				}
			}
			payload["tenants"] = filtered
		}
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleGetTenant(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "GET", "/api/v1/core/internal-admin/tenants/"+tID, nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		if meta, mErr := h.svc.GetTenantMetadata(r.Context(), actor, tID); mErr == nil {
			payload["metadata"] = meta
		}
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleCreateTenant(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "empresas.crear"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/tenants", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		tID := nestedString(payload, "tenant", "tenantId")
		h.svc.Audit(r.Context(), actor, "empresas.crear", "tenant", tID, tID, "", nil, map[string]any{
			"companyName": body["companyName"],
			"nit":         body["nit"],
		}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateSubscriptions(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.editar_suscripcion"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/subscriptions", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "empresas.editar_suscripcion", "tenant", tID, tID, strFromMap(body, "reason"), nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateTenantStatus(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.suspender"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/status", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "empresas.suspender", "tenant", tID, tID, strFromMap(body, "reason"), nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateTenantQuotas(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.editar_cuotas"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/quotas", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "empresas.editar_cuotas", "tenant", tID, tID, strFromMap(body, "reason"), nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateTenantMaintenance(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.mantenimiento"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/maintenance", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "empresas.mantenimiento", "tenant", tID, tID, strFromMap(body, "reason"), nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleRevokeTenantSessions(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.revocar_sesiones"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/tenants/"+tID+"/revoke-sessions", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.revocar_sesiones", "tenant", tID, tID, "", nil, payload, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleGetTenantMetadata(w http.ResponseWriter, r *http.Request) {
	meta, err := h.svc.GetTenantMetadata(r.Context(), actorFrom(r), chi.URLParam(r, "tenantId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "metadata": meta})
}

func (h *Handler) handleUpdateTenantMetadata(w http.ResponseWriter, r *http.Request) {
	var in domain.TenantMetadata
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	meta, err := h.svc.UpdateTenantMetadata(r.Context(), actorFrom(r), chi.URLParam(r, "tenantId"), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "metadata": meta})
}

func (h *Handler) handleListTenantUsers(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/tenants/"+tID+"/users", nil)
}

func (h *Handler) handleCreateTenantUser(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.crear"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/tenants/"+tID+"/users", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.crear", "tenant_user", nestedString(payload, "user", "userId"), tID, "", nil, map[string]any{
			"username":     body["username"],
			"internalRole": body["internalRole"],
		}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateTenantUser(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.editar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/users/"+uID, body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.editar", "tenant_user", uID, tID, "", nil, map[string]any{
			"status":       body["status"],
			"internalRole": body["internalRole"],
		}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleResetTenantUserPassword(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.reset_password"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/tenants/"+tID+"/users/"+uID+"/reset-password", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.reset_password", "tenant_user", uID, tID, strFromMap(body, "reason"), nil, map[string]any{"passwordReset": true}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleRevokeTenantUserSessions(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.revocar_sesiones"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/tenants/"+tID+"/users/"+uID+"/revoke-sessions", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.revocar_sesiones", "tenant_user", uID, tID, "", nil, payload, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleCreateExport(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	job, err := h.svc.GenerateTenantCSVExport(r.Context(), actor, tID, body.Reason)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":          true,
		"job":         job,
		"downloadUrl": "/api/v1/admin/exports/" + job.JobID + "/download",
	})
}

func (h *Handler) handleListExports(w http.ResponseWriter, r *http.Request) {
	jobs, err := h.svc.ListExportJobs(r.Context(), actorFrom(r), chi.URLParam(r, "tenantId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "jobs": jobs})
}

func (h *Handler) handleDownloadExport(w http.ResponseWriter, r *http.Request) {
	job, err := h.svc.GetExportJob(r.Context(), actorFrom(r), chi.URLParam(r, "jobId"))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	filename := fmt.Sprintf("export_%s_%s.zip", job.TenantID, job.JobID)
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", strconv.Itoa(len(job.ZipBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(job.ZipBytes)
}

func (h *Handler) handleGetCatalog(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "catalogo.ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/catalog", nil)
}

func (h *Handler) handleSaveCatalogOverrides(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if !actor.HasPermission("catalogo.editar_visibilidad") && !actor.HasPermission("catalogo.editar_precios") {
		httpx.Error(w, http.StatusForbidden, "Tu rol no tiene permiso para modificar el catálogo comercial")
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/catalog-overrides", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "catalogo.editar_overrides", "catalog", "global", "", "", nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleListFeatureFlags(w http.ResponseWriter, r *http.Request) {
	flags, err := h.svc.ListFeatureFlags(r.Context(), actorFrom(r))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "flags": flags})
}

func (h *Handler) handleUpsertFeatureFlag(w http.ResponseWriter, r *http.Request) {
	var in domain.FeatureFlag
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	flag, err := h.svc.UpsertFeatureFlag(r.Context(), actorFrom(r), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "flag": flag})
}

func (h *Handler) handleDeleteFeatureFlag(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteFeatureFlag(r.Context(), actorFrom(r), chi.URLParam(r, "flagKey")); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleListAnnouncements(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListAnnouncements(r.Context(), actorFrom(r))
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "announcements": list})
}

func (h *Handler) handleCreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var in domain.Announcement
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ann, err := h.svc.CreateAnnouncement(r.Context(), actorFrom(r), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "announcement": ann})
}

func (h *Handler) handleUpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var in domain.Announcement
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ann, err := h.svc.UpdateAnnouncement(r.Context(), actorFrom(r), chi.URLParam(r, "announcementId"), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "announcement": ann})
}

func (h *Handler) handleDeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.DeleteAnnouncement(r.Context(), actorFrom(r), chi.URLParam(r, "announcementId")); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) handleListPermissions(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if !actor.HasPermission("plataforma.roles_gestionar") && !actor.HasPermission("plataforma.usuarios_ver") {
		httpx.Error(w, http.StatusForbidden, "Permiso insuficiente para ver catálogo de permisos")
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/platform/permissions", nil)
}

func (h *Handler) handleListRoles(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if !actor.HasPermission("plataforma.roles_gestionar") && !actor.HasPermission("plataforma.usuarios_ver") {
		httpx.Error(w, http.StatusForbidden, "Permiso insuficiente para consultar roles de plataforma")
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/platform/roles", nil)
}

func (h *Handler) handleCreateRole(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "plataforma.roles_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/platform/roles", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.rol_crear", "platform_role", strFromMap(body, "roleKey"), "", "", nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateRole(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	roleKey := chi.URLParam(r, "roleKey")
	if err := h.svc.RequirePermission(actor, "plataforma.roles_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/platform/roles/"+roleKey, body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.rol_editar", "platform_role", roleKey, "", "", nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleDeleteRole(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	roleKey := chi.URLParam(r, "roleKey")
	if err := h.svc.RequirePermission(actor, "plataforma.roles_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "DELETE", "/api/v1/core/internal-admin/platform/roles/"+roleKey, nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.rol_eliminar", "platform_role", roleKey, "", "", nil, nil, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleListStaffUsers(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "plataforma.usuarios_ver"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	h.proxyToCore(w, r, "GET", "/api/v1/core/internal-admin/platform/users", nil)
}

func (h *Handler) handleCreateStaffUser(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if err := h.svc.RequirePermission(actor, "plataforma.usuarios_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/platform/users", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.usuario_crear", "platform_user", nestedString(payload, "user", "userId"), "", "", nil, map[string]any{
			"email":   body["email"],
			"roleKey": body["roleKey"],
		}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleUpdateStaffUser(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "plataforma.usuarios_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/platform/users/"+uID, body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.usuario_editar", "platform_user", uID, "", "", nil, map[string]any{
			"roleKey":     body["roleKey"],
			"status":      body["status"],
			"mfaRequired": body["mfaRequired"],
		}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleRevokeStaffUserSessions(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "plataforma.usuarios_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/platform/users/"+uID+"/revoke-sessions", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.usuario_revocar_sesiones", "platform_user", uID, "", "", nil, payload, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleSetupStaffUserTOTP(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	uID := chi.URLParam(r, "userId")
	if actor.UserID != uID {
		if err := h.svc.RequirePermission(actor, "plataforma.usuarios_gestionar"); err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/platform/users/"+uID+"/totp/setup", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.totp_activar", "platform_user", uID, "", "", nil, map[string]any{"mfaEnabled": true}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleDisableStaffUserTOTP(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "plataforma.usuarios_gestionar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "DELETE", "/api/v1/core/internal-admin/platform/users/"+uID+"/totp", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.totp_desactivar", "platform_user", uID, "", "", nil, map[string]any{"mfaEnabled": false}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleListAudit(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit, _ := strconv.Atoi(q.Get("limit"))
	logs, err := h.svc.ListAudit(r.Context(), actorFrom(r), domain.AuditFilter{
		TenantID:   q.Get("tenantId"),
		ActorEmail: q.Get("actor"),
		Action:     q.Get("action"),
		Limit:      limit,
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "logs": logs})
}

func (h *Handler) handleExportAuditCSV(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	csvBytes, err := h.svc.ExportAuditCSV(r.Context(), actorFrom(r), domain.AuditFilter{
		TenantID:   q.Get("tenantId"),
		ActorEmail: q.Get("actor"),
		Action:     q.Get("action"),
	})
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="auditoria_plataforma.csv"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(csvBytes)
}

func (h *Handler) proxyToCore(w http.ResponseWriter, r *http.Request, method, path string, body any) {
	status, payload, err := h.svc.ForwardCore(r.Context(), method, path, body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.JSON(w, status, payload)
}

func decodeMap(w http.ResponseWriter, r *http.Request, dst *map[string]any) error {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<20)).Decode(dst); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Cuerpo JSON inválido")
		return err
	}
	if *dst == nil {
		*dst = map[string]any{}
	}
	return nil
}

func strFromMap(m map[string]any, key string) string {
	s, _ := m[key].(string)
	return strings.TrimSpace(s)
}

func nestedString(m map[string]any, outer, inner string) string {
	sub, ok := m[outer].(map[string]any)
	if !ok {
		return ""
	}
	s, _ := sub[inner].(string)
	return s
}

func (h *Handler) handleUpdateTenantBilling(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	if err := h.svc.RequirePermission(actor, "empresas.editar_cuotas"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/tenants/"+tID+"/billing", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "empresas.editar_facturacion", "tenant", tID, tID, "", nil, body, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleDeleteTenantUser(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	tID := chi.URLParam(r, "tenantId")
	uID := chi.URLParam(r, "userId")
	if err := h.svc.RequirePermission(actor, "usuarios_cliente.editar"); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := h.svc.RequireTenantScope(actor, tID); err != nil {
		httpx.RespondError(w, err)
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "DELETE", "/api/v1/core/internal-admin/tenants/"+tID+"/users/"+uID, nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "usuarios_cliente.eliminar", "tenant_user", uID, tID, "", nil, nil, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleListAllExports(w http.ResponseWriter, r *http.Request) {
	jobs, err := h.svc.ListExportJobs(r.Context(), actorFrom(r), "")
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "jobs": jobs})
}

func (h *Handler) handleGetMyAccount(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if actor.Plane != "platform" && actor.Role != "superadmin" {
		httpx.Error(w, http.StatusForbidden, "Sesión de plataforma requerida")
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "GET", "/api/v1/core/internal-admin/platform/users", nil)
	if err != nil || status >= 400 {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok": true,
			"me": map[string]any{
				"userId":            actor.UserID,
				"email":             actor.Email,
				"roleKey":           actor.PlatformRole,
				"permissions":       actor.PlatformPermissions,
				"requireDataReason": actor.RequireDataReason,
			},
		})
		return
	}
	var myRecord map[string]any
	if list, ok := payload["users"].([]any); ok {
		for _, raw := range list {
			if m, ok := raw.(map[string]any); ok {
				if m["userId"] == actor.UserID || strings.EqualFold(strFromMap(m, "email"), actor.Email) {
					myRecord = m
					break
				}
			}
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"me":                myRecord,
		"permissions":       actor.PlatformPermissions,
		"requireDataReason": actor.RequireDataReason,
	})
}

func (h *Handler) handleSetupMyTOTP(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if strings.TrimSpace(actor.UserID) == "" {
		httpx.Error(w, http.StatusBadRequest, "Identificador de operador no disponible")
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "POST", "/api/v1/core/internal-admin/platform/users/"+actor.UserID+"/totp/setup", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.mi_totp_activar", "platform_user", actor.UserID, "", "", nil, map[string]any{"mfaEnabled": true}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleDisableMyTOTP(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if strings.TrimSpace(actor.UserID) == "" {
		httpx.Error(w, http.StatusBadRequest, "Identificador de operador no disponible")
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "DELETE", "/api/v1/core/internal-admin/platform/users/"+actor.UserID+"/totp", nil)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.mi_totp_desactivar", "platform_user", actor.UserID, "", "", nil, map[string]any{"mfaEnabled": false}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}

func (h *Handler) handleChangeMyPassword(w http.ResponseWriter, r *http.Request) {
	actor := actorFrom(r)
	if strings.TrimSpace(actor.UserID) == "" {
		httpx.Error(w, http.StatusBadRequest, "Identificador de operador no disponible")
		return
	}
	var body map[string]any
	if err := decodeMap(w, r, &body); err != nil {
		return
	}
	status, payload, err := h.svc.ForwardCore(r.Context(), "PUT", "/api/v1/core/internal-admin/platform/users/"+actor.UserID+"/self-password", body)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	if status < 400 {
		h.svc.Audit(r.Context(), actor, "plataforma.mi_clave_cambiar", "platform_user", actor.UserID, "", "", nil, map[string]any{"passwordChanged": true}, "SUCCESS")
	}
	httpx.JSON(w, status, payload)
}
