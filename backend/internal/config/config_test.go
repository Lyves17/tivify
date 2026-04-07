package config

import (
	"strings"
	"testing"
	"time"
)

func TestGetEnv_WithValue(t *testing.T) {
	t.Setenv("TEST_CONFIG_VAR", "hello")
	if got := getEnv("TEST_CONFIG_VAR", "default"); got != "hello" {
		t.Errorf("getEnv() = %q, want %q", got, "hello")
	}
}

func TestGetEnv_Fallback(t *testing.T) {
	if got := getEnv("NONEXISTENT_CONFIG_VAR_12345", "fallback"); got != "fallback" {
		t.Errorf("getEnv() = %q, want %q", got, "fallback")
	}
}

func TestGetEnv_EmptyValue(t *testing.T) {
	t.Setenv("TEST_EMPTY", "")
	// An empty string is still "set", so it should return empty, not fallback
	if got := getEnv("TEST_EMPTY", "fallback"); got != "" {
		t.Errorf("getEnv() = %q, want empty string", got)
	}
}

func TestGetEnvBool_True(t *testing.T) {
	for _, val := range []string{"true", "1", "yes"} {
		t.Setenv("TEST_BOOL", val)
		if got := getEnvBool("TEST_BOOL", false); !got {
			t.Errorf("getEnvBool(%q) = false, want true", val)
		}
	}
}

func TestGetEnvBool_False(t *testing.T) {
	for _, val := range []string{"false", "0", "no"} {
		t.Setenv("TEST_BOOL_F", val)
		if got := getEnvBool("TEST_BOOL_F", true); got {
			t.Errorf("getEnvBool(%q) = true, want false", val)
		}
	}
}

func TestGetEnvBool_Fallback(t *testing.T) {
	if got := getEnvBool("NONEXISTENT_BOOL_12345", true); !got {
		t.Error("getEnvBool() should return fallback when not set")
	}
	if got := getEnvBool("NONEXISTENT_BOOL_67890", false); got {
		t.Error("getEnvBool() should return false fallback when not set")
	}
}

func TestGetEnvBool_UnrecognizedValues(t *testing.T) {
	// Values like "TRUE", "Yes", "on" are not in the accepted set, should return false
	for _, val := range []string{"TRUE", "Yes", "on", "ON", "t", "y", "random"} {
		t.Setenv("TEST_BOOL_UNREC", val)
		if got := getEnvBool("TEST_BOOL_UNREC", false); got {
			t.Errorf("getEnvBool(%q) = true, should be false (not in accepted set)", val)
		}
	}
}

func TestGetEnvInt_Valid(t *testing.T) {
	t.Setenv("TEST_INT", "42")
	if got := getEnvInt("TEST_INT", 0); got != 42 {
		t.Errorf("getEnvInt() = %d, want 42", got)
	}
}

func TestGetEnvInt_Zero(t *testing.T) {
	t.Setenv("TEST_INT_ZERO", "0")
	if got := getEnvInt("TEST_INT_ZERO", 99); got != 0 {
		t.Errorf("getEnvInt(\"0\") = %d, want 0", got)
	}
}

func TestGetEnvInt_Negative(t *testing.T) {
	t.Setenv("TEST_INT_NEG", "-5")
	if got := getEnvInt("TEST_INT_NEG", 99); got != -5 {
		t.Errorf("getEnvInt(\"-5\") = %d, want -5", got)
	}
}

func TestGetEnvInt_Invalid(t *testing.T) {
	// Note: Sscanf parses "3.14" as 3 and "12abc" as 12 (partial parse succeeds)
	// Only truly non-numeric strings fall back
	for _, val := range []string{"not-a-number", "", "true"} {
		t.Setenv("TEST_INT_INV", val)
		if got := getEnvInt("TEST_INT_INV", 99); got != 99 {
			t.Errorf("getEnvInt(%q) = %d, want 99 (fallback)", val, got)
		}
	}
}

func TestGetEnvInt_PartialParse(t *testing.T) {
	// Sscanf parses leading digits from mixed strings
	t.Setenv("TEST_INT_PP1", "3.14")
	if got := getEnvInt("TEST_INT_PP1", 99); got != 3 {
		t.Errorf("getEnvInt(\"3.14\") = %d, want 3", got)
	}
	t.Setenv("TEST_INT_PP2", "12abc")
	if got := getEnvInt("TEST_INT_PP2", 99); got != 12 {
		t.Errorf("getEnvInt(\"12abc\") = %d, want 12", got)
	}
}

