package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestRequestID_Generated(t *testing.T) {
	var capturedID string

	app := testApp()
	app.Use(RequestID())
	app.Get("/test", func(c *fiber.Ctx) error {
		capturedID = GetRequestID(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
	if capturedID == "" {
		t.Error("RequestID should be generated when not provided")
	}

	responseID := resp.Header.Get("X-Request-ID")
	if responseID == "" {
		t.Error("X-Request-ID header should be set in response")
	}
	if responseID != capturedID {
		t.Errorf("response header %q != context value %q", responseID, capturedID)
	}
}

func TestRequestID_Propagated(t *testing.T) {
	var capturedID string
	existingID := "existing-request-id-123"

	app := testApp()
	app.Use(RequestID())
	app.Get("/test", func(c *fiber.Ctx) error {
		capturedID = GetRequestID(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Request-ID", existingID)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if capturedID != existingID {
		t.Errorf("capturedID = %q, want %q (should propagate existing ID)", capturedID, existingID)
	}

	responseID := resp.Header.Get("X-Request-ID")
	if responseID != existingID {
		t.Errorf("response header = %q, want %q", responseID, existingID)
	}
}

func TestGetRequestID_Missing(t *testing.T) {
	app := testApp()
	var capturedID string

	app.Get("/test", func(c *fiber.Ctx) error {
		capturedID = GetRequestID(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if capturedID != "" {
		t.Errorf("capturedID = %q, want empty string for missing context", capturedID)
	}
}
