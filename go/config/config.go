package config

import (
	"fmt"
	"os"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	Port       string
	JWTSecret  string
	RedisURL   string
	GroqAPIKey string
}

// Load reads configuration from environment variables.
// Returns an error if any required variable is missing.
func Load() (*Config, error) {
	cfg := &Config{
		Port:       getEnv("PORT", "8000"),
		JWTSecret:  os.Getenv("JWT_SECRET"),
		RedisURL:   getEnv("REDIS_URL", "redis://localhost:6379"),
		GroqAPIKey: os.Getenv("GROQ_API_KEY"),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.GroqAPIKey == "" {
		return nil, fmt.Errorf("GROQ_API_KEY is required — get a free key at console.groq.com")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}