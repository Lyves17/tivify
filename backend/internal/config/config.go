package config

import (
	"crypto/rand"
	"fmt"
	"log"
	"os"
	"time"
)

type Config struct {
	AppEnv  string
	AppPort string

	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string

	// B9: Database connection pool configuration
	DBMaxIdleConns  int
	DBMaxOpenConns  int
	DBConnMaxLifetime time.Duration

	RedisHost     string
	RedisPort     string
	RedisPassword string

	JWTSecret          string
	JWTExpiry          time.Duration
	RefreshTokenExpiry time.Duration

	MediaPath  string
	FFmpegPath string
	// B19: FFprobe path can be derived from FFmpegPath or configured separately
	FFprobePath string
	BaseURL    string

	AdminUsername string
	AdminPassword string
	AdminEmail    string

	CORSAllowOrigins string

	LibraryPath string
	TMDBAPIKey  string

	// IPTV seed
	SeedIPTV   bool
	IPTVm3uURL string
}

func Load() *Config {
	appEnv := getEnv("APP_ENV", "development")

	// Load JWT_SECRET - required and must be strong in production
	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		if appEnv == "production" {
			log.Fatal("CRITICAL: JWT_SECRET must be set in production environment")
		}
		// Development: generate a temporary strong secret
		jwtSecret = "dev-secret-" + generateRandomString(32)
	}
	validateJWTSecret(jwtSecret, appEnv)

	// B6 & B7: Load admin password - enforce strong password in production
	adminPassword := getEnv("ADMIN_PASSWORD", "")
	if adminPassword == "" {
		adminPassword = generateRandomString(16)
		// B7: Don't print the actual password in logs
		log.Println("INFO: ADMIN_PASSWORD not set, using auto-generated secure password")
		log.Println("WARNING: Save this password securely - it is displayed once only during first login")
	} else {
		// B6: In production, enforce minimum 12 character password
		minLength := 12
		if appEnv == "production" && len(adminPassword) < minLength {
			log.Fatalf("CRITICAL: ADMIN_PASSWORD must be at least %d characters in production (current: %d)", minLength, len(adminPassword))
		}
		// In dev/other environments, warn if weak
		if len(adminPassword) < 12 {
			log.Printf("WARNING: ADMIN_PASSWORD is weak (less than 12 characters). Recommended for security: at least 12 chars")
		}
	}

	return &Config{
		AppEnv:  appEnv,
		AppPort: getEnv("APP_PORT", "8080"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBName:     getEnv("DB_NAME", "tivify"),
		DBUser:     getEnv("DB_USER", "tivify"),
		DBPassword: getEnv("DB_PASSWORD", "changeme"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		// B9: Database connection pool configuration with sensible defaults
		DBMaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 10),
		DBMaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 100),
		DBConnMaxLifetime: parseDuration(getEnv("DB_CONN_MAX_LIFETIME", "1h")),

		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", "changeme"),

		JWTSecret:          jwtSecret,
		JWTExpiry:          parseDuration(getEnv("JWT_EXPIRY", "15m")),
		RefreshTokenExpiry: parseDuration(getEnv("REFRESH_TOKEN_EXPIRY", "168h")),

		MediaPath:  getEnv("MEDIA_PATH", "./media"),
		FFmpegPath: getEnv("FFMPEG_PATH", "ffmpeg"),
		// B19: Allow separate ffprobe configuration, or derive from ffmpeg path
		FFprobePath: getEnv("FFPROBE_PATH", "ffprobe"),
		BaseURL:    getEnv("BASE_URL", "http://localhost"),

		AdminUsername: getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword: adminPassword,
		AdminEmail:    getEnv("ADMIN_EMAIL", "admin@tivify.local"),

		CORSAllowOrigins: getEnv("CORS_ALLOW_ORIGINS", ""),

		LibraryPath: getEnv("LIBRARY_PATH", "/library"),
		TMDBAPIKey:  getEnv("TMDB_API_KEY", ""),

		// IPTV: se activa por defecto; deshabilitar con SEED_IPTV=false
		SeedIPTV:   getEnvBool("SEED_IPTV", true),
		IPTVm3uURL: getEnv("IPTV_M3U_URL", "https://iptv-org.github.io/iptv/index.m3u"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	return val == "true" || val == "1" || val == "yes"
}

// B9: Helper to parse integer environment variables
func getEnvInt(key string, fallback int) int {
	val, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	var result int
	if _, err := fmt.Sscanf(val, "%d", &result); err != nil {
		log.Printf("WARNING: Invalid integer for %s: %s, using fallback %d", key, val, fallback)
		return fallback
	}
	return result
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}

// generateRandomString creates a random alphanumeric string of given length
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	randomBytes := make([]byte, length)

	_, err := rand.Read(randomBytes)
	if err != nil {
		log.Printf("Error generating random string: %v", err)
		// Fallback - use timestamp
		for i := range b {
			b[i] = charset[i%len(charset)]
		}
		return string(b)
	}

	for i := range b {
		b[i] = charset[randomBytes[i]%byte(len(charset))]
	}
	return string(b)
}

// validateJWTSecret ensures JWT_SECRET meets security requirements
func validateJWTSecret(secret string, appEnv string) {
	if len(secret) < 32 && appEnv == "production" {
		log.Fatalf("CRITICAL: JWT_SECRET must be at least 32 characters in production (current: %d)", len(secret))
	}
	if len(secret) < 32 && appEnv != "development" {
		log.Printf("WARNING: JWT_SECRET is less than 32 characters (current: %d). Recommended for security: at least 32 chars", len(secret))
	}
}
