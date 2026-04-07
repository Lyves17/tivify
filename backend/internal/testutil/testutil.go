package testutil

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/config"
	"github.com/tivify/backend/internal/util"
)

// TestConfig returns a config suitable for testing.
func TestConfig() *config.Config {
	return &config.Config{
		AppEnv:             "test",
		AppPort:            "3999",
		JWTSecret:          "test-secret-key-at-least-32-chars-long",
		JWTExpiry:          15 * time.Minute,
		RefreshTokenExpiry: 168 * time.Hour,
		AdminUsername:      "admin",
		AdminPassword:      "testpassword123",
		AdminEmail:         "admin@test.local",
		MediaPath:          "/tmp/tivify-test-media",
		FFmpegPath:         "ffmpeg",
		FFprobePath:        "ffprobe",
		BaseURL:            "http://localhost:3999",
		CORSAllowOrigins:   "*",
	}
}

// TestFiberApp creates a Fiber app configured for testing.
func TestFiberApp() *fiber.App {
	return fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"success": false,
				"message": err.Error(),
			})
		},
	})
}

// InitTestJWT initializes JWT for testing.
func InitTestJWT() {
	util.InitJWT("test-secret-key-at-least-32-chars-long", 15*time.Minute)
}

// GenerateTestAccessToken generates a valid JWT access token for testing.
func GenerateTestAccessToken(userID uuid.UUID, role string) string {
	InitTestJWT()
	token, err := util.GenerateAccessToken(userID, role)
	if err != nil {
		panic("failed to generate test token: " + err.Error())
	}
	return token
}

// TestUserID returns a fixed UUID for testing.
func TestUserID() uuid.UUID {
	return uuid.MustParse("00000000-0000-0000-0000-000000000001")
}

// TestAdminID returns a fixed admin UUID for testing.
func TestAdminID() uuid.UUID {
	return uuid.MustParse("00000000-0000-0000-0000-000000000002")
}

// MakeRequest creates an HTTP request for testing Fiber handlers.
func MakeRequest(method, path string, body string) *http.Request {
	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	return req
}

// MakeAuthenticatedRequest creates an authenticated HTTP request for testing.
func MakeAuthenticatedRequest(method, path, body string, userID uuid.UUID, role string) *http.Request {
	req := MakeRequest(method, path, body)
	token := GenerateTestAccessToken(userID, role)
	req.Header.Set("Authorization", "Bearer "+token)
	return req
}

// ParseJSONResponse parses a Fiber test response body into the target struct.
func ParseJSONResponse(resp *http.Response, target interface{}) error {
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(target)
}

// APIResponse is the standard API response used in assertions.
type APIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Message string          `json:"message,omitempty"`
}

// PaginatedResponse is a paginated API response used in assertions.
type PaginatedResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Meta    struct {
		Total   int64 `json:"total"`
		Page    int   `json:"page"`
		PerPage int   `json:"per_page"`
		Pages   int64 `json:"pages"`
	} `json:"meta"`
}
