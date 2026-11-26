package config

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

const (
	devSeedDefault   = "change_me_ed25519_seed_32_bytes!"
	devS2SDefault    = "dev_only_s2s_shared_key_2026"
	devJWTDefault    = "dev_only_jwt_secret_2026"
	devVaultDefault  = "dev_only_vault_kek_2026"
	devAdminPassInit = "AdminPlataforma2026*"
)

type CommonConfig struct {
	Environment      string
	ServiceName      string
	HTTPPort         int
	GRPCPort         int
	GatewayURL       string
	ServicePublicURL string
	DBHost           string
	DBPort           int
	ControlDB        string
	DBUser           string
	DBPassword       string
	DBSSLMode        string
	MaxTenantPools   int
	S2SSharedKey     string
	AllowedOrigins   []string
}

type CoreConfig struct {
	CommonConfig
	JWTSecret           string
	CorePrivateHex      string
	CorePublicHex       string
	DevEd25519Seed      string
	VaultKEK            string
	SuperAdminEmail     string
	SuperAdminPassword  string
	PlatformUpstreamURL string
	AdminUpstreamURL    string
}

type ServiceConfig struct {
	CommonConfig
	CorePublicHex  string
	DevEd25519Seed string
}

func (c CommonConfig) IsProduction() bool {
	return strings.EqualFold(c.Environment, "production") || strings.EqualFold(c.Environment, "prod")
}

func LoadCommon(defaultService string, defaultHTTPPort int) CommonConfig {
	rawOrigins := EnvOr("ALLOWED_ORIGINS", "http://localhost:4000,http://localhost:5173")
	var origins []string
	for _, o := range strings.Split(rawOrigins, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	port := EnvInt("PORT", EnvInt("BACKEND_PORT", defaultHTTPPort))
	defaultPublic := fmt.Sprintf("http://localhost:%d", port)
	maxPools := EnvInt("DB_MAX_TENANT_POOLS", 16)
	if maxPools < 4 {
		maxPools = 4
	}

	dbHost := EnvOr("DB_HOST", "")
	dbPort := EnvInt("DB_PORT", 5432)
	controlDB := EnvOr("POSTGRES_DB", EnvOr("DB_NAME", "control_plane_db"))
	dbUser := EnvOr("DB_USER", EnvOr("POSTGRES_USER", "postgres"))
	dbPassword := EnvOr("DB_PASSWORD", EnvOr("POSTGRES_PASSWORD", ""))
	dbSSLMode := EnvOr("DB_SSLMODE", "disable")

	if rawDSN := EnvOr("DATABASE_URL", EnvOr("POSTGRES_URL", "")); dbHost == "" && rawDSN != "" {
		if parsed, err := url.Parse(rawDSN); err == nil && parsed.Host != "" {
			h, pStr, splitErr := net.SplitHostPort(parsed.Host)
			if splitErr == nil {
				dbHost = h
				if pNum, convErr := strconv.Atoi(pStr); convErr == nil && pNum > 0 {
					dbPort = pNum
				}
			} else {
				dbHost = parsed.Hostname()
			}
			if parsed.User != nil {
				if u := parsed.User.Username(); u != "" {
					dbUser = u
				}
				if pw, ok := parsed.User.Password(); ok {
					dbPassword = pw
				}
			}
			if dbPath := strings.Trim(parsed.Path, "/"); dbPath != "" && EnvOr("POSTGRES_DB", EnvOr("DB_NAME", "")) == "" {
				controlDB = dbPath
			}
			if sm := parsed.Query().Get("sslmode"); sm != "" && EnvOr("DB_SSLMODE", "") == "" {
				dbSSLMode = sm
			}
		}
	}

	return CommonConfig{
		Environment:      EnvOr("APP_ENV", EnvOr("ENV", "development")),
		ServiceName:      EnvOr("SERVICE_NAME", defaultService),
		HTTPPort:         port,
		GatewayURL:       strings.TrimRight(EnvOr("GATEWAY_URL", ""), "/"),
		ServicePublicURL: strings.TrimRight(EnvOr("SERVICE_PUBLIC_URL", defaultPublic), "/"),
		DBHost:           dbHost,
		DBPort:           dbPort,
		ControlDB:        controlDB,
		DBUser:           dbUser,
		DBPassword:       dbPassword,
		DBSSLMode:        dbSSLMode,
		MaxTenantPools:   maxPools,
		S2SSharedKey:     EnvOr("S2S_SHARED_KEY", devS2SDefault),
		AllowedOrigins:   origins,
	}
}

func deriveDeterministicHex(secret, contextLabel string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(contextLabel))
	return hex.EncodeToString(mac.Sum(nil))
}

