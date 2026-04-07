package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupVODHandler() (*VODHandler, *mockVODRepoH) {
	repo := newMockVODRepoH()
	svc := service.NewVODService(repo, nil) // nil TMDB — not needed for CRUD
	handler := NewVODHandler(svc)
	return handler, repo
}

func TestVODHandler_List(t *testing.T) {
	h, repo := setupVODHandler()
	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})

	app := testApp()
	app.Get("/api/admin/vods", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/vods", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestVODHandler_ListActive(t *testing.T) {
	h, repo := setupVODHandler()
	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})

	app := testApp()
	app.Get("/api/vods", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/vods", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestVODHandler_GetByID(t *testing.T) {
	h, repo := setupVODHandler()
	vod := &model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true}
	repo.addVOD(vod)

	app := testApp()
	app.Get("/api/vods/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/vods/%d", vod.ID), "")
	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestVODHandler_GetByID_NotFound(t *testing.T) {
	h, _ := setupVODHandler()

	app := testApp()
	app.Get("/api/vods/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/vods/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false")
	}
}

func TestVODHandler_GetByID_InvalidID(t *testing.T) {
	h, _ := setupVODHandler()

	app := testApp()
	app.Get("/api/vods/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/vods/abc", "")
	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false for invalid ID")
	}
}

func TestVODHandler_Create(t *testing.T) {
	h, _ := setupVODHandler()

	app := testApp()
	app.Post("/api/admin/vods", h.Create)

	body := `{"title":"New Movie","stream_url":"http://example.com/movie.m3u8"}`
	result, status := makeRequest(app, "POST", "/api/admin/vods", body)
	if status != 201 {
		t.Errorf("Create() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("Create() should return success=true")
	}
}

func TestVODHandler_Create_InvalidBody(t *testing.T) {
	h, _ := setupVODHandler()

	app := testApp()
	app.Post("/api/admin/vods", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/vods", "not-json")
	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for invalid body")
	}
}

func TestVODHandler_Update(t *testing.T) {
	h, repo := setupVODHandler()
	vod := &model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true}
	repo.addVOD(vod)

	app := testApp()
	app.Put("/api/admin/vods/:id", h.Update)

	body := `{"title":"Updated Movie"}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/vods/%d", vod.ID), body)
	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestVODHandler_Delete(t *testing.T) {
	h, repo := setupVODHandler()
	vod := &model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true}
	repo.addVOD(vod)

	app := testApp()
	app.Delete("/api/admin/vods/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/vods/%d", vod.ID), "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestVODHandler_DebugStats(t *testing.T) {
	h, _ := setupVODHandler()

	app := testApp()
	app.Get("/api/admin/vods/debug", h.DebugStats)

	result, status := makeRequest(app, "GET", "/api/admin/vods/debug", "")
	if status != 200 {
		t.Errorf("DebugStats() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("DebugStats() should return success=true")
	}
}

func TestVODHandler_Update_InvalidID(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Put("/api/admin/vods/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/vods/abc", `{"title":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestVODHandler_Update_InvalidBody(t *testing.T) {
	h, repo := setupVODHandler()
	vod := &model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true}
	repo.addVOD(vod)
	app := testApp()
	app.Put("/api/admin/vods/:id", h.Update)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/vods/%d", vod.ID), "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestVODHandler_Delete_InvalidID(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Delete("/api/admin/vods/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/vods/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false")
	}
}

func TestVODHandler_EnrichWithTMDB_NilService(t *testing.T) {
	// With nil TMDB, EnrichWithTMDB should return an error
	h, _ := setupVODHandler()
	app := testApp()
	app.Post("/api/admin/vods/enrich", h.EnrichWithTMDB)

	result, status := makeRequest(app, "POST", "/api/admin/vods/enrich", "")
	// Service returns error when TMDB is nil
	if status != 500 {
		t.Errorf("EnrichWithTMDB() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("EnrichWithTMDB() should return success=false when TMDB is nil")
	}
}

func TestVODHandler_ListActive_WithCategoryFilter(t *testing.T) {
	h, repo := setupVODHandler()
	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
	app := testApp()
	app.Get("/api/vods", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/vods?category_id=1", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestVODHandler_ListActive_WithSearch(t *testing.T) {
	h, repo := setupVODHandler()
	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
	app := testApp()
	app.Get("/api/vods", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/vods?search=Movie", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestVODHandler_Update_NotFound(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Put("/api/admin/vods/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/vods/999", `{"title":"Updated"}`)
	if status != 400 {
		t.Errorf("Update() not found status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for not found")
	}
}

func TestVODHandler_Delete_NotFound(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Delete("/api/admin/vods/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/vods/999", "")
	if status != 500 {
		t.Errorf("Delete() not found status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for not found")
	}
}

func TestVODHandler_Create_EmptyTitle(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Post("/api/admin/vods", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/vods", `{"title":""}`)
	if status != 400 {
		t.Errorf("Create() empty title status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for empty title")
	}
}

func TestVODHandler_Create_TitleTooLong(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Post("/api/admin/vods", h.Create)

	longTitle := fmt.Sprintf(`{"title":"%s"}`, string(make([]byte, 300)))
	result, status := makeRequest(app, "POST", "/api/admin/vods", longTitle)
	if status != 400 {
		t.Errorf("Create() long title status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for long title")
	}
}

func TestVODHandler_Update_TitleTooLong(t *testing.T) {
	h, repo := setupVODHandler()
	vod := &model.VOD{Title: "Movie", Slug: "movie", IsActive: true}
	repo.addVOD(vod)
	app := testApp()
	app.Put("/api/admin/vods/:id", h.Update)

	longTitle := fmt.Sprintf(`{"title":"%s"}`, string(make([]byte, 300)))
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/vods/%d", vod.ID), longTitle)
	if status != 400 {
		t.Errorf("Update() long title status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for long title")
	}
}

func TestVODHandler_ListActive_InvalidCategoryID(t *testing.T) {
	h, _ := setupVODHandler()
	app := testApp()
	app.Get("/api/vods", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/vods?category_id=abc", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200 (ignores invalid category_id)", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true (ignores invalid category_id)")
	}
}
