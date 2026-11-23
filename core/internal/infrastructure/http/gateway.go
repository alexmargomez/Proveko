package httpadapter

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"ms-core/internal/application"
	"ms-core/internal/domain"
	"ms-core/internal/infrastructure/catalog"
	"ms-core/internal/platform/apperr"
	"ms-core/internal/platform/authguard"
	"ms-core/internal/platform/config"
	"ms-core/internal/platform/httpx"
	"ms-core/internal/platform/licensegate"
	"ms-core/internal/platform/security"
)

const (
	sessionCookieName = "pk_session"
	sessionTTL        = 12 * time.Hour
	passportTTL       = 25 * time.Second
)

var reservedAPIPrefixes = []string{
	"/api/v1/core",
	"/api/v1/auth",
	"/api/v1/gateway",
	"/api/v1/s2s",
	"/api/v1/system",
	"/api/v1/platform",
	"/api/v1/bootstrap",
	"/api/v1/tenants",
	"/api/v1/health",
}

var s2sAllowedTargets = map[string][]string{
	"ms-facturacion": {
		"ms-inventario",
		"ms-clientes",
		"ms-taller",
		"ms-hoteleria",
		"ms-comandas",
		"ms-impresiones",
		"ms-platform",
	},
	"ms-compras": {
		"ms-inventario",
		"ms-impresiones",
		"ms-platform",
	},
}

type upstreamEntry struct {
	serviceKey string
	apiPrefix  string
	targetURL  string
	proxy      *httputil.ReverseProxy
}

type GatewayServer struct {
	cfg         config.CoreConfig
	privKey     ed25519.PrivateKey
	pubKey      ed25519.PublicKey
	svc         *application.CoreService
	cat         *catalog.Provider
	staticFS    fs.FS
	transport   *http.Transport
	s2sReplay   *security.ReplayGuard
	mu          sync.RWMutex
	upstreams   map[string]upstreamEntry
	byServiceID map[string]upstreamEntry
}

func NewGatewayServer(
	cfg config.CoreConfig,
	privKey ed25519.PrivateKey,
	svc *application.CoreService,
	cat *catalog.Provider,
	staticFS fs.FS,
) *GatewayServer {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   3 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          256,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 15 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	var pubKey ed25519.PublicKey
	if len(privKey) == ed25519.PrivateKeySize {
		pubKey = privKey.Public().(ed25519.PublicKey)
	}

	g := &GatewayServer{
		cfg:         cfg,
		privKey:     privKey,
		pubKey:      pubKey,
		svc:         svc,
		cat:         cat,
		staticFS:    staticFS,
		transport:   transport,
		s2sReplay:   security.NewReplayGuard(32768),
		upstreams:   make(map[string]upstreamEntry),
		byServiceID: make(map[string]upstreamEntry),
	}
	if cfg.PlatformUpstreamURL != "" {
		g.RegisterUpstream("ms-platform", "/api/v1/platform", cfg.PlatformUpstreamURL)
	}
	for _, m := range cat.Catalog() {
		envName := catalog.ServiceEnvVar(m.ServiceKey)
		if rawURL := strings.TrimSpace(os.Getenv(envName)); rawURL != "" {
			g.RegisterUpstream(m.ServiceKey, m.APIPrefix, rawURL)
		}
	}
	return g
}

func (g *GatewayServer) RegisterUpstream(serviceKey, apiPrefix, upstreamURL string) {
	trimmedPrefix := "/" + strings.Trim(strings.TrimSpace(apiPrefix), "/")
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(upstreamURL), "/"))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(parsed)
	proxy.Transport = g.transport
	origDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		origDirector(req)
		req.Host = parsed.Host
		req.Header.Del("Cookie")
		req.Header.Del("Authorization")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		httpx.Error(w, http.StatusBadGateway, "El servicio independiente "+serviceKey+" no se encuentra disponible temporalmente")
	}

	entry := upstreamEntry{
		serviceKey: serviceKey,
		apiPrefix:  trimmedPrefix,
		targetURL:  parsed.String(),
		proxy:      proxy,
	}
	g.mu.Lock()
	g.upstreams[trimmedPrefix] = entry
	g.byServiceID[serviceKey] = entry
	g.mu.Unlock()
}