func TestGetEnvInt_Fallback(t *testing.T) {
	if got := getEnvInt("NONEXISTENT_INT_12345", 55); got != 55 {
		t.Errorf("getEnvInt() = %d, want 55", got)
	}
}

func TestParseDuration_Valid(t *testing.T) {
	tests := []struct {
		input string
		want  time.Duration
	}{
		{"15m", 15 * time.Minute},
		{"1h", time.Hour},
		{"30s", 30 * time.Second},
		{"168h", 168 * time.Hour},
		{"500ms", 500 * time.Millisecond},
		{"1h30m", time.Hour + 30*time.Minute},
		{"0s", 0},
	}
	for _, tt := range tests {
		got := parseDuration(tt.input)
		if got != tt.want {
			t.Errorf("parseDuration(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestParseDuration_Invalid(t *testing.T) {
	for _, val := range []string{"invalid", "abc", "15", "10x", ""} {
		got := parseDuration(val)
		if got != 15*time.Minute {
			t.Errorf("parseDuration(%q) = %v, want 15m (default)", val, got)
		}
	}
}

func TestGenerateRandomString_Length(t *testing.T) {
	for _, length := range []int{0, 1, 8, 16, 32, 64, 128} {
		s := generateRandomString(length)
		if len(s) != length {
			t.Errorf("generateRandomString(%d) len = %d, want %d", length, len(s), length)
		}
	}
}

func TestGenerateRandomString_Alphanumeric(t *testing.T) {
	s := generateRandomString(100)
	for _, c := range s {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			t.Errorf("generateRandomString contains invalid char: %c", c)
		}
	}
}

func TestGenerateRandomString_Uniqueness(t *testing.T) {
	// Two calls should produce different strings (with very high probability)
	s1 := generateRandomString(32)
	s2 := generateRandomString(32)
	if s1 == s2 {
		t.Error("two consecutive generateRandomString calls produced identical results")
	}
}

func TestLoad_Defaults(t *testing.T) {
	// Clear any env vars that might affect the test
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()

	if cfg.AppPort != "8080" {
		t.Errorf("AppPort = %q, want 8080", cfg.AppPort)
	}
	if cfg.DBHost != "localhost" {
		t.Errorf("DBHost = %q, want localhost", cfg.DBHost)
	}
	if cfg.DBPort != "5432" {
		t.Errorf("DBPort = %q, want 5432", cfg.DBPort)
	}
	if cfg.DBName != "tivify" {
		t.Errorf("DBName = %q, want tivify", cfg.DBName)
	}
	if cfg.DBUser != "tivify" {
		t.Errorf("DBUser = %q, want tivify", cfg.DBUser)
	}
	if cfg.DBSSLMode != "disable" {
		t.Errorf("DBSSLMode = %q, want disable", cfg.DBSSLMode)
	}
	if cfg.RedisHost != "localhost" {
		t.Errorf("RedisHost = %q, want localhost", cfg.RedisHost)
	}
	if cfg.RedisPort != "6379" {
		t.Errorf("RedisPort = %q, want 6379", cfg.RedisPort)
	}
	if cfg.JWTExpiry != 15*time.Minute {
		t.Errorf("JWTExpiry = %v, want 15m", cfg.JWTExpiry)
	}
	if cfg.RefreshTokenExpiry != 168*time.Hour {
		t.Errorf("RefreshTokenExpiry = %v, want 168h", cfg.RefreshTokenExpiry)
	}
	if cfg.MediaPath != "./media" {
		t.Errorf("MediaPath = %q, want ./media", cfg.MediaPath)
	}
	if cfg.FFmpegPath != "ffmpeg" {
		t.Errorf("FFmpegPath = %q, want ffmpeg", cfg.FFmpegPath)
	}
	if cfg.FFprobePath != "ffprobe" {
		t.Errorf("FFprobePath = %q, want ffprobe", cfg.FFprobePath)
	}
	if cfg.BaseURL != "http://localhost" {
		t.Errorf("BaseURL = %q, want http://localhost", cfg.BaseURL)
	}
	if cfg.AdminUsername != "admin" {
		t.Errorf("AdminUsername = %q, want admin", cfg.AdminUsername)
	}
	if cfg.AdminEmail != "admin@tivify.local" {
		t.Errorf("AdminEmail = %q, want admin@tivify.local", cfg.AdminEmail)
	}
	if cfg.LibraryPath != "/library" {
		t.Errorf("LibraryPath = %q, want /library", cfg.LibraryPath)
	}
	if cfg.DBMaxIdleConns != 10 {
		t.Errorf("DBMaxIdleConns = %d, want 10", cfg.DBMaxIdleConns)
	}
	if cfg.DBMaxOpenConns != 100 {
		t.Errorf("DBMaxOpenConns = %d, want 100", cfg.DBMaxOpenConns)
	}
	if cfg.DBConnMaxLifetime != time.Hour {
		t.Errorf("DBConnMaxLifetime = %v, want 1h", cfg.DBConnMaxLifetime)
	}
}

func TestValidateJWTSecret_ShortNonDev(t *testing.T) {
	// Should log a warning for non-dev environments with short secret
	// but not fatal (only production fatals)
	validateJWTSecret("short", "staging")
	// If we get here without fatal, test passes
}

func TestValidateJWTSecret_LongEnough(t *testing.T) {
	// >= 32 chars should not warn
	validateJWTSecret("this-is-a-long-enough-secret-key-at-least-32chars!!", "production")
}

func TestValidateJWTSecret_ShortDev(t *testing.T) {
	// Development with short secret should be fine (no warning for dev)
	validateJWTSecret("short", "development")
}

func TestValidateJWTSecret_Exactly32Chars(t *testing.T) {
	// Exactly 32 chars should pass even in production
	secret := strings.Repeat("a", 32)
	validateJWTSecret(secret, "production")
}

func TestValidateJWTSecret_31Chars_Staging(t *testing.T) {
	// 31 chars in staging - should warn but not fatal
	secret := strings.Repeat("b", 31)
	validateJWTSecret(secret, "staging")
}

func TestValidateJWTSecret_LongDev(t *testing.T) {
	// Long secret in dev - should be fine
	secret := strings.Repeat("c", 64)
	validateJWTSecret(secret, "development")
}

func TestLoad_AutoGeneratePassword(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	// Don't set ADMIN_PASSWORD - should auto-generate
	t.Setenv("ADMIN_PASSWORD", "")

	cfg := Load()
	if cfg.AdminPassword == "" {
		t.Error("AdminPassword should be auto-generated when empty")
	}
	if len(cfg.AdminPassword) < 16 {
		t.Errorf("auto-generated password should be at least 16 chars, got %d", len(cfg.AdminPassword))
	}
}

func TestLoad_WeakPassword_Dev(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "short") // < 12 chars, should warn but not fatal

	cfg := Load()
	if cfg.AdminPassword != "short" {
		t.Errorf("AdminPassword = %q, want 'short'", cfg.AdminPassword)
	}
}

func TestLoad_AutoGenerateJWTSecret(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "") // Empty - should auto-generate in dev
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.JWTSecret == "" {
		t.Error("JWTSecret should be auto-generated when empty in dev")
	}
	if !strings.HasPrefix(cfg.JWTSecret, "dev-secret-") {
		t.Errorf("auto-generated JWT secret should start with 'dev-secret-', got %q", cfg.JWTSecret[:20])
	}
}

