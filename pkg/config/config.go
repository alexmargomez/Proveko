package config

import (
	"errors"
	"fmt"
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
	return CommonConfig{
		Environment:      EnvOr("APP_ENV", EnvOr("ENV", "development")),
		ServiceName:      EnvOr("SERVICE_NAME", defaultService),
		HTTPPort:         port,
		GatewayURL:       strings.TrimRight(EnvOr("GATEWAY_URL", ""), "/"),
		ServicePublicURL: strings.TrimRight(EnvOr("SERVICE_PUBLIC_URL", defaultPublic), "/"),
		DBHost:           EnvOr("DB_HOST", ""),
		DBPort:           EnvInt("DB_PORT", 5432),
		ControlDB:        EnvOr("POSTGRES_DB", "control_plane_db"),
		DBUser:           EnvOr("DB_USER", EnvOr("POSTGRES_USER", "postgres")),
		DBPassword:       EnvOr("DB_PASSWORD", EnvOr("POSTGRES_PASSWORD", "")),
		DBSSLMode:        EnvOr("DB_SSLMODE", "disable"),
		MaxTenantPools:   maxPools,
		S2SSharedKey:     EnvOr("S2S_SHARED_KEY", devS2SDefault),
		AllowedOrigins:   origins,
	}
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
	}
	if cfg.IsProduction() {
		if cfg.S2SSharedKey == "" || cfg.S2SSharedKey == devS2SDefault {
			return cfg, errors.New("production requires explicit S2S_SHARED_KEY")
		}
		if cfg.JWTSecret == "" || cfg.JWTSecret == devJWTDefault {
			return cfg, errors.New("production requires explicit JWT_SECRET")
		}
		if cfg.CorePrivateHex == "" {
			return cfg, errors.New("production requires explicit CORE_PRIVATE_KEY")
		}
		if cfg.VaultKEK == "" || cfg.VaultKEK == devVaultDefault {
			return cfg, errors.New("production requires explicit VAULT_KEK")
		}
	}
	return cfg, nil
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
		if cfg.CorePublicHex == "" && cfg.GatewayURL == "" {
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
