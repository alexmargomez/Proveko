package httpadapter

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"ms-core/internal/application"
	"ms-core/internal/domain"
	"ms-core/internal/platform/httpx"
)

func (g *GatewayServer) handlePublicCatalog(w http.ResponseWriter, _ *http.Request) {
	out := g.svc.PublicCatalog()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"catalog":       out.Catalog,
		"presets":       out.Presets,
		"pricing":       out.Pricing,
		"roleTemplates": out.RoleTemplates,
	})
}

func (g *GatewayServer) handleDemoSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RolePreview string `json:"rolePreview"`
	}
	if r.ContentLength > 0 {
		if err := httpx.Decode(w, r, &body); err != nil {
			httpx.RespondError(w, err)
			return
		}
	}
	out, err := g.svc.StartDemoSession(r.Context(), body.RolePreview)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible iniciar la sesión de demostración")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"token":          tok,
		"role":           out.Role,
		"internalRole":   out.InternalRole,
		"username":       out.Username,
		"fullName":       out.FullName,
		"isCompanyAdmin": out.IsCompanyAdmin,
		"isDemo":         true,
		"tenant":         out.Tenant,
		"companyTenant":  out.CompanyTenant,
	})
}

func (g *GatewayServer) handleListCompanyUsers(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	users, ten, err := g.svc.ListCompanyUsers(r.Context(), tc, "")
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"users":           users,
		"maxUsersAllowed": ten.MaxUsersAllowed,
		"roleTemplates":   domain.OfficialRoleTemplates(),
	})
}

func (g *GatewayServer) handleAdminListTenantUsers(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	tID := chi.URLParam(r, "tenantId")
	users, ten, err := g.svc.ListCompanyUsers(r.Context(), tc, tID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":              true,
		"users":           users,
		"maxUsersAllowed": ten.MaxUsersAllowed,
		"roleTemplates":   domain.OfficialRoleTemplates(),
	})
}

func (g *GatewayServer) handleCreateCompanyUser(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var in domain.CreateTenantUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.CreateCompanyUser(r.Context(), tc, "", in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":   true,
		"user": usr,
	})
}

func (g *GatewayServer) handleAdminCreateTenantUser(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var in domain.CreateTenantUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.CreateCompanyUser(r.Context(), tc, chi.URLParam(r, "tenantId"), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":   true,
		"user": usr,
	})
}

func (g *GatewayServer) handleUpdateCompanyUser(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var in domain.UpdateTenantUserInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	usr, err := g.svc.UpdateCompanyUser(r.Context(), tc, "", chi.URLParam(r, "userId"), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"user": usr,
	})
}

func (g *GatewayServer) handleDeleteCompanyUser(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := g.svc.DeleteCompanyUser(r.Context(), tc, "", chi.URLParam(r, "userId")); err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (g *GatewayServer) handleSelfActivateModules(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body struct {
		AddServices   []string `json:"addServices"`
		AddModules    []string `json:"addModules"`
		AddSubmodules []string `json:"addSubmodules"`
		AddFeatures   []string `json:"addFeatures"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	updated, err := g.svc.SelfActivateCompanyModules(r.Context(), tc, body.AddServices, body.AddModules, body.AddSubmodules, body.AddFeatures)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	out := application.AuthOutput{
		Tenant:         updated,
		CompanyTenant:  updated.Clone(),
		UserID:         tc.UserID,
		Role:           tc.Role,
		InternalRole:   tc.InternalRole,
		Username:       tc.Username,
		FullName:       tc.FullName,
		IsCompanyAdmin: tc.IsCompanyAdmin,
		IsDemo:         tc.IsDemo,
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible actualizar la sesión activa")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"token":         tok,
		"tenant":        updated,
		"companyTenant": updated.Clone(),
	})
}

func (g *GatewayServer) handleUpdateTenantQuotas(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body struct {
		MaxUsersAllowed int `json:"maxUsersAllowed"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.UpdateTenantQuotas(r.Context(), tc.Role, chi.URLParam(r, "tenantId"), body.MaxUsersAllowed)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"tenant": ten,
	})
}

func (g *GatewayServer) handleListActivationRequests(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	items, err := g.svc.ListActivationRequests(r.Context(), tc)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"requests": items,
	})
}