func TestLoad_SeedIPTV(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")
	t.Setenv("SEED_IPTV", "false")

	cfg := Load()
	if cfg.SeedIPTV {
		t.Error("SeedIPTV should be false when SEED_IPTV=false")
	}
}

func TestLoad_SeedIPTV_True(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")
	t.Setenv("SEED_IPTV", "true")

	cfg := Load()
	if !cfg.SeedIPTV {
		t.Error("SeedIPTV should be true when SEED_IPTV=true")
	}
}

func TestLoad_SeedIPTV_DefaultTrue(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")
	// Don't set SEED_IPTV - default should be true

	cfg := Load()
	if !cfg.SeedIPTV {
		t.Error("SeedIPTV should default to true when not set")
	}
}

func TestLoad_DBPoolConfig(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")
	t.Setenv("DB_MAX_IDLE_CONNS", "20")
	t.Setenv("DB_MAX_OPEN_CONNS", "200")
	t.Setenv("DB_CONN_MAX_LIFETIME", "2h")

	cfg := Load()
	if cfg.DBMaxIdleConns != 20 {
		t.Errorf("DBMaxIdleConns = %d, want 20", cfg.DBMaxIdleConns)
	}
	if cfg.DBMaxOpenConns != 200 {
		t.Errorf("DBMaxOpenConns = %d, want 200", cfg.DBMaxOpenConns)
	}
	if cfg.DBConnMaxLifetime != 2*time.Hour {
		t.Errorf("DBConnMaxLifetime = %v, want 2h", cfg.DBConnMaxLifetime)
	}
}

