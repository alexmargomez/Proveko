package authguard

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

const expectedJWTHeaderB64 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

type ctxKey struct{}

type TenantContext struct {
	TenantID         string   `json:"tenant_id"`
	DBName           string   `json:"db_name"`
	Username         string   `json:"username"`
	Role             string   `json:"role"`
	ActiveServices   []string `json:"active_services"`
	ActiveModules    []string `json:"active_modules"`
	ActiveSubmodules []string `json:"active_submodules"`
	ActiveFeatures   []string `json:"active_features"`
	IdempotencyKey   string   `json:"-"`
	RawPassport      string   `json:"-"`
	Exp              int64    `json:"exp"`
}

func WithContext(ctx context.Context, tc TenantContext) context.Context {
	return context.WithValue(ctx, ctxKey{}, tc)
}

func FromContext(ctx context.Context) TenantContext {
	if v, ok := ctx.Value(ctxKey{}).(TenantContext); ok {
		return v
	}
	return TenantContext{}
}

func HashPassword(password string) (string, error) {
	if strings.TrimSpace(password) == "" {
		return "", errors.New("password cannot be empty")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 1, 32*1024, 2, 32)
	return fmt.Sprintf("argon2id$%s$%s", hex.EncodeToString(salt), hex.EncodeToString(hash)), nil
}

func VerifyPassword(password, encodedHash string) bool {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 3 || parts[0] != "argon2id" {
		return false
	}
	salt, err := hex.DecodeString(parts[1])
	if err != nil || len(salt) == 0 {
		return false
	}
	expectedHash, err := hex.DecodeString(parts[2])
	if err != nil || len(expectedHash) != 32 {
		return false
	}
	computed := argon2.IDKey([]byte(password), salt, 1, 32*1024, 2, 32)
	return subtle.ConstantTimeCompare(computed, expectedHash) == 1
}

func SignJWT(secret string, claims TenantContext, ttl time.Duration) (string, error) {
	if secret == "" {
		return "", errors.New("empty jwt secret")
	}
	if ttl <= 0 {
		ttl = 8 * time.Hour
	}
	claims.Exp = time.Now().Add(ttl).Unix()
	bodyBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(bodyBytes)
	unsigned := expectedJWTHeaderB64 + "." + body
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(unsigned))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return unsigned + "." + sig, nil
}

func VerifyJWT(secret, token string) (TenantContext, error) {
	if secret == "" {
		return TenantContext{}, errors.New("empty jwt secret")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != expectedJWTHeaderB64 {
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
	now := time.Now().Unix()
	if tc.Exp > 0 && now > tc.Exp {
		return TenantContext{}, errors.New("jwt expired")
	}
	return tc, nil
}
