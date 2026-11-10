package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	NodeRole      string
	BackendPort   int
	FrontendPort  int
	DBHost        string
	DBPort        int
	PostgresDB    string
	PostgresUser  string
	PostgresPass  string
	ClusterSecret string
	JWTSecret     string
	AppDomain     string
}

func Load() Config {
	return Config{
		NodeRole:      envStr("PROVEKO_NODE_ROLE", "cluster"),
		BackendPort:   envInt("BACKEND_PORT", envInt("PORT", 4000)),
		FrontendPort:  envInt("FRONTEND_PORT", 5173),
		DBHost:        envStr("DB_HOST", ""),
		DBPort:        envInt("DB_PORT", 5432),
		PostgresDB:    envStr("POSTGRES_DB", "proveko_control_db"),
		PostgresUser:  envStr("POSTGRES_USER", "postgres"),
		PostgresPass:  envStr("POSTGRES_PASSWORD", "proveko_master_secret_2026"),
		ClusterSecret: envStr("PROVEKO_CLUSTER_SECRET", "proveko_alpanel_cluster_hmac_secret_2026"),
		JWTSecret:     envStr("JWT_MASTER_SEED", "proveko_alpanel_ed25519_master_seed_2026"),
		AppDomain:     envStr("APP_DOMAIN", "localhost"),
	}
}

func (c Config) AdminDSN(dbName string) string {
	if c.DBHost == "" {
		return ""
	}
	target := dbName
	if target == "" {
		target = c.PostgresDB
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		c.PostgresUser, c.PostgresPass, c.DBHost, c.DBPort, target)
}

func EnvOr(key, fallback string) string { return envStr(key, fallback) }

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