func validateDynamicRegistration(manifest licensegate.ServiceManifest, rawServiceURL string) error {
	svcKey := strings.TrimSpace(manifest.ServiceKey)
	if svcKey == "ms-core" {
		return apperr.Forbidden("No está permitido sobreescribir el plano de control ms-core")
	}
	prefix := path.Clean("/" + strings.Trim(strings.TrimSpace(manifest.APIPrefix), "/"))
	if svcKey == "ms-platform" {
		if prefix != "/api/v1/platform" {
			return apperr.Validation("El servicio ms-platform debe utilizar /api/v1/platform")
		}
	} else {
		if !strings.HasPrefix(prefix, "/api/v1/") || prefix == "/api/v1" {
			return apperr.Validation("El apiPrefix del microservicio debe pertenecer a /api/v1/<servicio>")
		}
		for _, reserved := range reservedAPIPrefixes {
			if prefix == reserved || strings.HasPrefix(prefix, reserved+"/") {
				return apperr.Forbidden("El apiPrefix solicitado colisiona con una ruta reservada del Gateway")
			}
		}
	}

	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(rawServiceURL), "/"))
	if err != nil || parsed.Host == "" || parsed.User != nil {
		return apperr.Validation("La dirección serviceUrl del microservicio es inválida")
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return apperr.Validation("El esquema de serviceUrl debe ser http o https")
	}
	hostOnly := parsed.Hostname()
	if ip := net.ParseIP(hostOnly); ip != nil {
		if ip.IsUnspecified() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
			return apperr.Forbidden("Dirección IP de destino rechazada por política anti-SSRF")
		}
	}
	return nil
}

func isAllowedS2SCall(callerAudience, targetService string) bool {
	if targetService == "ms-platform" || targetService == "ms-impresiones" {
		return strings.HasPrefix(callerAudience, "ms-") && callerAudience != "ms-core"
	}
	allowed, ok := s2sAllowedTargets[callerAudience]
	if !ok {
		return false
	}
	return containsExact(allowed, targetService)
}

func (g *GatewayServer) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(g.cfg.AllowedOrigins))

	r.Get("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-core"})
	})

	r.Route("/api/v1/core", func(cr chi.Router) {
		cr.Get("/public-catalog", g.handlePublicCatalog)
		cr.Post("/demo-session", g.handleDemoSession)
		cr.Post("/login", g.handleLogin)
		cr.Post("/register", g.handleRegister)
		cr.Post("/logout", g.handleLogout)
		cr.Get("/bootstrap", g.handleBootstrap)
		cr.Post("/impersonate", g.handleImpersonate)
		cr.Post("/tenants", g.handleAdminCreateTenant)
		cr.Put("/tenants/{tenantId}/subscriptions", g.handleUpdateSubscriptions)
		cr.Put("/tenants/{tenantId}/status", g.handleUpdateTenantStatus)
		cr.Put("/tenants/{tenantId}/quotas", g.handleUpdateTenantQuotas)
		cr.Get("/tenants/{tenantId}/users", g.handleAdminListTenantUsers)
		cr.Post("/tenants/{tenantId}/users", g.handleAdminCreateTenantUser)
		cr.Get("/activation-requests", g.handleListActivationRequests)

		cr.Route("/company", func(cc chi.Router) {
			cc.Get("/users", g.handleListCompanyUsers)
			cc.Post("/users", g.handleCreateCompanyUser)
			cc.Put("/users/{userId}", g.handleUpdateCompanyUser)
			cc.Delete("/users/{userId}", g.handleDeleteCompanyUser)
			cc.Post("/activate-modules", g.handleSelfActivateModules)
			cc.Get("/activation-requests", g.handleListActivationRequests)
		})
	})

	r.Route("/api/v1/auth", func(ar chi.Router) {
		ar.Post("/login", g.handleLogin)
		ar.Post("/register-tenant", g.handleRegister)
		ar.Post("/logout", g.handleLogout)
		ar.Post("/impersonate/{tenantId}", g.handleImpersonateByURL)
	})
	r.Get("/api/v1/bootstrap", g.handleBootstrap)
	r.Post("/api/v1/tenants", g.handleAdminCreateTenant)
	r.Put("/api/v1/tenants/{tenantId}/subscriptions", g.handleUpdateSubscriptions)
	r.Put("/api/v1/tenants/{tenantId}/status", g.handleUpdateTenantStatus)

	r.Get("/api/v1/gateway/public-key", g.handleGatewayPublicKey)
	r.Post("/api/v1/gateway/register", g.handleGatewayRegister)
	r.Get("/api/v1/system/license/{tenantId}", g.handleSystemLicense)

	r.HandleFunc("/api/v1/platform", g.handlePlatformProxy)
	r.HandleFunc("/api/v1/platform/*", g.handlePlatformProxy)
	r.HandleFunc("/api/v1/s2s/{targetService}/*", g.handleS2SBus)
	r.HandleFunc("/api/v1/*", g.handleServiceProxy)

	if g.staticFS != nil {
		fileServer := http.FileServer(http.FS(g.staticFS))
		computePathETag := func(p string) string {
			if raw, readErr := fs.ReadFile(g.staticFS, p); readErr == nil && len(raw) > 0 {
				sum := sha256.Sum256(raw)
				return `"` + hex.EncodeToString(sum[:8]) + `"`
			}
			return ""
		}
		matchesETag := func(headerVal, etag string) bool {
			for _, part := range strings.Split(headerVal, ",") {
				cand := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(part), "W/"))
				if cand == "*" || (etag != "" && cand == etag) {
					return true
				}
			}
			return false
		}
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			cleanPath := strings.TrimPrefix(req.URL.Path, "/")
			if cleanPath == "" {
				cleanPath = "index.html"
			}
			if f, err := g.staticFS.Open(cleanPath); err == nil {
				_ = f.Close()
				if etag := computePathETag(cleanPath); etag != "" {
					w.Header().Set("ETag", etag)
					if cleanPath != "index.html" && matchesETag(req.Header.Get("If-None-Match"), etag) {
						w.Header().Set("Cache-Control", "no-cache, must-revalidate")
						w.WriteHeader(http.StatusNotModified)
						return
					}
				}
				if cleanPath == "index.html" {
					w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
					w.Header().Set("Pragma", "no-cache")
				} else {
					w.Header().Set("Cache-Control", "no-cache, must-revalidate")
				}
				fileServer.ServeHTTP(w, req)
				return
			}
			if etag := computePathETag("index.html"); etag != "" {
				w.Header().Set("ETag", etag)
			}
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			req.URL.Path = "/"
			fileServer.ServeHTTP(w, req)
		})
	}

	return r
}