func TestLoad_DBPoolConfig_InvalidValues(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")
	t.Setenv("DB_MAX_IDLE_CONNS", "abc")
	t.Setenv("DB_MAX_OPEN_CONNS", "xyz")
	t.Setenv("DB_CONN_MAX_LIFETIME", "not-a-duration")

	cfg := Load()
	// Should fall back to defaults
	if cfg.DBMaxIdleConns != 10 {
		t.Errorf("DBMaxIdleConns with invalid value = %d, want 10 (default)", cfg.DBMaxIdleConns)
	}
	if cfg.DBMaxOpenConns != 100 {
		t.Errorf("DBMaxOpenConns with invalid value = %d, want 100 (default)", cfg.DBMaxOpenConns)
	}
	if cfg.DBConnMaxLifetime != 15*time.Minute {
		t.Errorf("DBConnMaxLifetime with invalid value = %v, want 15m (parseDuration default)", cfg.DBConnMaxLifetime)
	}
}

func TestLoad_CustomValues(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("APP_PORT", "3000")
	t.Setenv("JWT_SECRET", "custom-secret-at-least-32-characters!!")
	t.Setenv("JWT_EXPIRY", "30m")
	t.Setenv("REFRESH_TOKEN_EXPIRY", "72h")
	t.Setenv("ADMIN_PASSWORD", "CustomPass12345")
	t.Setenv("ADMIN_USERNAME", "customadmin")
	t.Setenv("ADMIN_EMAIL", "custom@example.com")
	t.Setenv("DB_HOST", "db.example.com")
	t.Setenv("DB_PORT", "5433")
	t.Setenv("DB_NAME", "mydb")
	t.Setenv("DB_USER", "myuser")
	t.Setenv("DB_PASSWORD", "mypass")
	t.Setenv("DB_SSLMODE", "require")
	t.Setenv("REDIS_HOST", "redis.example.com")
	t.Setenv("REDIS_PORT", "6380")
	t.Setenv("REDIS_PASSWORD", "redispass")
	t.Setenv("MEDIA_PATH", "/custom/media")
	t.Setenv("FFMPEG_PATH", "/usr/bin/ffmpeg")
	t.Setenv("FFPROBE_PATH", "/usr/bin/ffprobe")
	t.Setenv("BASE_URL", "https://example.com")
	t.Setenv("CORS_ALLOW_ORIGINS", "https://example.com")
	t.Setenv("LIBRARY_PATH", "/custom/library")
	t.Setenv("TMDB_API_KEY", "tmdb-key-123")
	t.Setenv("IPTV_M3U_URL", "https://custom.m3u/url")

	cfg := Load()

	if cfg.AppPort != "3000" {
		t.Errorf("AppPort = %q, want 3000", cfg.AppPort)
	}
	if cfg.JWTExpiry != 30*time.Minute {
		t.Errorf("JWTExpiry = %v, want 30m", cfg.JWTExpiry)
	}
	if cfg.RefreshTokenExpiry != 72*time.Hour {
		t.Errorf("RefreshTokenExpiry = %v, want 72h", cfg.RefreshTokenExpiry)
	}
	if cfg.AdminUsername != "customadmin" {
		t.Errorf("AdminUsername = %q, want customadmin", cfg.AdminUsername)
	}
	if cfg.AdminPassword != "CustomPass12345" {
		t.Errorf("AdminPassword should use provided password")
	}
	if cfg.AdminEmail != "custom@example.com" {
		t.Errorf("AdminEmail = %q, want custom@example.com", cfg.AdminEmail)
	}
	if cfg.DBHost != "db.example.com" {
		t.Errorf("DBHost = %q, want db.example.com", cfg.DBHost)
	}
	if cfg.DBPort != "5433" {
		t.Errorf("DBPort = %q, want 5433", cfg.DBPort)
	}
	if cfg.DBName != "mydb" {
		t.Errorf("DBName = %q, want mydb", cfg.DBName)
	}
	if cfg.DBUser != "myuser" {
		t.Errorf("DBUser = %q, want myuser", cfg.DBUser)
	}
	if cfg.DBPassword != "mypass" {
		t.Errorf("DBPassword = %q, want mypass", cfg.DBPassword)
	}
	if cfg.DBSSLMode != "require" {
		t.Errorf("DBSSLMode = %q, want require", cfg.DBSSLMode)
	}
	if cfg.RedisHost != "redis.example.com" {
		t.Errorf("RedisHost = %q, want redis.example.com", cfg.RedisHost)
	}
	if cfg.RedisPort != "6380" {
		t.Errorf("RedisPort = %q, want 6380", cfg.RedisPort)
	}
	if cfg.RedisPassword != "redispass" {
		t.Errorf("RedisPassword = %q, want redispass", cfg.RedisPassword)
	}
	if cfg.MediaPath != "/custom/media" {
		t.Errorf("MediaPath = %q, want /custom/media", cfg.MediaPath)
	}
	if cfg.FFmpegPath != "/usr/bin/ffmpeg" {
		t.Errorf("FFmpegPath = %q, want /usr/bin/ffmpeg", cfg.FFmpegPath)
	}
	if cfg.FFprobePath != "/usr/bin/ffprobe" {
		t.Errorf("FFprobePath = %q, want /usr/bin/ffprobe", cfg.FFprobePath)
	}
	if cfg.BaseURL != "https://example.com" {
		t.Errorf("BaseURL = %q, want https://example.com", cfg.BaseURL)
	}
	if cfg.CORSAllowOrigins != "https://example.com" {
		t.Errorf("CORSAllowOrigins = %q, want https://example.com", cfg.CORSAllowOrigins)
	}
	if cfg.LibraryPath != "/custom/library" {
		t.Errorf("LibraryPath = %q, want /custom/library", cfg.LibraryPath)
	}
	if cfg.TMDBAPIKey != "tmdb-key-123" {
		t.Errorf("TMDBAPIKey = %q, want tmdb-key-123", cfg.TMDBAPIKey)
	}
	if cfg.IPTVm3uURL != "https://custom.m3u/url" {
		t.Errorf("IPTVm3uURL = %q, want https://custom.m3u/url", cfg.IPTVm3uURL)
	}
}

