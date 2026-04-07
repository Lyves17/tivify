package middleware

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestRateLimit_AllowsWithinLimit(t *testing.T) {
	app := testApp()
	app.Use(RateLimit(5, 1*time.Minute))
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req, -1)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Errorf("request %d: status = %d, want 200", i+1, resp.StatusCode)
		}
	}
}

func TestRateLimit_BlocksAfterLimit(t *testing.T) {
	app := testApp()
	app.Use(RateLimit(2, 1*time.Minute))
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	// First 2 requests should succeed
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req, -1)
		resp.Body.Close()
	}

	// 3rd request should be blocked
	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 429 {
		t.Errorf("status = %d, want 429", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["success"] != false {
		t.Error("should return success=false")
	}
}

func TestRateLimitStrict(t *testing.T) {
	handler := RateLimitStrict()
	if handler == nil {
		t.Error("RateLimitStrict should not return nil")
	}
}

func TestRateLimitModerate(t *testing.T) {
	handler := RateLimitModerate()
	if handler == nil {
		t.Error("RateLimitModerate should not return nil")
	}
}

func TestRateLimitRelaxed(t *testing.T) {
	handler := RateLimitRelaxed()
	if handler == nil {
		t.Error("RateLimitRelaxed should not return nil")
	}
}

func TestRateLimitLibraryScan(t *testing.T) {
	handler := RateLimitLibraryScan()
	if handler == nil {
		t.Error("RateLimitLibraryScan should not return nil")
	}
}

func TestRateLimitUpload(t *testing.T) {
	handler := RateLimitUpload()
	if handler == nil {
		t.Error("RateLimitUpload should not return nil")
	}
}
