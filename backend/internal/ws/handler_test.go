package ws

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestUpgradeMiddleware_NonWebSocket(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	// Non-WebSocket request should get 426 Upgrade Required
	req := httptest.NewRequest("GET", "/ws", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 426 {
		t.Errorf("expected status 426 Upgrade Required, got %d", resp.StatusCode)
	}
}

func TestUpgradeMiddleware_WebSocketUpgrade(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("upgraded")
	})

	// WebSocket upgrade request (proper headers)
	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	// Should pass through to handler (200 ok or websocket upgrade)
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == 426 {
		t.Error("WebSocket upgrade request should not be rejected")
	}
	// If it reached the handler, response should contain "upgraded"
	if string(body) == "upgraded" {
		// Success - middleware passed through
	}
}

func TestUpgradeMiddleware_NonWebSocket_POST(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Post("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("POST", "/ws", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 426 {
		t.Errorf("POST without upgrade should get 426, got %d", resp.StatusCode)
	}
}

func TestUpgradeMiddleware_PartialHeaders(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	// Only Connection: Upgrade, missing Upgrade: websocket
	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 426 {
		t.Errorf("partial upgrade headers should get 426, got %d", resp.StatusCode)
	}
}

func TestUpgradeMiddleware_OnlyUpgradeHeader(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	// Only Upgrade: websocket header, missing Connection: Upgrade
	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Upgrade", "websocket")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	// Should still be rejected because IsWebSocketUpgrade checks both headers
	if resp.StatusCode != 426 {
		t.Errorf("only Upgrade header should get 426, got %d", resp.StatusCode)
	}
}

func TestUpgradeMiddleware_WrongUpgradeValue(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "h2c") // not websocket

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 426 {
		t.Errorf("wrong Upgrade value should get 426, got %d", resp.StatusCode)
	}
}

func TestUpgradeMiddleware_ResponseBody(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/ws", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 426 {
		t.Errorf("expected 426, got %d", resp.StatusCode)
	}
	// Verify response body contains error message
	if len(body) == 0 {
		t.Error("expected non-empty error body for 426 response")
	}
}

func TestUpgradeMiddleware_MultiplePaths(t *testing.T) {
	app := fiber.New()
	app.Use(UpgradeMiddleware())
	app.Get("/ws", func(c *fiber.Ctx) error {
		return c.SendString("ws")
	})
	app.Get("/api/data", func(c *fiber.Ctx) error {
		return c.SendString("data")
	})

	// Non-upgrade request to /api/data should also be rejected by middleware
	req := httptest.NewRequest("GET", "/api/data", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("app.Test() error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 426 {
		t.Errorf("non-upgrade to /api/data should get 426, got %d", resp.StatusCode)
	}
}

func TestHandler_ReturnsHandler(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	handler := Handler(hub)
	if handler == nil {
		t.Fatal("Handler() returned nil")
	}
}

func TestHandler_NoToken(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	app := fiber.New()
	// Skip upgrade middleware for direct testing
	app.Get("/ws", Handler(hub))

	// Without WebSocket upgrade headers, this should fail
	req := httptest.NewRequest("GET", "/ws", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Without proper upgrade, fiber returns 426 or similar
	if resp.StatusCode == 200 {
		t.Error("Handler without WebSocket upgrade should not succeed")
	}
}

func TestHandler_WithQueryParam_NoUpgrade(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	app := fiber.New()
	app.Get("/ws", Handler(hub))

	// Provide a token query param but no WebSocket upgrade headers
	req := httptest.NewRequest("GET", "/ws?token=some-fake-token", nil)
	resp, _ := app.Test(req, -1)
	defer resp.Body.Close()

	// Without WebSocket upgrade, should fail
	if resp.StatusCode == 200 {
		t.Error("Handler with token but no upgrade should not succeed")
	}
}

func TestConstants(t *testing.T) {
	// Verify that the exported-via-testing constants have sensible values
	if writeWait <= 0 {
		t.Error("writeWait should be positive")
	}
	if pongWait <= 0 {
		t.Error("pongWait should be positive")
	}
	if pingPeriod <= 0 {
		t.Error("pingPeriod should be positive")
	}
	if pingPeriod >= pongWait {
		t.Errorf("pingPeriod (%v) should be less than pongWait (%v)", pingPeriod, pongWait)
	}
}
