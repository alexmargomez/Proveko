package httpadapter

import (
	"crypto/ed25519"
	_ "embed"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	msplatform "ms-platform"
	"ms-platform/internal/application"
	"ms-platform/internal/domain"
	"ms-platform/internal/platform/config"
	"ms-platform/internal/platform/httpx"
	"ms-platform/internal/platform/security"
)

//go:embed assets/ui-sdk.js
var uiSdkJS []byte

//go:embed assets/react-shim.js
var reactShimJS []byte

//go:embed assets/react-dom-shim.js
var reactDomShimJS []byte

//go:embed assets/jsx-runtime-shim.js
var jsxRuntimeShimJS []byte

//go:embed assets/theme.css
var themeCSS []byte

//go:embed assets/ui-sdk.d.ts
var uiSdkDTS []byte

type Handler struct {
	app *application.Service
	cfg config.ServiceConfig
	pub ed25519.PublicKey
	rg  *security.ReplayGuard
}

func NewHandler(app *application.Service, cfg config.ServiceConfig, pub ed25519.PublicKey, rg *security.ReplayGuard) *Handler {
	return &Handler{app: app, cfg: cfg, pub: pub, rg: rg}
}

func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.CORS(h.cfg.AllowedOrigins))

	healthFn := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "service": "ms-platform"})
	}
	r.Get("/health", healthFn)
	r.Get("/api/v1/platform/health", healthFn)

	r.Group(func(pr chi.Router) {
		pr.Use(httpx.RequireServicePassport("ms-platform", h.pub, h.cfg.S2SSharedKey, h.rg))
		h.mountRoutes(pr)
		pr.Route("/api/v1/platform", h.mountRoutes)
	})
	return r
}

func (h *Handler) mountRoutes(r chi.Router) {
	r.Get("/manifest", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "application/json; charset=utf-8", msplatform.ManifestJSON)
	})
	r.Get("/ui-sdk.js", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "application/javascript; charset=utf-8", uiSdkJS)
	})
	r.Get("/react-shim.js", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "application/javascript; charset=utf-8", reactShimJS)
	})
	r.Get("/react-dom-shim.js", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "application/javascript; charset=utf-8", reactDomShimJS)
	})
	r.Get("/jsx-runtime-shim.js", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "application/javascript; charset=utf-8", jsxRuntimeShimJS)
	})
	r.Get("/theme.css", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "text/css; charset=utf-8", themeCSS)
	})
	r.Get("/ui-sdk.d.ts", func(w http.ResponseWriter, _ *http.Request) {
		writeAsset(w, "text/plain; charset=utf-8", uiSdkDTS)
	})
	r.Get("/contracts", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"contracts": h.app.ListContracts(),
		})
	})
	r.Post("/contracts/register", func(w http.ResponseWriter, req *http.Request) {
		var spec domain.S2SContractSpec
		if err := httpx.Decode(w, req, &spec); err != nil {
			httpx.RespondError(w, err)
			return
		}
		saved, err := h.app.RegisterContract(spec)
		if err != nil {
			httpx.RespondError(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, map[string]any{"ok": true, "contract": saved})
	})
	r.Post("/contracts/validate", func(w http.ResponseWriter, req *http.Request) {
		var body struct {
			ContractKey string         `json:"contractKey"`
			Payload     map[string]any `json:"payload"`
		}
		if err := httpx.Decode(w, req, &body); err != nil {
			httpx.RespondError(w, err)
			return
		}
		res, err := h.app.ValidatePayload(body.ContractKey, body.Payload)
		if err != nil {
			httpx.RespondError(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "validation": res})
	})
	r.Get("/standards", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":        true,
			"standards": h.app.ListStandards(),
		})
	})
}

func writeAsset(w http.ResponseWriter, contentType string, body []byte) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
