package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestCORS_DefaultOrigin(t *testing.T) {
	handler := CORS("")
	if handler == nil {
		t.Error("CORS should not return nil")
	}

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestCORS_WildcardOrigin(t *testing.T) {
	handler := CORS("*")
	if handler == nil {
		t.Error("CORS should not return nil for wildcard")
	}

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://anywhere.com")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestCORS_CustomOrigins(t *testing.T) {
	handler := CORS("http://localhost:3000, http://example.com")
	if handler == nil {
		t.Error("CORS should not return nil for custom origins")
	}

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestCORS_PreflightRequest(t *testing.T) {
	handler := CORS("http://localhost:3000")

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("OPTIONS", "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Preflight should return 204 or 200
	if resp.StatusCode != 204 && resp.StatusCode != 200 {
		t.Errorf("OPTIONS status = %d, want 204 or 200", resp.StatusCode)
	}
}

func TestCORS_CustomOrigins_Disallowed(t *testing.T) {
	handler := CORS("http://localhost:3000, http://example.com")

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://evil.com")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Should still return 200 but without CORS headers
	acao := resp.Header.Get("Access-Control-Allow-Origin")
	if acao == "http://evil.com" {
		t.Error("should not allow evil.com origin")
	}
}

func TestCORS_Wildcard_AllowsAnyOrigin(t *testing.T) {
	handler := CORS("*")

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://random-site.com")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	acao := resp.Header.Get("Access-Control-Allow-Origin")
	if acao != "*" && acao != "http://random-site.com" {
		t.Errorf("wildcard should allow any origin, got ACAO=%q", acao)
	}
}

func TestCORS_CustomOrigins_SecondOrigin(t *testing.T) {
	handler := CORS("http://localhost:3000, http://example.com")

	app := testApp()
	app.Use(handler)
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Origin", "http://example.com")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}
