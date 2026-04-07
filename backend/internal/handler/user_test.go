package handler

import (
	"fmt"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/tivify/backend/internal/service"
)

func setupUserHandler() (*UserHandler, *mockUserRepoForHandler) {
	repo := newMockUserRepoH()
	svc := service.NewUserService(repo)
	handler := NewUserHandler(svc)
	return handler, repo
}

func TestUserHandler_List(t *testing.T) {
	h, repo := setupUserHandler()
	repo.addUser(createTestUserH("user1", "Password123"))
	repo.addUser(createTestUserH("user2", "Password123"))

	app := testApp()
	app.Get("/api/admin/users", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/users", "")

	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestUserHandler_List_WithPagination(t *testing.T) {
	h, repo := setupUserHandler()
	repo.addUser(createTestUserH("user1", "Password123"))

	app := testApp()
	app.Get("/api/admin/users", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/users?page=1&per_page=5", "")

	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestUserHandler_GetByID(t *testing.T) {
	h, repo := setupUserHandler()
	user := createTestUserH("testuser", "Password123")
	repo.addUser(user)

	app := testApp()
	app.Get("/api/admin/users/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/admin/users/%s", user.ID), "")

	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestUserHandler_GetByID_InvalidID(t *testing.T) {
	h, _ := setupUserHandler()

	app := testApp()
	app.Get("/api/admin/users/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/admin/users/not-a-uuid", "")

	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for invalid ID")
	}
}

func TestUserHandler_Create(t *testing.T) {
	h, _ := setupUserHandler()

	app := testApp()
	app.Post("/api/admin/users", h.Create)

	body := `{"username":"newuser","email":"new@test.com","password":"StrongPass123","role":"user"}`
	result, status := makeRequest(app, "POST", "/api/admin/users", body)

	if status != 201 {
		t.Errorf("Create() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("Create() should return success=true")
	}
}

func TestUserHandler_Create_InvalidBody(t *testing.T) {
	h, _ := setupUserHandler()

	app := testApp()
	app.Post("/api/admin/users", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/users", "not-json")

	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for invalid body")
	}
}

func TestUserHandler_Update(t *testing.T) {
	h, repo := setupUserHandler()
	user := createTestUserH("testuser", "Password123")
	repo.addUser(user)

	app := testApp()
	app.Put("/api/admin/users/:id", h.Update)

	body := `{"username":"updateduser"}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/users/%s", user.ID), body)

	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestUserHandler_Update_InvalidID(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Put("/api/admin/users/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/users/not-a-uuid", `{"username":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for invalid ID")
	}
}

func TestUserHandler_Update_InvalidBody(t *testing.T) {
	h, repo := setupUserHandler()
	user := createTestUserH("testuser", "Password123")
	repo.addUser(user)
	app := testApp()
	app.Put("/api/admin/users/:id", h.Update)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/users/%s", user.ID), "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for invalid body")
	}
}

func TestUserHandler_Delete_InvalidID(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Delete("/api/admin/users/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/users/not-a-uuid", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for invalid ID")
	}
}

func TestUserHandler_Delete_NotFound(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("role", "admin")
		return c.Next()
	})
	app.Delete("/api/admin/users/:id", h.Delete)

	fakeID := "00000000-0000-0000-0000-000000000099"
	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/users/%s", fakeID), "")
	if status != 404 {
		t.Errorf("Delete() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for not found")
	}
}

func TestUserHandler_Delete_AdminForbidden(t *testing.T) {
	h, repo := setupUserHandler()
	user := createTestUserH("adminuser", "Password123")
	user.Role = "admin"
	repo.addUser(user)
	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("role", "admin")
		return c.Next()
	})
	app.Delete("/api/admin/users/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/users/%s", user.ID), "")
	if status != 403 {
		t.Errorf("Delete() status = %d, want 403 for admin deletion", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for admin deletion")
	}
}

func TestUserHandler_GetByID_NotFound(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Get("/api/admin/users/:id", h.GetByID)

	fakeID := "00000000-0000-0000-0000-000000000099"
	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/admin/users/%s", fakeID), "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for not found")
	}
}

func TestUserHandler_Delete(t *testing.T) {
	h, repo := setupUserHandler()
	user := createTestUserH("testuser", "Password123")
	repo.addUser(user)

	app := testApp()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("role", "admin")
		return c.Next()
	})
	app.Delete("/api/admin/users/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/users/%s", user.ID), "")

	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestUserHandler_Update_NotFound(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Put("/api/admin/users/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/users/00000000-0000-0000-0000-000000000099", `{"username":"updated"}`)
	if status != 400 {
		t.Errorf("Update() not found status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for not found")
	}
}

func TestUserHandler_Create_DuplicateUsername(t *testing.T) {
	h, repo := setupUserHandler()
	repo.addUser(createTestUserH("existing", "Password123"))

	app := testApp()
	app.Post("/api/admin/users", h.Create)

	body := `{"username":"existing","email":"new@test.com","password":"NewPass123"}`
	result, status := makeRequest(app, "POST", "/api/admin/users", body)
	if status != 400 {
		t.Errorf("Create() duplicate status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for duplicate username")
	}
}

func TestUserHandler_Create_WeakPassword(t *testing.T) {
	h, _ := setupUserHandler()
	app := testApp()
	app.Post("/api/admin/users", h.Create)

	body := `{"username":"newuser","email":"new@test.com","password":"weak"}`
	result, status := makeRequest(app, "POST", "/api/admin/users", body)
	if status != 400 {
		t.Errorf("Create() weak password status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for weak password")
	}
}