func LoadCore() (CoreConfig, error) {
	common := LoadCommon("ms-core", 4000)
	cfg := CoreConfig{
		CommonConfig:        common,
		JWTSecret:           EnvOr("JWT_SECRET", devJWTDefault),
		CorePrivateHex:      EnvOr("CORE_PRIVATE_KEY", ""),
		CorePublicHex:       EnvOr("CORE_PUBLIC_KEY", ""),
		DevEd25519Seed:      EnvOr("CORE_ED25519_SEED", devSeedDefault),
		VaultKEK:            EnvOr("VAULT_KEK", EnvOr("PROVEKO_VAULT_KEK", devVaultDefault)),
		SuperAdminEmail:     strings.ToLower(EnvOr("SUPERADMIN_EMAIL", "superadmin@plataforma.local")),
		SuperAdminPassword:  EnvOr("SUPERADMIN_PASSWORD", devAdminPassInit),
		PlatformUpstreamURL: strings.TrimRight(EnvOr("MS_PLATFORM_URL", ""), "/"),
		AdminUpstreamURL:    strings.TrimRight(EnvOr("MS_ADMIN_URL", ""), "/"),
	}
	if cfg.IsProduction() {
		if cfg.S2SSharedKey == "" || cfg.S2SSharedKey == devS2SDefault {
			return cfg, errors.New("production requires explicit S2S_SHARED_KEY")
		}
		if cfg.JWTSecret == "" || cfg.JWTSecret == devJWTDefault {
			return cfg, errors.New("production requires explicit JWT_SECRET")
		}
		if cfg.VaultKEK == "" || cfg.VaultKEK == devVaultDefault {
			cfg.VaultKEK = deriveDeterministicHex(cfg.JWT_SecretOrFallback(), "vault-kek:"+cfg.S2SSharedKey)
		}
		if cfg.CorePrivateHex == "" {
			if cfg.DevEd25519Seed != "" && cfg.DevEd25519Seed != devSeedDefault {
				sum := sha256.Sum256([]byte(cfg.DevEd25519Seed))
				cfg.CorePrivateHex = hex.EncodeToString(sum[:])
			} else {
				cfg.CorePrivateHex = deriveDeterministicHex(cfg.S2SSharedKey, "ed25519-core:"+cfg.JWTSecret)
			}
		}
	}
	return cfg, nil
}

func (c CoreConfig) JWT_SecretOrFallback() string {
	return c.JWTSecret
}

func LoadService(serviceName string, defaultHTTPPort int) (ServiceConfig, error) {
	common := LoadCommon(serviceName, defaultHTTPPort)
	cfg := ServiceConfig{
		CommonConfig:   common,
		CorePublicHex:  EnvOr("CORE_PUBLIC_KEY", ""),
		DevEd25519Seed: EnvOr("CORE_ED25519_SEED", devSeedDefault),
	}
	if cfg.IsProduction() {
		if cfg.S2SSharedKey == "" || cfg.S2SSharedKey == devS2SDefault {
			return cfg, errors.New("production requires explicit S2S_SHARED_KEY")
		}
		if cfg.CorePublicHex == "" && cfg.GatewayURL == "" && (cfg.DevEd25519Seed == "" || cfg.DevEd25519Seed == devSeedDefault) {
			return cfg, errors.New("production requires GATEWAY_URL or CORE_PUBLIC_KEY")
		}
	}
	return cfg, nil
}

func (c CommonConfig) BuildDSN(dbName string) string {
	if c.DBHost == "" {
		return ""
	}
	target := dbName
	if target == "" {
		target = c.ControlDB
	}
	sslMode := c.DBSSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	u := &url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.DBUser, c.DBPassword),
		Host:     fmt.Sprintf("%s:%d", c.DBHost, c.DBPort),
		Path:     "/" + target,
		RawQuery: "sslmode=" + url.QueryEscape(sslMode),
	}
	return u.String()
}

func EnvOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func EnvInt(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
