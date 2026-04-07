package handler

import (
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupFavoriteHandler() (*FavoriteHandler, *mockFavoriteRepoH) {
	favRepo := newMockFavoriteRepoH()
	channelRepo := newMockChannelRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()
	svc := service.NewFavoriteService(favRepo, channelRepo, vodRepo, seriesRepo)
	handler := NewFavoriteHandler(svc)
	return handler, favRepo
}

func TestFavoriteHandler_List(t *testing.T) {
	h, _ := setupFavoriteHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Get("/api/favorites", h.List)

	result, status := makeRequest(app, "GET", "/api/favorites", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestFavoriteHandler_List_Unauthorized(t *testing.T) {
	h, _ := setupFavoriteHandler()

	app := testApp()
	app.Get("/api/favorites", h.List)

	result, status := makeRequest(app, "GET", "/api/favorites", "")
	if status != 401 {
		t.Errorf("List() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("List() should return success=false when not authenticated")
	}
}

func TestFavoriteHandler_Toggle_Add(t *testing.T) {
	h, _ := setupFavoriteHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Post("/api/favorites/toggle", h.Toggle)

	body := `{"type":"channel","id":1}`
	result, status := makeRequest(app, "POST", "/api/favorites/toggle", body)
	if status != 200 {
		t.Errorf("Toggle() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Toggle() should return success=true")
	}
}

func TestFavoriteHandler_Toggle_Remove(t *testing.T) {
	h, favRepo := setupFavoriteHandler()
	userID := uuid.New()

	// Pre-add a favorite
	favRepo.Create(&model.Favorite{UserID: userID, FavoritableType: "channel", FavoritableID: 1})

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Post("/api/favorites/toggle", h.Toggle)

	body := `{"type":"channel","id":1}`
	result, status := makeRequest(app, "POST", "/api/favorites/toggle", body)
	if status != 200 {
		t.Errorf("Toggle() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Toggle() should return success=true")
	}
}

func TestFavoriteHandler_Toggle_InvalidBody(t *testing.T) {
	h, _ := setupFavoriteHandler()
	userID := uuid.New()

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("user_id", userID)
		return c.Next()
	})
	app.Post("/api/favorites/toggle", h.Toggle)

	result, status := makeRequest(app, "POST", "/api/favorites/toggle", "not-json")
	if status != 400 {
		t.Errorf("Toggle() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Toggle() should return success=false for invalid body")
	}
}

func TestFavoriteHandler_Toggle_Unauthorized(t *testing.T) {
	h, _ := setupFavoriteHandler()

	app := testApp()
	app.Post("/api/favorites/toggle", h.Toggle)

	body := `{"type":"channel","id":1}`
	result, status := makeRequest(app, "POST", "/api/favorites/toggle", body)
	if status != 401 {
		t.Errorf("Toggle() status = %d, want 401", status)
	}
	if result.Success {
		t.Error("Toggle() should return success=false when not authenticated")
	}
}
