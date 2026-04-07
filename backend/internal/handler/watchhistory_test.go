package handler

import (
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/service"
)

func setupWatchHistoryHandler() *WatchHistoryHandler {
	whRepo := newMockWatchHistoryRepoH()
	channelRepo := newMockChannelRepoH()
	vodRepo := newMockVODRepoH()
	svc := service.NewWatchHistoryService(whRepo, channelRepo, vodRepo)
	return NewWatchHistoryHandler(svc)
}

func TestWatchHistoryHandler_List(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/history", h.List)

	result, status := makeRequest(app, "GET", "/api/history", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestWatchHistoryHandler_List_Unauthorized(t *testing.T) {
	h := setupWatchHistoryHandler()

	app := testApp()
	app.Get("/api/history", h.List)

	result, status := makeRequest(app, "GET", "/api/history", "")
	if status != 401 {
		t.Errorf("List() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("List() should return success=false when not authenticated")
	}
}

func TestWatchHistoryHandler_Record(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Post("/api/history", h.Record)

	body := `{"content_type":"vod","content_id":1,"progress":50,"duration":100}`
	result, status := makeRequest(app, "POST", "/api/history", body)
	if status != 200 {
		t.Errorf("Record() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Record() should return success=true")
	}
}

func TestWatchHistoryHandler_Record_InvalidBody(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Post("/api/history", h.Record)

	result, status := makeRequest(app, "POST", "/api/history", "not-json")
	if status != 400 {
		t.Errorf("Record() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Record() should return success=false for invalid body")
	}
}

func TestWatchHistoryHandler_ContinueWatching(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/history/continue", h.ContinueWatching)

	result, status := makeRequest(app, "GET", "/api/history/continue", "")
	if status != 200 {
		t.Errorf("ContinueWatching() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ContinueWatching() should return success=true")
	}
}

func TestWatchHistoryHandler_Record_Unauthorized(t *testing.T) {
	h := setupWatchHistoryHandler()
	app := testApp()
	app.Post("/api/history", h.Record)

	body := `{"content_type":"vod","content_id":1,"progress":50,"duration":100}`
	result, status := makeRequest(app, "POST", "/api/history", body)
	if status != 401 {
		t.Errorf("Record() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Record() should return success=false when not authenticated")
	}
}

func TestWatchHistoryHandler_ContinueWatching_Unauthorized(t *testing.T) {
	h := setupWatchHistoryHandler()
	app := testApp()
	app.Get("/api/history/continue", h.ContinueWatching)

	result, status := makeRequest(app, "GET", "/api/history/continue", "")
	if status != 401 {
		t.Errorf("ContinueWatching() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("ContinueWatching() should return success=false when not authenticated")
	}
}

func TestWatchHistoryHandler_ContinueWatching_WithLimit(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/history/continue", h.ContinueWatching)

	result, status := makeRequest(app, "GET", "/api/history/continue?limit=5", "")
	if status != 200 {
		t.Errorf("ContinueWatching() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ContinueWatching() should return success=true")
	}
}

func TestWatchHistoryHandler_ContinueWatching_LimitClamped(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/history/continue", h.ContinueWatching)

	// limit > 20 should be clamped
	result, status := makeRequest(app, "GET", "/api/history/continue?limit=50", "")
	if status != 200 {
		t.Errorf("ContinueWatching() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ContinueWatching() should return success=true with clamped limit")
	}
}

func TestWatchHistoryHandler_ContinueWatching_NegativeLimit(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/history/continue", h.ContinueWatching)

	// limit < 1 should default to 10
	result, status := makeRequest(app, "GET", "/api/history/continue?limit=-1", "")
	if status != 200 {
		t.Errorf("ContinueWatching() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ContinueWatching() should return success=true with default limit")
	}
}

func TestWatchHistoryHandler_Delete(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Delete("/api/history/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/history/1", "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestWatchHistoryHandler_Delete_Unauthorized(t *testing.T) {
	h := setupWatchHistoryHandler()
	app := testApp()
	app.Delete("/api/history/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/history/1", "")
	if status != 401 {
		t.Errorf("Delete() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false when not authenticated")
	}
}

func TestWatchHistoryHandler_Delete_InvalidID(t *testing.T) {
	h := setupWatchHistoryHandler()
	userID := uuid.New()
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Delete("/api/history/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/history/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for invalid ID")
	}
}