func TestLoad_StrongPassword_Dev(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "VeryStrongPassword123!!")

	cfg := Load()
	if cfg.AdminPassword != "VeryStrongPassword123!!" {
		t.Errorf("AdminPassword = %q, want 'VeryStrongPassword123!!'", cfg.AdminPassword)
	}
}

func TestLoad_IPTVm3uURL_Default(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.IPTVm3uURL == "" {
		t.Error("IPTVm3uURL should have a default value")
	}
}

func TestLoad_CORSAllowOrigins_Default(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.CORSAllowOrigins != "" {
		t.Errorf("CORSAllowOrigins default should be empty, got %q", cfg.CORSAllowOrigins)
	}
}

func TestLoad_TMDBAPIKey_Default(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.TMDBAPIKey != "" {
		t.Errorf("TMDBAPIKey default should be empty, got %q", cfg.TMDBAPIKey)
	}
}

func TestLoad_AppEnv(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters!!")
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.AppEnv != "development" {
		t.Errorf("AppEnv = %q, want development", cfg.AppEnv)
	}
}

func TestLoad_JWTSecret_SetDirectly(t *testing.T) {
	secret := "my-custom-secret-that-is-at-least-32-characters-long!!"
	t.Setenv("APP_ENV", "development")
	t.Setenv("JWT_SECRET", secret)
	t.Setenv("ADMIN_PASSWORD", "TestAdminPass123")

	cfg := Load()
	if cfg.JWTSecret != secret {
		t.Errorf("JWTSecret = %q, want %q", cfg.JWTSecret, secret)
	}
}
