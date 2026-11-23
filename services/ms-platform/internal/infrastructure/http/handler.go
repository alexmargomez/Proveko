package httpadapter

import (
	"crypto/ed25519"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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

var (
	etagManifest   = computeETag(msplatform.ManifestJSON)
	etagUiSdkJS    = computeETag(uiSdkJS)
	etagReactShim  = computeETag(reactShimJS)
	etagReactDom   = computeETag(reactDomShimJS)
	etagJsxRuntime = computeETag(jsxRuntimeShimJS)
	etagThemeCSS   = computeETag(themeCSS)
	etagUiSdkDTS   = computeETag(uiSdkDTS)
)

func computeETag(body []byte) string {
	sum := sha256.Sum256(body)
	return `"` + hex.EncodeToString(sum[:8]) + `"`
}

func resolvePlatformAsset(filename string, fallbackBody []byte, fallbackETag string) ([]byte, string) {
	liveDir := strings.TrimSpace(os.Getenv("LIVE_ASSETS_DIR"))
	if liveDir == "" {
		liveDir = "/app/assets"
	}
	raw, err := os.ReadFile(filepath.Join(liveDir, filepath.Base(filename)))
	if err == nil && len(raw) > 0 {
		return raw, computeETag(raw)
	}
	return fallbackBody, fallbackETag
}

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
	r.Get("/manifest", func(w http.ResponseWriter, req *http.Request) {
		writeAsset(w, req, "application/json; charset=utf-8", msplatform.ManifestJSON, etagManifest)
	})
	r.Get("/ui-sdk.js", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("ui-sdk.js", uiSdkJS, etagUiSdkJS)
		writeAsset(w, req, "application/javascript; charset=utf-8", body, etag)
	})
	r.Get("/react-shim.js", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("react-shim.js", reactShimJS, etagReactShim)
		writeAsset(w, req, "application/javascript; charset=utf-8", body, etag)
	})
	r.Get("/react-dom-shim.js", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("react-dom-shim.js", reactDomShimJS, etagReactDom)
		writeAsset(w, req, "application/javascript; charset=utf-8", body, etag)
	})
	r.Get("/jsx-runtime-shim.js", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("jsx-runtime-shim.js", jsxRuntimeShimJS, etagJsxRuntime)
		writeAsset(w, req, "application/javascript; charset=utf-8", body, etag)
	})
	r.Get("/theme.css", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("theme.css", themeCSS, etagThemeCSS)
		writeAsset(w, req, "text/css; charset=utf-8", body, etag)
	})
	r.Get("/ui-sdk.d.ts", func(w http.ResponseWriter, req *http.Request) {
		body, etag := resolvePlatformAsset("ui-sdk.d.ts", uiSdkDTS, etagUiSdkDTS)
		writeAsset(w, req, "text/plain; charset=utf-8", body, etag)
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

func writeAsset(w http.ResponseWriter, r *http.Request, contentType string, body []byte, etag string) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache, must-revalidate")
	w.Header().Set("ETag", etag)
	if r != nil {
		if inm := r.Header.Get("If-None-Match"); inm != "" {
			for _, candidate := range strings.Split(inm, ",") {
				c := strings.TrimPrefix(strings.TrimSpace(candidate), "W/")
				if c == etag || c == "*" {
					w.WriteHeader(http.StatusNotModified)
					return
				}
			}
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
