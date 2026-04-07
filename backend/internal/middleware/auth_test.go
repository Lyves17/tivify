package middleware

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/util"
)

func init() {
	util.InitJWT("test-secret-key-at-least-32-chars!!", 15*time.Minute)
}

func testApp() *fiber.App {
	return fiber.New()
}

func TestAuthRequired_MissingHeader(t *testing.T) {
	app := testApp()
	app.Use(AuthRequired())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthRequired_InvalidFormat(t *testing.T) {
	app := testApp()
	app.Use(AuthRequired())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "InvalidTokenNoBearer")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthRequired_InvalidToken(t *testing.T) {
	app := testApp()
	app.Use(AuthRequired())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token-here")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 401 {
		t.Errorf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAuthRequired_ValidToken(t *testing.T) {
	userID := uuid.New()
	token, err := util.GenerateAccessToken(userID, "admin")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	var capturedUserID uuid.UUID
	var capturedRole string

	app := testApp()
	app.Use(AuthRequired())
	app.Get("/test", func(c *fiber.Ctx) error {
		capturedUserID = c.Locals("user_id").(uuid.UUID)
		capturedRole = c.Locals("role").(string)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("status = %d, want 200, body: %s", resp.StatusCode, string(body))
	}
	if capturedUserID != userID {
		t.Errorf("userID = %v, want %v", capturedUserID, userID)
	}
	if capturedRole != "admin" {
		t.Errorf("role = %q, want %q", capturedRole, "admin")
	}
}

func TestAuthRequired_ResponseFormat(t *testing.T) {
	app := testApp()
	app.Use(AuthRequired())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["success"] != false {
		t.Error("should return success=false")
	}
	if result["message"] == nil || result["message"] == "" {
		t.Error("should include error message")
	}
}
