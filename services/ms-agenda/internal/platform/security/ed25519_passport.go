package security

import (
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	PassportHeader   = "X-Service-Passport"
	S2SKeyHeader     = "X-S2S-Key"
	HopNonceHeader   = "X-S2S-Hop-Nonce"
	HopSigHeader     = "X-S2S-Hop-Sig"
	MeshAudience     = "s2s-mesh"
	ScopeS2SInternal = "s2s_internal"
	maxHopsPerRoot   = 16
)

var validTenantDBRegex = regexp.MustCompile("^db_[a-z0-9_]{3,50}$")

type PassportClaims struct {
	TenantID       string   `json:"tid"`
	DBName         string   `json:"db"`
	Username       string   `json:"usr"`
	Role           string   `json:"rol"`
	Audience       string   `json:"aud"`
	Scope          string   `json:"scp,omitempty"`
	ActiveServices   []string `json:"svc"`
	ActiveModules    []string `json:"mod"`
	ActiveSubmodules []string `json:"sub,omitempty"`
	ActiveFeatures   []string `json:"fea"`
	IssuedAtUnix   int64    `json:"iat"`
	ExpiresAtUnix  int64    `json:"exp"`
	Nonce          string   `json:"jti"`
}

type ReplayGuard struct {
	mu        sync.Mutex
	seen      map[string]int64
	hopCounts map[string]int
	maxSize   int
}

func NewReplayGuard(maxSize int) *ReplayGuard {
	if maxSize <= 0 {
		maxSize = 16384
	}
	return &ReplayGuard{
		seen:      make(map[string]int64, 1024),
		hopCounts: make(map[string]int, 256),
		maxSize:   maxSize,
	}
}

func (rg *ReplayGuard) CheckAndRecord(jti string, expiresAt int64) error {
	if rg == nil {
		return nil
	}
	if strings.TrimSpace(jti) == "" {
		return errors.New("missing passport jti")
	}
	now := time.Now().Unix()
	rg.mu.Lock()
	defer rg.mu.Unlock()

	if exp, exists := rg.seen[jti]; exists && exp >= now {
		return errors.New("replayed s2s passport detected")
	}
	if len(rg.seen) >= rg.maxSize {
		for k, exp := range rg.seen {
			if exp < now {
				delete(rg.seen, k)
			}
		}
		if len(rg.seen) >= rg.maxSize {
			var oldestKey string
			var oldestExp int64
			for k, exp := range rg.seen {
				if oldestKey == "" || exp < oldestExp {
					oldestKey = k
					oldestExp = exp
				}
			}
			if oldestKey != "" {
				delete(rg.seen, oldestKey)
			}
		}
	}
	rg.seen[jti] = expiresAt + 5
	return nil
}

func (rg *ReplayGuard) incrementHopCount(rootNonce string) error {
	if rg == nil || rootNonce == "" {
		return nil
	}
	rg.mu.Lock()
	defer rg.mu.Unlock()
	if len(rg.hopCounts) >= rg.maxSize {
		rg.hopCounts = make(map[string]int, 256)
	}
	next := rg.hopCounts[rootNonce] + 1
	if next > maxHopsPerRoot {
		return errors.New("s2s hop budget exceeded for passport")
	}
	rg.hopCounts[rootNonce] = next
	return nil
}

func LoadCoreKeyPair(privateHex, devSeed string, isProd bool) (ed25519.PrivateKey, ed25519.PublicKey, error) {
	if privateHex != "" {
		rawPriv, err := hex.DecodeString(strings.TrimSpace(privateHex))
		if err != nil {
			return nil, nil, errors.New("invalid CORE_PRIVATE_KEY hex")
		}
		if len(rawPriv) == ed25519.SeedSize {
			priv := ed25519.NewKeyFromSeed(rawPriv)
			return priv, priv.Public().(ed25519.PublicKey), nil
		}
		if len(rawPriv) == ed25519.PrivateKeySize {
			priv := ed25519.PrivateKey(rawPriv)
			return priv, priv.Public().(ed25519.PublicKey), nil
		}
		return nil, nil, errors.New("invalid CORE_PRIVATE_KEY length")
	}
	if isProd {
		return nil, nil, errors.New("CORE_PRIVATE_KEY is mandatory in production")
	}
	digest := sha256.Sum256([]byte(devSeed))
	priv := ed25519.NewKeyFromSeed(digest[:])
	return priv, priv.Public().(ed25519.PublicKey), nil
}

func LoadVerifierPublicKey(publicHex, devSeed string, isProd bool) (ed25519.PublicKey, error) {
	if publicHex != "" {
		rawPub, err := hex.DecodeString(strings.TrimSpace(publicHex))
		if err != nil || len(rawPub) != ed25519.PublicKeySize {
			return nil, errors.New("invalid CORE_PUBLIC_KEY hex")
		}
		return ed25519.PublicKey(rawPub), nil
	}
	if isProd {
		return nil, errors.New("CORE_PUBLIC_KEY is mandatory in production")
	}
	digest := sha256.Sum256([]byte(devSeed))
	priv := ed25519.NewKeyFromSeed(digest[:])
	pub := make(ed25519.PublicKey, ed25519.PublicKeySize)
	copy(pub, priv.Public().(ed25519.PublicKey))
	return pub, nil
}