func (g *GatewayServer) handleGatewayPublicKey(w http.ResponseWriter, r *http.Request) {
	if !security.VerifyS2SKey(g.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
		httpx.Error(w, http.StatusUnauthorized, "credencial S2S inválida")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"publicKeyHex": hex.EncodeToString(g.pubKey),
	})
}

func (g *GatewayServer) handleGatewayRegister(w http.ResponseWriter, r *http.Request) {
	if !security.VerifyS2SKey(g.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
		httpx.Error(w, http.StatusUnauthorized, "credencial S2S inválida")
		return
	}
	var body struct {
		ServiceURL string                      `json:"serviceUrl"`
		Manifest   licensegate.ServiceManifest `json:"manifest"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if err := licensegate.ValidateCatalog([]licensegate.ServiceManifest{body.Manifest}); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if strings.TrimSpace(body.ServiceURL) == "" || strings.TrimSpace(body.Manifest.APIPrefix) == "" {
		httpx.Error(w, http.StatusBadRequest, "serviceUrl y apiPrefix son obligatorios para registrar el microservicio")
		return
	}
	if err := validateDynamicRegistration(body.Manifest, body.ServiceURL); err != nil {
		httpx.RespondError(w, err)
		return
	}
	if body.Manifest.ServiceKey != "ms-platform" {
		g.cat.Upsert(body.Manifest)
	}
	g.RegisterUpstream(body.Manifest.ServiceKey, body.Manifest.APIPrefix, body.ServiceURL)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"registered": body.Manifest.ServiceKey,
	})
}

func (g *GatewayServer) handleSystemLicense(w http.ResponseWriter, r *http.Request) {
	if !security.VerifyS2SKey(g.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
		httpx.Error(w, http.StatusUnauthorized, "credencial S2S inválida")
		return
	}
	tID := chi.URLParam(r, "tenantId")
	ten, err := g.svc.GetTenant(r.Context(), tID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"tenant": ten,
	})
}

func (g *GatewayServer) handlePlatformProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		tc, authErr := g.authenticateRequest(r)
		if authErr != nil || tc.Role != domain.RoleSuperAdmin {
			httpx.Error(w, http.StatusForbidden, "Operación de escritura reservada a la administración de plataforma")
			return
		}
	}
	g.mu.RLock()
	entry, ok := g.byServiceID["ms-platform"]
	g.mu.RUnlock()
	if !ok || entry.proxy == nil {
		httpx.Error(w, http.StatusBadGateway, "El servicio de plataforma no está disponible temporalmente")
		return
	}
	passportTok, err := security.SignPassport(g.privKey, security.PassportClaims{
		Audience: "ms-platform",
		Scope:    "platform_public",
	}, passportTTL)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Error al firmar pasaporte interno")
		return
	}
	r.Header.Del(security.PassportHeader)
	r.Header.Del(security.S2SKeyHeader)
	r.Header.Set(security.PassportHeader, passportTok)
	r.Header.Set(security.S2SKeyHeader, g.cfg.S2SSharedKey)
	entry.proxy.ServeHTTP(w, r)
}

func (g *GatewayServer) handleS2SBus(w http.ResponseWriter, r *http.Request) {
	if !security.VerifyS2SKey(g.cfg.S2SSharedKey, r.Header.Get(security.S2SKeyHeader)) {
		httpx.Error(w, http.StatusUnauthorized, "acceso S2S denegado: credencial inválida")
		return
	}
	targetService := strings.TrimSpace(chi.URLParam(r, "targetService"))
	restPath := path.Clean("/" + strings.TrimLeft(chi.URLParam(r, "*"), "/"))
	if targetService == "" {
		httpx.Error(w, http.StatusBadRequest, "microservicio destino requerido")
		return
	}

	rawCallerPassport := r.Header.Get(security.PassportHeader)
	hopNonce := r.Header.Get(security.HopNonceHeader)
	hopSig := r.Header.Get(security.HopSigHeader)
	if !security.VerifyHopMAC(g.cfg.S2SSharedKey, rawCallerPassport, hopNonce, r.Method, targetService, restPath, hopSig) {
		httpx.Error(w, http.StatusUnauthorized, "acceso S2S denegado: firma de salto S2S inválida o ausente")
		return
	}
	claims, err := security.VerifyHopPassport(g.pubKey, rawCallerPassport, hopNonce, g.s2sReplay)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "acceso S2S denegado: pasaporte origen o hop nonce inválido")
		return
	}
	if !isAllowedS2SCall(claims.Audience, targetService) {
		httpx.Error(w, http.StatusForbidden, "acceso S2S denegado: relación entre servicios no autorizada")
		return
	}

	liveTenant, err := g.svc.GetTenant(r.Context(), claims.TenantID)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "empresa asociada al pasaporte no encontrada")
		return
	}
	if strings.EqualFold(strings.TrimSpace(liveTenant.Status), "SUSPENDED") {
		httpx.Error(w, http.StatusForbidden, "La suscripción de esta empresa se encuentra suspendida")
		return
	}
	if targetService != "ms-platform" && !containsExact(liveTenant.ActiveServices, targetService) {
		httpx.Error(w, http.StatusForbidden, "El microservicio "+targetService+" no está activo en la suscripción de esta empresa")
		return
	}

	g.mu.RLock()
	entry, found := g.byServiceID[targetService]
	g.mu.RUnlock()
	if !found || entry.proxy == nil {
		httpx.Error(w, http.StatusBadGateway, "Dirección de red no registrada en Gateway para "+targetService)
		return
	}

	freshPassport, err := security.SignPassport(g.privKey, security.PassportClaims{
		TenantID:         liveTenant.TenantID,
		DBName:           liveTenant.DBName,
		Username:         claims.Username,
		Role:             claims.Role,
		Audience:         targetService,
		Scope:            security.ScopeS2SInternal,
		ActiveServices:   liveTenant.ActiveServices,
		ActiveModules:    liveTenant.ActiveModules,
		ActiveSubmodules: liveTenant.ActiveSubmodules,
		ActiveFeatures:   liveTenant.ActiveFeatures,
	}, passportTTL)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Error al firmar pasaporte S2S de destino")
		return
	}

	r.URL.Path = restPath
	r.URL.RawPath = ""
	r.Header.Del(security.HopNonceHeader)
	r.Header.Del(security.HopSigHeader)
	r.Header.Set(security.PassportHeader, freshPassport)
	r.Header.Set(security.S2SKeyHeader, g.cfg.S2SSharedKey)
	entry.proxy.ServeHTTP(w, r)
}

func (g *GatewayServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	user := strings.TrimSpace(body.Username)
	if user == "" {
		user = strings.TrimSpace(body.Email)
	}
	out, err := g.svc.Authenticate(r.Context(), user, body.Password)
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
		"ok":             true,
		"token":          tok,
		"role":           out.Role,
		"internalRole":   out.InternalRole,
		"username":       out.Username,
		"fullName":       out.FullName,
		"isCompanyAdmin": out.IsCompanyAdmin,
		"isDemo":         out.IsDemo,
		"tenant":         out.Tenant,
		"companyTenant":  out.CompanyTenant,
	})
}

func (g *GatewayServer) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in domain.CreateTenantInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.RegisterTenant(r.Context(), in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	if existingTC, authErr := g.authenticateRequest(r); authErr == nil && existingTC.Role == domain.RoleSuperAdmin {
		httpx.JSON(w, http.StatusCreated, map[string]any{
			"ok":     true,
			"role":   domain.RoleSuperAdmin,
			"tenant": ten,
		})
		return
	}
	fullName := strings.TrimSpace(in.AdminFullName)
	if fullName == "" {
		fullName = "Administrador " + ten.CompanyName
	}
	out := application.AuthOutput{
		Tenant:         ten,
		CompanyTenant:  ten.Clone(),
		UserID:         "usr_" + ten.TenantID,
		Role:           domain.RoleCliente,
		InternalRole:   "admin_empresa",
		Username:       ten.AdminUsername,
		FullName:       fullName,
		IsCompanyAdmin: true,
		IsDemo:         ten.IsDemo,
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible emitir la sesión")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":             true,
		"token":          tok,
		"role":           domain.RoleCliente,
		"internalRole":   "admin_empresa",
		"username":       ten.AdminUsername,
		"fullName":       fullName,
		"isCompanyAdmin": true,
		"tenant":         ten,
		"companyTenant":  ten.Clone(),
	})
}

func (g *GatewayServer) handleAdminCreateTenant(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var in domain.CreateTenantInput
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.ProvisionTenantAsSuperAdmin(r.Context(), tc.Role, in)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"tenant": ten,
	})
}

func (g *GatewayServer) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
	})
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (g *GatewayServer) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	out, err := g.svc.Bootstrap(r.Context(), tc)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"catalog":       out.Catalog,
		"tenant":        out.Tenant,
		"companyTenant": out.CompanyTenant,
		"tenants":       out.Tenants,
		"userRole":      out.UserRole,
		"username":      tc.Username,
		"userProfile":   out.UserProfile,
		"presets":       out.Presets,
		"pricing":       out.Pricing,
		"roleTemplates": out.RoleTemplates,
	})
}

func (g *GatewayServer) handleImpersonate(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	var body struct {
		TenantID string `json:"tenantId"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	g.finishImpersonate(w, r, tc, body.TenantID)
}

func (g *GatewayServer) handleImpersonateByURL(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	g.finishImpersonate(w, r, tc, chi.URLParam(r, "tenantId"))
}

func (g *GatewayServer) finishImpersonate(w http.ResponseWriter, r *http.Request, tc authguard.TenantContext, targetTenantID string) {
	ten, err := g.svc.Impersonate(r.Context(), tc.Role, targetTenantID)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	out := application.AuthOutput{
		Tenant:         ten,
		CompanyTenant:  ten.Clone(),
		UserID:         "superadmin",
		Role:           tc.Role,
		InternalRole:   "superadmin",
		Username:       tc.Username,
		FullName:       "SuperAdministrador Corporativo",
		IsCompanyAdmin: true,
		IsDemo:         ten.IsDemo,
	}
	tok, err := g.issueAuthSession(w, r, out)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "No fue posible actualizar la sesión")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":             true,
		"token":          tok,
		"role":           tc.Role,
		"internalRole":   "superadmin",
		"username":       tc.Username,
		"isCompanyAdmin": true,
		"tenant":         ten,
		"companyTenant":  ten.Clone(),
	})
}

