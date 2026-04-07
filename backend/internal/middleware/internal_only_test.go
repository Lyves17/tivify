package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestInternalOnly_Localhost(t *testing.T) {
	app := testApp()
	app.Use(InternalOnly())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	// Default httptest client IP is typically 0.0.0.0
	// Set X-Forwarded-For to simulate localhost
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 for localhost", resp.StatusCode)
	}
}

func TestInternalOnly_IPv6Loopback(t *testing.T) {
	app := testApp()
	app.Use(InternalOnly())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "::1")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 for IPv6 loopback", resp.StatusCode)
	}
}

func TestInternalOnly_ExternalIP(t *testing.T) {
	app := fiber.New(fiber.Config{
		// Trust no proxy headers so c.IP() returns the header value
	})
	app.Use(InternalOnly())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "8.8.8.8")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Should be 403 since X-Forwarded-For is external and c.IP() from httptest is 0.0.0.0
	if resp.StatusCode != 403 {
		t.Errorf("status = %d, want 403 for external IP", resp.StatusCode)
	}
}

func TestInternalOnly_MultipleForwardedIPs(t *testing.T) {
	app := testApp()
	app.Use(InternalOnly())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "127.0.0.1, 10.0.0.1")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 for forwarded localhost", resp.StatusCode)
	}
}
