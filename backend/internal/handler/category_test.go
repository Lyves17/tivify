package handler

import (
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupCategoryHandler() (*CategoryHandler, *mockCategoryRepoH) {
	repo := newMockCategoryRepoH()
	cache := &mockCacheH{}
	svc := service.NewCategoryService(repo, cache)
	handler := NewCategoryHandler(svc)
	return handler, repo
}

func TestCategoryHandler_List(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

	app := testApp()
	app.Get("/api/categories", h.List)

	result, status := makeRequest(app, "GET", "/api/categories", "")

	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestCategoryHandler_ListByType(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

	app := testApp()
	app.Get("/api/categories/type", h.ListByType)

	result, status := makeRequest(app, "GET", "/api/categories/type?type=live", "")

	if status != 200 {
		t.Errorf("ListByType() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListByType() should return success=true")
	}
}

func TestCategoryHandler_ListByType_MissingType(t *testing.T) {
	h, _ := setupCategoryHandler()

	app := testApp()
	app.Get("/api/categories/type", h.ListByType)

	result, status := makeRequest(app, "GET", "/api/categories/type", "")

	if status != 400 {
		t.Errorf("ListByType() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("ListByType() should return success=false for missing type")
	}
}

func TestCategoryHandler_GetByID(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

	app := testApp()
	app.Get("/api/categories/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/categories/1", "")

	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestCategoryHandler_GetByID_InvalidID(t *testing.T) {
	h, _ := setupCategoryHandler()

	app := testApp()
	app.Get("/api/categories/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/categories/abc", "")

	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for invalid ID")
	}
}

func TestCategoryHandler_Create(t *testing.T) {
	h, _ := setupCategoryHandler()

	app := testApp()
	app.Post("/api/admin/categories", h.Create)

	body := `{"name":"New Category","type":"live"}`
	result, status := makeRequest(app, "POST", "/api/admin/categories", body)

	if status != 201 {
		t.Errorf("Create() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("Create() should return success=true")
	}
}

func TestCategoryHandler_Create_InvalidBody(t *testing.T) {
	h, _ := setupCategoryHandler()

	app := testApp()
	app.Post("/api/admin/categories", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/categories", "not-json")

	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false")
	}
}

func TestCategoryHandler_Update(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

	app := testApp()
	app.Put("/api/admin/categories/:id", h.Update)

	body := `{"name":"Updated Sports"}`
	result, status := makeRequest(app, "PUT", "/api/admin/categories/1", body)

	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestCategoryHandler_Update_InvalidID(t *testing.T) {
	h, _ := setupCategoryHandler()
	app := testApp()
	app.Put("/api/admin/categories/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/categories/abc", `{"name":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for invalid ID")
	}
}

func TestCategoryHandler_Update_InvalidBody(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})
	app := testApp()
	app.Put("/api/admin/categories/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/categories/1", "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for invalid body")
	}
}

func TestCategoryHandler_Delete_InvalidID(t *testing.T) {
	h, _ := setupCategoryHandler()
	app := testApp()
	app.Delete("/api/admin/categories/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/categories/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for invalid ID")
	}
}

func TestCategoryHandler_GetByID_NotFound(t *testing.T) {
	h, _ := setupCategoryHandler()
	app := testApp()
	app.Get("/api/categories/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/categories/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for not found")
	}
}

func TestCategoryHandler_Create_EmptyName(t *testing.T) {
	h, _ := setupCategoryHandler()
	app := testApp()
	app.Post("/api/admin/categories", h.Create)

	body := `{"name":"","type":"live"}`
	result, status := makeRequest(app, "POST", "/api/admin/categories", body)
	if status != 400 {
		t.Errorf("Create() status = %d, want 400 for empty name", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for empty name")
	}
}

func TestCategoryHandler_Delete(t *testing.T) {
	h, repo := setupCategoryHandler()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

	app := testApp()
	app.Delete("/api/admin/categories/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/categories/1", "")

	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}
