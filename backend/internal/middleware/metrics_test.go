package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestNormalizePath_Empty(t *testing.T) {
	if got := normalizePath(""); got != "unknown" {
		t.Errorf("normalizePath(\"\") = %q, want %q", got, "unknown")
	}
}

func TestNormalizePath_WithPath(t *testing.T) {
	if got := normalizePath("/users/:id"); got != "/users/:id" {
		t.Errorf("normalizePath(\"/users/:id\") = %q, want %q", got, "/users/:id")
	}
}

func TestNormalizePath_StaticPath(t *testing.T) {
	if got := normalizePath("/api/v1/channels"); got != "/api/v1/channels" {
		t.Errorf("normalizePath(\"/api/v1/channels\") = %q, want %q", got, "/api/v1/channels")
	}
}

func TestMetrics_RecordsRequest(t *testing.T) {
	app := testApp()
	app.Use(Metrics())
	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("hello")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200", resp.StatusCode)
	}
}

func TestMetrics_Records404(t *testing.T) {
	app := testApp()
	app.Use(Metrics())
	app.Get("/exists", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/notfound", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 404 {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

func TestMetrics_RecordsPostRequest(t *testing.T) {
	app := testApp()
	app.Use(Metrics())
	app.Post("/api/data", func(c *fiber.Ctx) error {
		return c.Status(201).SendString("created")
	})

	req := httptest.NewRequest("POST", "/api/data", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		t.Errorf("status = %d, want 201", resp.StatusCode)
	}
}

func TestMetrics_RecordsErrorStatus(t *testing.T) {
	app := testApp()
	app.Use(Metrics())
	app.Get("/error", func(c *fiber.Ctx) error {
		return c.Status(500).SendString("internal error")
	})

	req := httptest.NewRequest("GET", "/error", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 500 {
		t.Errorf("status = %d, want 500", resp.StatusCode)
	}
}