func (g *GatewayServer) handleUpdateSubscriptions(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
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
	ten, err := g.svc.UpdateSubscriptions(r.Context(), tc.Role, tID, body.ActiveServices, body.ActiveModules, body.ActiveSubmodules, body.ActiveFeatures)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"tenant": ten,
	})
}

func (g *GatewayServer) handleUpdateTenantStatus(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	tID := chi.URLParam(r, "tenantId")
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(w, r, &body); err != nil {
		httpx.RespondError(w, err)
		return
	}
	ten, err := g.svc.SetTenantStatus(r.Context(), tc.Role, tID, body.Status)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"tenant": ten,
	})
}

func (g *GatewayServer) handleServiceProxy(w http.ResponseWriter, r *http.Request) {
	tc, err := g.authenticateRequest(r)
	if err != nil {
		httpx.RespondError(w, err)
		return
	}

	cleanPath := path.Clean("/" + strings.TrimLeft(r.URL.Path, "/"))
	if strings.Contains(cleanPath, "/internal-s2s") {
		httpx.Error(w, http.StatusForbidden, "Ruta reservada exclusivamente al bus interno S2S")
		return
	}

	serviceKey, prefix, entry, found := g.matchServiceRoute(cleanPath)
	if !found {
		httpx.Error(w, http.StatusNotFound, "Ruta de servicio no registrada")
		return
	}
	if !containsExact(tc.ActiveServices, serviceKey) {
		httpx.Error(w, http.StatusForbidden, "No tienes acceso habilitado al área de "+g.svc.ServiceDisplayName(serviceKey))
		return
	}
	if entry.proxy == nil {
		httpx.Error(w, http.StatusBadGateway, "Servicio temporalmente no disponible ("+prefix+")")
		return
	}

	passportTok, err := security.SignPassport(g.privKey, security.PassportClaims{
		TenantID:         tc.TenantID,
		DBName:           tc.DBName,
		Username:         tc.Username,
		Role:             tc.Role,
		Audience:         serviceKey,
		ActiveServices:   tc.ActiveServices,
		ActiveModules:    tc.ActiveModules,
		ActiveSubmodules: tc.ActiveSubmodules,
		ActiveFeatures:   tc.ActiveFeatures,
	}, passportTTL)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "Error al firmar pasaporte S2S")
		return
	}

	r.URL.Path = cleanPath
	r.URL.RawPath = ""
	r.Header.Del(security.PassportHeader)
	r.Header.Del(security.S2SKeyHeader)
	r.Header.Set(security.PassportHeader, passportTok)
	r.Header.Set(security.S2SKeyHeader, g.cfg.S2SSharedKey)
	entry.proxy.ServeHTTP(w, r)
}

