package middleware

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestBodyLimit_BelowLimit(t *testing.T) {
	app := testApp()
	app.Use(BodyLimit(1024))
	app.Post("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	body := strings.NewReader("small body")
	req := httptest.NewRequest("POST", "/test", body)
	req.Header.Set("Content-Type", "text/plain")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d, want 200 for body below limit", resp.StatusCode)
	}
}

func TestBodyLimit_AboveLimit(t *testing.T) {
	app := testApp()
	app.Use(BodyLimit(10))
	app.Post("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	body := strings.NewReader("this body is longer than 10 bytes")
	req := httptest.NewRequest("POST", "/test", body)
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("Content-Length", "33")
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	if resp.StatusCode != 413 {
		t.Errorf("status = %d, want 413 for body above limit", resp.StatusCode)
	}
}

func TestBodyLimitLargeFile(t *testing.T) {
	mw := BodyLimitLargeFile()
	if mw == nil {
		t.Error("BodyLimitLargeFile() should return a non-nil handler")
	}
}

func TestBodyLimitMediumFile(t *testing.T) {
	mw := BodyLimitMediumFile()
	if mw == nil {
		t.Error("BodyLimitMediumFile() should return a non-nil handler")
	}
}