func isSystemScope(scope string) bool {
	return scope == "catalog_sync" || scope == "platform_public"
}

func SignPassport(priv ed25519.PrivateKey, claims PassportClaims, ttl time.Duration) (string, error) {
	if len(priv) != ed25519.PrivateKeySize {
		return "", errors.New("core private key required to sign passport")
	}
	if !isSystemScope(claims.Scope) && !validTenantDBRegex.MatchString(claims.DBName) {
		return "", errors.New("invalid tenant db identifier in passport")
	}
	now := time.Now().Unix()
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", err
	}
	claims.IssuedAtUnix = now
	claims.ExpiresAtUnix = now + int64(ttl.Seconds())
	claims.Nonce = hex.EncodeToString(nonceBytes)

	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	sig := ed25519.Sign(priv, []byte(encodedPayload))
	encodedSig := base64.RawURLEncoding.EncodeToString(sig)
	return encodedPayload + "." + encodedSig, nil
}

func decodeAndVerifySignature(pub ed25519.PublicKey, token string) (PassportClaims, error) {
	if len(pub) != ed25519.PublicKeySize {
		return PassportClaims{}, errors.New("missing verifier Ed25519 public key")
	}
	dotIdx := strings.IndexByte(token, '.')
	if dotIdx <= 0 || dotIdx >= len(token)-1 {
		return PassportClaims{}, errors.New("malformed passport")
	}
	encodedPayload := token[:dotIdx]
	encodedSig := token[dotIdx+1:]

	sig, err := base64.RawURLEncoding.DecodeString(encodedSig)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return PassportClaims{}, errors.New("invalid passport signature encoding")
	}
	if !ed25519.Verify(pub, []byte(encodedPayload), sig) {
		return PassportClaims{}, errors.New("ed25519 passport signature verification failed")
	}
	rawPayload, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return PassportClaims{}, err
	}
	var claims PassportClaims
	if err := json.Unmarshal(rawPayload, &claims); err != nil {
		return PassportClaims{}, err
	}
	now := time.Now().Unix()
	if claims.IssuedAtUnix > now+2 {
		return PassportClaims{}, errors.New("passport issued in the future")
	}
	if claims.ExpiresAtUnix < now-1 {
		return PassportClaims{}, errors.New("expired s2s passport")
	}
	if !isSystemScope(claims.Scope) && !validTenantDBRegex.MatchString(claims.DBName) {
		return PassportClaims{}, errors.New("untrusted tenant db name")
	}
	return claims, nil
}

func VerifyPassport(pub ed25519.PublicKey, token, expectedAudience string, replay *ReplayGuard) (PassportClaims, error) {
	claims, err := decodeAndVerifySignature(pub, token)
	if err != nil {
		return PassportClaims{}, err
	}
	if expectedAudience != "" && claims.Audience != expectedAudience {
		return PassportClaims{}, errors.New("passport audience mismatch")
	}
	if err := replay.CheckAndRecord(claims.Nonce, claims.ExpiresAtUnix); err != nil {
		return PassportClaims{}, err
	}
	return claims, nil
}

func VerifyHopPassport(pub ed25519.PublicKey, token, hopNonce string, replay *ReplayGuard) (PassportClaims, error) {
	claims, err := decodeAndVerifySignature(pub, token)
	if err != nil {
		return PassportClaims{}, err
	}
	trimmedHop := strings.TrimSpace(hopNonce)
	if trimmedHop == "" {
		return PassportClaims{}, errors.New("missing s2s hop nonce")
	}
	if err := replay.CheckAndRecord("hop:"+claims.Nonce+":"+trimmedHop, claims.ExpiresAtUnix); err != nil {
		return PassportClaims{}, err
	}
	if err := replay.incrementHopCount(claims.Nonce); err != nil {
		return PassportClaims{}, err
	}
	return claims, nil
}

func SignHopMAC(s2sKey, rawPassport, hopNonce, method, targetService, cleanPath string) string {
	mac := hmac.New(sha256.New, []byte(s2sKey))
	mac.Write([]byte(strings.ToUpper(strings.TrimSpace(method))))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(targetService)))
	mac.Write([]byte("|"))
	mac.Write([]byte(cleanPath))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(hopNonce)))
	mac.Write([]byte("|"))
	mac.Write([]byte(strings.TrimSpace(rawPassport)))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyHopMAC(s2sKey, rawPassport, hopNonce, method, targetService, cleanPath, providedHex string) bool {
	if s2sKey == "" || strings.TrimSpace(providedHex) == "" {
		return false
	}
	expected := SignHopMAC(s2sKey, rawPassport, hopNonce, method, targetService, cleanPath)
	return hmac.Equal([]byte(expected), []byte(strings.TrimSpace(providedHex)))
}

func VerifyMeshPassport(pub ed25519.PublicKey, token, _ string, hopNonce string, replay *ReplayGuard) (PassportClaims, error) {
	return VerifyHopPassport(pub, token, hopNonce, replay)
}

func NewNonceHex() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func VerifyS2SKey(expected, provided string) bool {
	if expected == "" || provided == "" {
		return false
	}
	return hmac.Equal([]byte(expected), []byte(provided))
}