func (g *GatewayServer) matchServiceRoute(reqPath string) (string, string, upstreamEntry, bool) {
	for _, m := range g.cat.Catalog() {
		pfx := "/" + strings.Trim(m.APIPrefix, "/")
		if reqPath == pfx || strings.HasPrefix(reqPath, pfx+"/") {
			g.mu.RLock()
			up := g.upstreams[pfx]
			g.mu.RUnlock()
			return m.ServiceKey, pfx, up, true
		}
	}
	return "", "", upstreamEntry{}, false
}

func (g *GatewayServer) issueAuthSession(w http.ResponseWriter, r *http.Request, out application.AuthOutput) (string, error) {
	claims := authguard.TenantContext{
		TenantID:         out.Tenant.TenantID,
		UserID:           out.UserID,
		DBName:           out.Tenant.DBName,
		Username:         out.Username,
		FullName:         out.FullName,
		Role:             out.Role,
		InternalRole:     out.InternalRole,
		IsCompanyAdmin:   out.IsCompanyAdmin,
		IsDemo:           out.IsDemo,
		ActiveServices:   out.Tenant.ActiveServices,
		ActiveModules:    out.Tenant.ActiveModules,
		ActiveSubmodules: out.Tenant.ActiveSubmodules,
		ActiveFeatures:   out.Tenant.ActiveFeatures,
	}
	tok, err := authguard.SignJWT(g.cfg.JWTSecret, claims, sessionTTL)
	if err != nil {
		return "", err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    tok,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		Secure:   r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"),
	})
	return tok, nil
}

func (g *GatewayServer) authenticateRequest(r *http.Request) (authguard.TenantContext, error) {
	rawTok := ""
	authHdr := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(authHdr, "Bearer ") {
		rawTok = strings.TrimSpace(strings.TrimPrefix(authHdr, "Bearer "))
	} else if c, err := r.Cookie(sessionCookieName); err == nil && strings.TrimSpace(c.Value) != "" {
		rawTok = strings.TrimSpace(c.Value)
	}
	if rawTok == "" {
		return authguard.TenantContext{}, apperr.Unauthorized("Autenticación requerida")
	}

	tc, err := authguard.VerifyJWT(g.cfg.JWTSecret, rawTok)
	if err != nil {
		return authguard.TenantContext{}, apperr.Unauthorized("Sesión inválida o expirada")
	}
	resolved, _, err := g.svc.ResolveLiveSession(r.Context(), tc)
	if err != nil {
		return authguard.TenantContext{}, err
	}
	return resolved, nil
}

func containsExact(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}
