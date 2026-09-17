package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	AppBaseURL  string

	// Refleksi encryption key: 32-byte hex (64 chars) for AES-256-GCM.
	ReflectionKey string

	R2   R2Config
	SMTP SMTPConfig
}

type R2Config struct {
	AccountID       string
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
}

// Configured reports whether R2 credentials are present. When false, attachment
// uploads are rejected rather than silently dropped.
func (r R2Config) Configured() bool {
	return r.URL() != "" && r.AccessKeyID != "" && r.SecretAccessKey != "" && r.Bucket != ""
}

// URL is the S3 API endpoint. R2_ENDPOINT wins when set (Cloudflare shows it
// ready-made, and jurisdiction-specific buckets don't follow the default shape);
// otherwise it is derived from the account id.
func (r R2Config) URL() string {
	if r.Endpoint != "" {
		return strings.TrimSuffix(r.Endpoint, "/")
	}
	if r.AccountID == "" {
		return ""
	}
	return "https://" + r.AccountID + ".r2.cloudflarestorage.com"
}

type SMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

// Configured reports whether SMTP is set up. When false, the mailer logs the
// message instead of sending, so local dev works without a mail server.
func (s SMTPConfig) Configured() bool {
	return s.Host != "" && s.From != ""
}

func Load() Config {
	loadDotEnv(env("ENV_FILE", ".env"))

	return Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://berani:berani@localhost:5432/berani?sslmode=disable"),
		JWTSecret:     env("JWT_SECRET", "dev-secret-change-me"),
		AppBaseURL:    env("APP_BASE_URL", "http://localhost:3000"),
		ReflectionKey: os.Getenv("REFLECTION_KEY"),
		R2: R2Config{
			AccountID:       os.Getenv("R2_ACCOUNT_ID"),
			Endpoint:        os.Getenv("R2_ENDPOINT"),
			AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
			SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
			Bucket:          os.Getenv("R2_BUCKET"),
		},
		SMTP: SMTPConfig{
			Host:     os.Getenv("SMTP_HOST"),
			Port:     env("SMTP_PORT", "587"),
			Username: os.Getenv("SMTP_USERNAME"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     env("SMTP_FROM", "BERANI <no-reply@berani.id>"),
		},
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
