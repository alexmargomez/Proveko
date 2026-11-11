package httpx

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"ms-reportes/internal/platform/apperr"
	"ms-reportes/internal/platform/authguard"
	"ms-reportes/internal/platform/security"
)

const DefaultMaxBodyBytes int64 = 1 << 20

func JSON(w http.ResponseWriter, status int, payload any) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	if err := enc.Encode(payload); err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"ok":false,"error":"error al serializar respuesta"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]any{
		"ok":    false,
		"error": message,
	})
}

func RespondError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	Error(w, apperr.HTTPStatus(err), err.Error())
}

func Decode(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, DefaultMaxBodyBytes)
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return apperr.PayloadTooLarge("El tamaño de la solicitud excede el límite permitido (1 MB)")
		}
		return apperr.Validation("Formato de datos JSON inválido")
	}
	return nil
}

func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allowSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowSet[strings.TrimSpace(o)] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && (allowSet[origin] || allowSet["*"]) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isExactEndpoint(method, urlPath, endpoint string) bool {
	if method != http.MethodGet && method != http.MethodHead {
		return false
	}
	if urlPath == "/"+endpoint {
		return true
	}
	parts := strings.Split(strings.Trim(urlPath, "/"), "/")
	return len(parts) == 4 && parts[0] == "api" && parts[1] == "v1" && parts[3] == endpoint
}

func isInternalS2SRoute(urlPath string) bool {
	return urlPath == "/internal-s2s" ||
		strings.HasPrefix(urlPath, "/internal-s2s/") ||
		strings.Contains(urlPath, "/internal-s2s/") ||
		strings.HasSuffix(urlPath, "/internal-s2s")
}

func RequireServicePassport(serviceKey string, pub ed25519.PublicKey, s2sKey string, replay *security.ReplayGuard) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isExactEndpoint(r.Method, r.URL.Path, "health") {
				next.ServeHTTP(w, r)
				return
			}
			if !security.VerifyS2SKey(s2sKey, r.Header.Get(security.S2SKeyHeader)) {
				Error(w, http.StatusUnauthorized, "acceso denegado: credencial S2S inválida")
				return
			}
			rawPassport := r.Header.Get(security.PassportHeader)
			claims, err := security.VerifyPassport(pub, rawPassport, serviceKey, replay)
			if err != nil {
				Error(w, http.StatusUnauthorized, "acceso denegado: pasaporte Ed25519 ausente, expirado o inválido")
				return
			}
			if claims.Scope == "catalog_sync" && isExactEndpoint(r.Method, r.URL.Path, "manifest") {
				next.ServeHTTP(w, r)
				return
			}
			if isInternalS2SRoute(r.URL.Path) && claims.Scope != security.ScopeS2SInternal {
				Error(w, http.StatusForbidden, "acceso denegado: endpoint reservado exclusivamente al bus S2S del Gateway")
				return
			}
			if serviceKey == "ms-platform" && claims.Scope == "platform_public" {
				next.ServeHTTP(w, r)
				return
			}
			if serviceKey != "" && serviceKey != "ms-core" && serviceKey != "ms-platform" && !hasService(claims.ActiveServices, serviceKey) {
				Error(w, http.StatusForbidden, "el microservicio "+serviceKey+" no está activo en la suscripción")
				return
			}

			tc := authguard.TenantContext{
				TenantID:       claims.TenantID,
				DBName:         claims.DBName,
				Username:       claims.Username,
				Role:           claims.Role,
				ActiveServices:   claims.ActiveServices,
				ActiveModules:    claims.ActiveModules,
				ActiveSubmodules: claims.ActiveSubmodules,
				ActiveFeatures:   claims.ActiveFeatures,
				IdempotencyKey: strings.TrimSpace(r.Header.Get("Idempotency-Key")),
				RawPassport:    rawPassport,
			}
			next.ServeHTTP(w, r.WithContext(authguard.WithContext(r.Context(), tc)))
		})
	}
}

func hasService(list []string, target string) bool {
	for _, s := range list {
		if s == target {
			return true
		}
	}
	return false
}

func NewServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}
}

func ListenAndServeGraceful(srv *http.Server, onShutdown func()) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		if onShutdown != nil {
			onShutdown()
		}
		return err
	case <-ctx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		err := srv.Shutdown(shutCtx)
		if onShutdown != nil {
			onShutdown()
		}
		return err
	}
}
