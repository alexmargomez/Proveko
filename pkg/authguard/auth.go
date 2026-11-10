package authguard

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

type ctxKey struct{}

type TenantContext struct {
	TenantID       string   `json:"tenant_id"`
	DBName         string   `json:"db_name"`
	Username       string   `json:"username"`
	Role           string   `json:"role"`
	ActiveServices []string `json:"active_services"`
	ActiveModules  []string `json:"active_modules"`
	ActiveFeatures []string `json:"active_features"`
	Exp            int64    `json:"exp"`
}

func WithContext(ctx context.Context, tc TenantContext) context.Context {
	return context.WithValue(ctx, ctxKey{}, tc)
}

func FromContext(ctx context.Context) TenantContext {
	if v, ok := ctx.Value(ctxKey{}).(TenantContext); ok {
		return v
	}
	return TenantContext{
		TenantID: "demo-empresa",
		DBName:   "db_demo_empresa",
		Username: "demo@proveko.com",
		Role:     "cliente",
	}
}

func HashPassword(password, salt string) string {
	hash := argon2.IDKey([]byte(password), []byte(salt), 1, 32*1024, 2, 32)
	return hex.EncodeToString(hash)
}

func SignJWT(secret string, claims TenantContext, ttl time.Duration) (string, error) {
	claims.Exp = time.Now().Add(ttl).Unix()
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	bodyBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(bodyBytes)
	unsigned := header + "." + body
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(unsigned))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return unsigned + "." + sig, nil
}

func VerifyJWT(secret, token string) (TenantContext, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return TenantContext{}, errors.New("malformed jwt")
	}
	unsigned := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(unsigned))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return TenantContext{}, errors.New("invalid jwt signature")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return TenantContext{}, err
	}
	var tc TenantContext
	if err := json.Unmarshal(raw, &tc); err != nil {
		return TenantContext{}, err
	}
	if tc.Exp > 0 && time.Now().Unix() > tc.Exp {
		return TenantContext{}, errors.New("expired jwt")
	}
	return tc, nil
}

func SignInternalHeaders(clusterSecret, tenantID, dbName string) string {
	mac := hmac.New(sha256.New, []byte(clusterSecret))
	mac.Write([]byte(tenantID + "|" + dbName))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyInternalHeaders(clusterSecret, tenantID, dbName, sig string) bool {
	return hmac.Equal([]byte(SignInternalHeaders(clusterSecret, tenantID, dbName)), []byte(sig))
}

func PropagateHeadersToContext(clusterSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tID := r.Header.Get("X-Tenant-Id")
			dbN := r.Header.Get("X-Tenant-Db")
			sig := r.Header.Get("X-Cluster-Sig")
			if tID != "" && dbN != "" && (clusterSecret == "" || VerifyInternalHeaders(clusterSecret, tID, dbN, sig)) {
				tc := TenantContext{
					TenantID:       tID,
					DBName:         dbN,
					Username:       r.Header.Get("X-User-Name"),
					Role:           r.Header.Get("X-User-Role"),
					ActiveServices: splitCSV(r.Header.Get("X-Active-Services")),
					ActiveModules:  splitCSV(r.Header.Get("X-Active-Modules")),
					ActiveFeatures: splitCSV(r.Header.Get("X-Active-Features")),
				}
				r = r.WithContext(WithContext(r.Context(), tc))
			}
			next.ServeHTTP(w, r)
		})
	}
}

func splitCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return out
}
