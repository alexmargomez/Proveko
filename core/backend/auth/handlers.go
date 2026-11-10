package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/core/backend/provisioning"
	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	cfg config.Config
	reg *provisioning.Registry
}

func NewHandler(cfg config.Config, reg *provisioning.Registry) *Handler {
	return &Handler{cfg: cfg, reg: reg}
}

func (h *Handler) Bootstrap(w http.ResponseWriter, r *http.Request) {
	tc := h.resolveUserFromHeader(r)
	rec, ok := h.reg.Get(tc.TenantID)
	if !ok {
		rec, _ = h.reg.Get("demo-empresa")
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"catalog":  h.reg.Catalog(),
		"tenant":   rec,
		"tenants":  h.reg.List(),
		"userRole": tc.Role,
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &body); err != nil || strings.TrimSpace(body.Username) == "" {
		httpx.Error(w, http.StatusBadRequest, "Ingresa tu usuario o correo electrónico")
		return
	}
	uLow := strings.ToLower(strings.TrimSpace(body.Username))
	role := "cliente"
	if strings.Contains(uLow, "superadmin") {
		role = "superadmin"
	} else if strings.Contains(uLow, "dev") {
		role = "desarrollador"
	}

	rec, ok := h.reg.FindByUsername(uLow)
	if !ok {
		rec, _ = h.reg.Get("demo-empresa")
	}

	claims := authguard.TenantContext{
		TenantID:       rec.TenantID,
		DBName:         rec.DBName,
		Username:       uLow,
		Role:           role,
		ActiveServices: rec.ActiveServices,
		ActiveModules:  rec.ActiveModules,
		ActiveFeatures: rec.ActiveFeatures,
	}
	tok, err := authguard.SignJWT(h.cfg.JWTSecret, claims, 24*time.Hour)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible firmar la sesión")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"token":    tok,
		"role":     role,
		"username": uLow,
		"tenant":   rec,
	})
}

func (h *Handler) RegisterCompany(w http.ResponseWriter, r *http.Request) {
	var in provisioning.CreateTenantInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de registro inválidos")
		return
	}
	rec, err := h.reg.CreateTenant(r.Context(), in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	claims := authguard.TenantContext{
		TenantID:       rec.TenantID,
		DBName:         rec.DBName,
		Username:       rec.AdminUsername,
		Role:           "cliente",
		ActiveServices: rec.ActiveServices,
		ActiveModules:  rec.ActiveModules,
		ActiveFeatures: rec.ActiveFeatures,
	}
	tok, _ := authguard.SignJWT(h.cfg.JWTSecret, claims, 24*time.Hour)
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"token":  tok,
		"tenant": rec,
	})
}

func (h *Handler) UpdateSubscriptions(w http.ResponseWriter, r *http.Request) {
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		ActiveServices []string `json:"activeServices"`
		ActiveModules  []string `json:"activeModules"`
		ActiveFeatures []string `json:"activeFeatures"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato inválido")
		return
	}
	rec, err := h.reg.UpdateSubscriptions(r.Context(), tID, body.ActiveServices, body.ActiveModules, body.ActiveFeatures)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"tenant": rec,
	})
}

func (h *Handler) resolveUserFromHeader(r *http.Request) authguard.TenantContext {
	authHdr := r.Header.Get("Authorization")
	if strings.HasPrefix(authHdr, "Bearer ") {
		if tc, err := authguard.VerifyJWT(h.cfg.JWTSecret, strings.TrimPrefix(authHdr, "Bearer ")); err == nil {
			if rec, ok := h.reg.Get(tc.TenantID); ok {
				tc.DBName = rec.DBName
				tc.ActiveServices = rec.ActiveServices
				tc.ActiveModules = rec.ActiveModules
				tc.ActiveFeatures = rec.ActiveFeatures
			}
			return tc
		}
	}
	if tOverride := r.Header.Get("X-Tenant-Id"); tOverride != "" {
		if rec, ok := h.reg.Get(tOverride); ok {
			return authguard.TenantContext{
				TenantID:       rec.TenantID,
				DBName:         rec.DBName,
				Username:       rec.AdminUsername,
				Role:           "cliente",
				ActiveServices: rec.ActiveServices,
				ActiveModules:  rec.ActiveModules,
				ActiveFeatures: rec.ActiveFeatures,
			}
		}
	}
	rec, _ := h.reg.Get("demo-empresa")
	return authguard.TenantContext{
		TenantID:       rec.TenantID,
		DBName:         rec.DBName,
		Username:       "demo@proveko.com",
		Role:           "cliente",
		ActiveServices: rec.ActiveServices,
		ActiveModules:  rec.ActiveModules,
		ActiveFeatures: rec.ActiveFeatures,
	}
}

func (h *Handler) ResolveContext(r *http.Request) authguard.TenantContext {
	return h.resolveUserFromHeader(r)
}
