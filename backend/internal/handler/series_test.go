package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupSeriesHandler() (*SeriesHandler, *mockSeriesRepoH) {
	seriesRepo := newMockSeriesRepoH()
	vodRepo := newMockVODRepoH()
	svc := service.NewSeriesService(seriesRepo, vodRepo, nil) // nil TMDB
	handler := NewSeriesHandler(svc)
	return handler, seriesRepo
}

func TestSeriesHandler_List(t *testing.T) {
	h, repo := setupSeriesHandler()
	repo.addSeries(&model.Series{Title: "Series 1", Slug: "series-1", IsActive: true})

	app := testApp()
	app.Get("/api/admin/series", h.List)

	result, status := makeRequest(app, "GET", "/api/admin/series", "")
	if status != 200 {
		t.Errorf("List() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("List() should return success=true")
	}
}

func TestSeriesHandler_ListActive(t *testing.T) {
	h, repo := setupSeriesHandler()
	repo.addSeries(&model.Series{Title: "Series 1", Slug: "series-1", IsActive: true})

	app := testApp()
	app.Get("/api/series", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/series", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestSeriesHandler_GetByID(t *testing.T) {
	h, repo := setupSeriesHandler()
	s := &model.Series{Title: "Series 1", Slug: "series-1", IsActive: true}
	repo.addSeries(s)

	app := testApp()
	app.Get("/api/series/:id", h.GetByID)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/series/%d", s.ID), "")
	if status != 200 {
		t.Errorf("GetByID() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetByID() should return success=true")
	}
}

func TestSeriesHandler_GetByID_NotFound(t *testing.T) {
	h, _ := setupSeriesHandler()

	app := testApp()
	app.Get("/api/series/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/series/999", "")
	if status != 404 {
		t.Errorf("GetByID() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false")
	}
}

func TestSeriesHandler_GetEpisodes(t *testing.T) {
	h, repo := setupSeriesHandler()
	s := &model.Series{Title: "Series 1", Slug: "series-1", IsActive: true}
	repo.addSeries(s)

	app := testApp()
	app.Get("/api/series/:id/episodes", h.GetEpisodes)

	result, status := makeRequest(app, "GET", fmt.Sprintf("/api/series/%d/episodes", s.ID), "")
	if status != 200 {
		t.Errorf("GetEpisodes() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetEpisodes() should return success=true")
	}
}

func TestSeriesHandler_Create(t *testing.T) {
	h, _ := setupSeriesHandler()

	app := testApp()
	app.Post("/api/admin/series", h.Create)

	body := `{"title":"New Series"}`
	result, status := makeRequest(app, "POST", "/api/admin/series", body)
	if status != 201 {
		t.Errorf("Create() status = %d, want 201", status)
	}
	if !result.Success {
		t.Error("Create() should return success=true")
	}
}

func TestSeriesHandler_Create_InvalidBody(t *testing.T) {
	h, _ := setupSeriesHandler()

	app := testApp()
	app.Post("/api/admin/series", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/series", "not-json")
	if status != 400 {
		t.Errorf("Create() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for invalid body")
	}
}

func TestSeriesHandler_Update(t *testing.T) {
	h, repo := setupSeriesHandler()
	s := &model.Series{Title: "Series 1", Slug: "series-1", IsActive: true}
	repo.addSeries(s)

	app := testApp()
	app.Put("/api/admin/series/:id", h.Update)

	body := `{"title":"Updated Series"}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/series/%d", s.ID), body)
	if status != 200 {
		t.Errorf("Update() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Update() should return success=true")
	}
}

func TestSeriesHandler_Delete(t *testing.T) {
	h, repo := setupSeriesHandler()
	s := &model.Series{Title: "Series 1", Slug: "series-1", IsActive: true}
	repo.addSeries(s)

	app := testApp()
	app.Delete("/api/admin/series/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", fmt.Sprintf("/api/admin/series/%d", s.ID), "")
	if status != 200 {
		t.Errorf("Delete() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Delete() should return success=true")
	}
}

func TestSeriesHandler_GetByID_InvalidID(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Get("/api/series/:id", h.GetByID)

	result, status := makeRequest(app, "GET", "/api/series/abc", "")
	if status != 400 {
		t.Errorf("GetByID() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetByID() should return success=false")
	}
}

func TestSeriesHandler_GetEpisodes_InvalidID(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Get("/api/series/:id/episodes", h.GetEpisodes)

	result, status := makeRequest(app, "GET", "/api/series/abc/episodes", "")
	if status != 400 {
		t.Errorf("GetEpisodes() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("GetEpisodes() should return success=false")
	}
}

func TestSeriesHandler_Update_InvalidID(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Put("/api/admin/series/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/series/abc", `{"title":"test"}`)
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestSeriesHandler_Update_InvalidBody(t *testing.T) {
	h, repo := setupSeriesHandler()
	s := &model.Series{Title: "Series 1", Slug: "series-1", IsActive: true}
	repo.addSeries(s)
	app := testApp()
	app.Put("/api/admin/series/:id", h.Update)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/series/%d", s.ID), "not-json")
	if status != 400 {
		t.Errorf("Update() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false")
	}
}

func TestSeriesHandler_Delete_InvalidID(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Delete("/api/admin/series/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/series/abc", "")
	if status != 400 {
		t.Errorf("Delete() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false")
	}
}

func TestSeriesHandler_EnrichWithTMDB_NilService(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Post("/api/admin/series/enrich", h.EnrichWithTMDB)

	result, status := makeRequest(app, "POST", "/api/admin/series/enrich", "")
	if status != 500 {
		t.Errorf("EnrichWithTMDB() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("EnrichWithTMDB() should return success=false when TMDB is nil")
	}
}

func TestSeriesHandler_ListActive_WithCategoryFilter(t *testing.T) {
	h, repo := setupSeriesHandler()
	repo.addSeries(&model.Series{Title: "Series 1", Slug: "series-1", IsActive: true})
	app := testApp()
	app.Get("/api/series", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/series?category_id=1", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}

func TestSeriesHandler_Delete_NotFound(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Delete("/api/admin/series/:id", h.Delete)

	result, status := makeRequest(app, "DELETE", "/api/admin/series/999", "")
	if status != 500 {
		t.Errorf("Delete() not found status = %d, want 500", status)
	}
	if result.Success {
		t.Error("Delete() should return success=false for not found")
	}
}

func TestSeriesHandler_Update_NotFound(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Put("/api/admin/series/:id", h.Update)

	result, status := makeRequest(app, "PUT", "/api/admin/series/999", `{"title":"Updated"}`)
	if status != 400 {
		t.Errorf("Update() not found status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Update() should return success=false for not found")
	}
}

func TestSeriesHandler_Create_EmptyTitle(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Post("/api/admin/series", h.Create)

	result, status := makeRequest(app, "POST", "/api/admin/series", `{"title":""}`)
	if status != 400 {
		t.Errorf("Create() empty title status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Create() should return success=false for empty title")
	}
}

func TestSeriesHandler_GetEpisodes_NotFound(t *testing.T) {
	h, _ := setupSeriesHandler()
	app := testApp()
	app.Get("/api/series/:id/episodes", h.GetEpisodes)

	result, status := makeRequest(app, "GET", "/api/series/999/episodes", "")
	if status != 404 {
		t.Errorf("GetEpisodes() not found status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetEpisodes() should return success=false for not found")
	}
}

func TestSeriesHandler_ListActive_WithSearch(t *testing.T) {
	h, repo := setupSeriesHandler()
	repo.addSeries(&model.Series{Title: "Breaking Bad", Slug: "breaking-bad", IsActive: true})
	app := testApp()
	app.Get("/api/series", h.ListActive)

	result, status := makeRequest(app, "GET", "/api/series?search=Breaking", "")
	if status != 200 {
		t.Errorf("ListActive() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListActive() should return success=true")
	}
}
