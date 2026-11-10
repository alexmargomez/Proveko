package gateway

import (
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/alexmargomez/proveko/core/backend/auth"
	"github.com/alexmargomez/proveko/core/backend/provisioning"
	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/config"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type ServiceTarget struct {
	ServiceKey    string
	APIPrefix     string
	LocalHandler  http.Handler
	UpstreamURL   string
}

type Gateway struct {
	cfg      config.Config
	reg      *provisioning.Registry
	authHdl  *auth.Handler
	targets  map[string]ServiceTarget
	staticFS fs.FS
}

func New(cfg config.Config, reg *provisioning.Registry, staticFS fs.FS) *Gateway {
	return &Gateway{
		cfg:      cfg,
		reg:      reg,
		authHdl:  auth.NewHandler(cfg, reg),
		targets:  make(map[string]ServiceTarget),
		staticFS: staticFS,
	}
}

func (g *Gateway) RegisterService(t ServiceTarget) {
	g.targets[t.APIPrefix] = t
}

func (g *Gateway) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS)

	r.Get("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "engine": "proveko-go-chi-grpc-v3"})
	})

	r.Route("/api/v1/core", func(cr chi.Router) {
		cr.Get("/bootstrap", g.authHdl.Bootstrap)
		cr.Post("/login", g.authHdl.Login)
		cr.Post("/register", g.authHdl.RegisterCompany)
		cr.Put("/tenants/{tenantId}/subscriptions", g.authHdl.UpdateSubscriptions)
	})

	for prefix, target := range g.targets {
		pfx := prefix
		tgt := target
		var downstream http.Handler
		if tgt.UpstreamURL != "" {
			if parsed, err := url.Parse(tgt.UpstreamURL); err == nil {
				downstream = httputil.NewSingleHostReverseProxy(parsed)
			}
		}
		if downstream == nil {
			downstream = tgt.LocalHandler
		}
		if downstream == nil {
			continue
		}

		r.Route(pfx, func(sr chi.Router) {
			sr.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
					tc := g.authHdl.ResolveContext(req)
					if !contains(tc.ActiveServices, tgt.ServiceKey) {
						httpx.Error(w, http.StatusForbidden, "El microservicio "+tgt.ServiceKey+" está desactivado para esta empresa")
						return
					}
					req.Header.Set("X-Tenant-Id", tc.TenantID)
					req.Header.Set("X-Tenant-Db", tc.DBName)
					req.Header.Set("X-User-Name", tc.Username)
					req.Header.Set("X-User-Role", tc.Role)
					req.Header.Set("X-Active-Services", strings.Join(tc.ActiveServices, ","))
					req.Header.Set("X-Active-Modules", strings.Join(tc.ActiveModules, ","))
					req.Header.Set("X-Active-Features", strings.Join(tc.ActiveFeatures, ","))
					req.Header.Set("X-Cluster-Sig", authguard.SignInternalHeaders(g.cfg.ClusterSecret, tc.TenantID, tc.DBName))
					next.ServeHTTP(w, req)
				})
			})
			sr.Mount("/", downstream)
		})
	}

	if g.staticFS != nil {
		fileServer := http.FileServer(http.FS(g.staticFS))
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			path := strings.TrimPrefix(req.URL.Path, "/")
			if path == "" {
				path = "index.html"
			}
			if f, err := g.staticFS.Open(path); err == nil {
				_ = f.Close()
				fileServer.ServeHTTP(w, req)
				return
			}
			req.URL.Path = "/"
			fileServer.ServeHTTP(w, req)
		})
	}

	return r
}

func contains(list []string, target string) bool {
	for _, s := range list {
		if s == target || s == "*" {
			return true
		}
	}
	return false
}
