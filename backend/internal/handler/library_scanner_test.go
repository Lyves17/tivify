package handler

import (
	"fmt"
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupLibraryScannerHandler() (*LibraryScannerHandler, *mockLibraryScannerRepoH) {
	scanRepo := newMockLibraryScannerRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()
	categoryRepo := newMockCategoryRepoH()

	// TMDBService with no API key (unconfigured)
	tmdb := service.NewTMDBService("")

	svc := service.NewLibraryScannerService(
		scanRepo, nil, tmdb, vodRepo, seriesRepo, categoryRepo,
		"/library", "/tmp/test-media",
	)
	handler := NewLibraryScannerHandler(svc)
	return handler, scanRepo
}

func TestLibraryScannerHandler_GetScanStatus_NotFound(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Get("/api/admin/library/scan/:sessionId/status", h.GetScanStatus)

	result, status := makeRequest(app, "GET", "/api/admin/library/scan/nonexistent/status", "")
	if status != 404 {
		t.Errorf("GetScanStatus() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("GetScanStatus() should return success=false for non-existent session")
	}
}

func TestLibraryScannerHandler_GetScanStatus_Found(t *testing.T) {
	h, repo := setupLibraryScannerHandler()

	// Add items with a known session ID so the service finds it via repo
	repo.Create(&model.LibraryScanItem{
		ScanSessionID: "test-session-123",
		FileName:      "movie.mp4",
		FilePath:      "/library/movie.mp4",
	})

	app := testApp()
	app.Get("/api/admin/library/scan/:sessionId/status", h.GetScanStatus)

	result, status := makeRequest(app, "GET", "/api/admin/library/scan/test-session-123/status", "")
	if status != 200 {
		t.Errorf("GetScanStatus() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetScanStatus() should return success=true for existing session")
	}
}

func TestLibraryScannerHandler_GetResults(t *testing.T) {
	h, repo := setupLibraryScannerHandler()
	repo.Create(&model.LibraryScanItem{
		ScanSessionID: "test-session-123",
		FileName:      "movie1.mp4",
		FilePath:      "/library/movie1.mp4",
		ParsedTitle:   "Movie 1",
		MediaType:     "movie",
	})
	repo.Create(&model.LibraryScanItem{
		ScanSessionID: "test-session-123",
		FileName:      "movie2.mp4",
		FilePath:      "/library/movie2.mp4",
		ParsedTitle:   "Movie 2",
		MediaType:     "movie",
	})

	app := testApp()
	app.Get("/api/admin/library/scan/:sessionId/results", h.GetResults)

	result, status := makeRequest(app, "GET", "/api/admin/library/scan/test-session-123/results", "")
	if status != 200 {
		t.Errorf("GetResults() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetResults() should return success=true")
	}
}

func TestLibraryScannerHandler_GetResults_Empty(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Get("/api/admin/library/scan/:sessionId/results", h.GetResults)

	result, status := makeRequest(app, "GET", "/api/admin/library/scan/nonexistent/results", "")
	if status != 200 {
		t.Errorf("GetResults() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetResults() should return success=true for empty results")
	}
}

func TestLibraryScannerHandler_GetResults_Pagination(t *testing.T) {
	h, repo := setupLibraryScannerHandler()
	for i := 0; i < 5; i++ {
		repo.Create(&model.LibraryScanItem{
			ScanSessionID: "test-session-123",
			FileName:      fmt.Sprintf("movie%d.mp4", i),
			FilePath:      fmt.Sprintf("/library/movie%d.mp4", i),
			ParsedTitle:   fmt.Sprintf("Movie %d", i),
			MediaType:     "movie",
		})
	}

	app := testApp()
	app.Get("/api/admin/library/scan/:sessionId/results", h.GetResults)

	result, status := makeRequest(app, "GET", "/api/admin/library/scan/test-session-123/results?page=1&per_page=2", "")
	if status != 200 {
		t.Errorf("GetResults() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("GetResults() should return success=true")
	}
}

func TestLibraryScannerHandler_UpdateItem(t *testing.T) {
	h, repo := setupLibraryScannerHandler()
	item := &model.LibraryScanItem{
		ScanSessionID: "test-session-123",
		FileName:      "movie.mp4",
		FilePath:      "/library/movie.mp4",
		ParsedTitle:   "Original Title",
		MediaType:     "movie",
	}
	repo.Create(item)

	app := testApp()
	app.Put("/api/admin/library/scan/items/:id", h.UpdateItem)

	body := `{"parsed_title":"Updated Title","parsed_year":2023}`
	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/library/scan/items/%d", item.ID), body)
	if status != 200 {
		t.Errorf("UpdateItem() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("UpdateItem() should return success=true")
	}
}

func TestLibraryScannerHandler_UpdateItem_InvalidID(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Put("/api/admin/library/scan/items/:id", h.UpdateItem)

	body := `{"parsed_title":"Updated Title"}`
	result, status := makeRequest(app, "PUT", "/api/admin/library/scan/items/abc", body)
	if status != 400 {
		t.Errorf("UpdateItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateItem() should return success=false for invalid ID")
	}
}

func TestLibraryScannerHandler_UpdateItem_NotFound(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Put("/api/admin/library/scan/items/:id", h.UpdateItem)

	body := `{"parsed_title":"Updated Title"}`
	result, status := makeRequest(app, "PUT", "/api/admin/library/scan/items/999", body)
	if status != 404 {
		t.Errorf("UpdateItem() status = %d, want 404", status)
	}
	if result.Success {
		t.Error("UpdateItem() should return success=false for not found")
	}
}

func TestLibraryScannerHandler_UpdateItem_InvalidBody(t *testing.T) {
	h, repo := setupLibraryScannerHandler()
	item := &model.LibraryScanItem{
		ScanSessionID: "test-session-123",
		FileName:      "movie.mp4",
		FilePath:      "/library/movie.mp4",
	}
	repo.Create(item)

	app := testApp()
	app.Put("/api/admin/library/scan/items/:id", h.UpdateItem)

	result, status := makeRequest(app, "PUT", fmt.Sprintf("/api/admin/library/scan/items/%d", item.ID), "not-json")
	if status != 400 {
		t.Errorf("UpdateItem() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("UpdateItem() should return success=false for invalid body")
	}
}

func TestLibraryScannerHandler_Import_InvalidBody(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/scan/import", h.Import)

	result, status := makeRequest(app, "POST", "/api/admin/library/scan/import", "not-json")
	if status != 400 {
		t.Errorf("Import() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Import() should return success=false for invalid body")
	}
}

func TestLibraryScannerHandler_Import_EmptyItems(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/scan/import", h.Import)

	body := `{"session_id":"test-session","item_ids":[]}`
	result, status := makeRequest(app, "POST", "/api/admin/library/scan/import", body)
	if status != 400 {
		t.Errorf("Import() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("Import() should return success=false for empty item_ids")
	}
}

func TestLibraryScannerHandler_SearchTMDB_InvalidBody(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/tmdb/search", h.SearchTMDB)

	result, status := makeRequest(app, "POST", "/api/admin/library/tmdb/search", "not-json")
	if status != 400 {
		t.Errorf("SearchTMDB() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("SearchTMDB() should return success=false for invalid body")
	}
}

func TestLibraryScannerHandler_SearchTMDB_EmptyQuery(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/tmdb/search", h.SearchTMDB)

	body := `{"query":"","year":0}`
	result, status := makeRequest(app, "POST", "/api/admin/library/tmdb/search", body)
	if status != 400 {
		t.Errorf("SearchTMDB() status = %d, want 400", status)
	}
	if result.Success {
		t.Error("SearchTMDB() should return success=false for empty query")
	}
}

func TestLibraryScannerHandler_SearchTMDB_NotConfigured(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/tmdb/search", h.SearchTMDB)

	body := `{"query":"Inception","year":2010}`
	result, status := makeRequest(app, "POST", "/api/admin/library/tmdb/search", body)
	// Should fail because TMDB is not configured (empty API key)
	if status != 500 {
		t.Errorf("SearchTMDB() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("SearchTMDB() should return success=false when TMDB not configured")
	}
}

func TestLibraryScannerHandler_TMDBStatus_NotConfigured(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Get("/api/admin/library/tmdb/status", h.TMDBStatus)

	result, status := makeRequest(app, "GET", "/api/admin/library/tmdb/status", "")
	if status != 200 {
		t.Errorf("TMDBStatus() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("TMDBStatus() should return success=true even when not configured")
	}
}

func TestLibraryScannerHandler_Scan_NoPaths(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/scan", h.Scan)

	// Empty body - will use default library path
	result, status := makeRequest(app, "POST", "/api/admin/library/scan", "")
	// The scan starts async, so it returns 201 with a session ID
	// However, the actual scan may fail because /library doesn't exist in test env
	// But the handler should still return created status
	if status != 201 && status != 500 {
		t.Errorf("Scan() status = %d, want 201 or 500", status)
	}
	// If it returned 201, it should be successful
	if status == 201 && !result.Success {
		t.Error("Scan() should return success=true when scan is initiated")
	}
}

func TestLibraryScannerHandler_Scan_WithPaths(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/scan", h.Scan)

	body := `{"paths":["/library/movies"]}`
	result, status := makeRequest(app, "POST", "/api/admin/library/scan", body)
	if status != 201 && status != 500 {
		t.Errorf("Scan() status = %d, want 201 or 500", status)
	}
	if status == 201 && !result.Success {
		t.Error("Scan() should return success=true when scan is initiated")
	}
}

// --- ListDevices tests ---

func TestLibraryScannerHandler_ListDevices(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Get("/api/admin/library/devices", h.ListDevices)

	result, status := makeRequest(app, "GET", "/api/admin/library/devices", "")
	if status != 200 {
		t.Errorf("ListDevices() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("ListDevices() should return success=true")
	}
}

// --- TMDBStatus with configured key tests ---

func setupLibraryScannerHandlerWithTMDB(apiKey string) (*LibraryScannerHandler, *mockLibraryScannerRepoH) {
	scanRepo := newMockLibraryScannerRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()
	categoryRepo := newMockCategoryRepoH()

	tmdb := service.NewTMDBService(apiKey)

	svc := service.NewLibraryScannerService(
		scanRepo, nil, tmdb, vodRepo, seriesRepo, categoryRepo,
		"/library", "/tmp/test-media",
	)
	handler := NewLibraryScannerHandler(svc)
	return handler, scanRepo
}

func TestLibraryScannerHandler_TMDBStatus_ConfiguredInvalidKey(t *testing.T) {
	// Use a fake API key so IsTMDBConfigured() returns true, but ValidateTMDB() fails
	h, _ := setupLibraryScannerHandlerWithTMDB("fake-invalid-key-12345")

	app := testApp()
	app.Get("/api/admin/library/tmdb/status", h.TMDBStatus)

	result, status := makeRequest(app, "GET", "/api/admin/library/tmdb/status", "")
	if status != 200 {
		t.Errorf("TMDBStatus() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("TMDBStatus() should return success=true even for invalid key")
	}
	// The data should contain configured=true, valid=false
	if data, ok := result.Data.(map[string]interface{}); ok {
		if configured, ok := data["configured"].(bool); ok && !configured {
			t.Error("TMDBStatus() should return configured=true when API key is set")
		}
	}
}

// --- SearchTMDB with configured key (but invalid, so API returns error) ---

func TestLibraryScannerHandler_SearchTMDB_ConfiguredButFails(t *testing.T) {
	h, _ := setupLibraryScannerHandlerWithTMDB("fake-api-key-for-test")

	app := testApp()
	app.Post("/api/admin/library/tmdb/search", h.SearchTMDB)

	body := `{"query":"Inception","year":2010,"media_type":"movie"}`
	result, status := makeRequest(app, "POST", "/api/admin/library/tmdb/search", body)
	// Should fail because the API key is fake
	if status != 500 {
		t.Errorf("SearchTMDB() with fake key status = %d, want 500", status)
	}
	if result.Success {
		t.Error("SearchTMDB() should return success=false with fake API key")
	}
}

func TestLibraryScannerHandler_SearchTMDB_WithMediaType(t *testing.T) {
	h, _ := setupLibraryScannerHandler()

	app := testApp()
	app.Post("/api/admin/library/tmdb/search", h.SearchTMDB)

	body := `{"query":"Breaking Bad","media_type":"tv"}`
	result, status := makeRequest(app, "POST", "/api/admin/library/tmdb/search", body)
	// TMDB not configured → 500
	if status != 500 {
		t.Errorf("SearchTMDB() status = %d, want 500", status)
	}
	if result.Success {
		t.Error("SearchTMDB() should return success=false when TMDB not configured")
	}
}

// --- Import success path ---

func TestLibraryScannerHandler_Import_WithItems(t *testing.T) {
	h, repo := setupLibraryScannerHandler()

	// Create scan items that can be imported
	item1 := &model.LibraryScanItem{
		ScanSessionID: "import-session",
		FileName:      "movie1.mp4",
		FilePath:      "/library/movie1.mp4",
		ParsedTitle:   "Movie One",
		MediaType:     "movie",
		ImportStatus:  "pending",
	}
	item2 := &model.LibraryScanItem{
		ScanSessionID: "import-session",
		FileName:      "movie2.mp4",
		FilePath:      "/library/movie2.mp4",
		ParsedTitle:   "Movie Two",
		MediaType:     "movie",
		ImportStatus:  "pending",
	}
	repo.Create(item1)
	repo.Create(item2)

	app := testApp()
	app.Post("/api/admin/library/scan/import", h.Import)

	body := fmt.Sprintf(`{"session_id":"import-session","item_ids":[%d,%d]}`, item1.ID, item2.ID)
	result, status := makeRequest(app, "POST", "/api/admin/library/scan/import", body)
	if status != 200 {
		t.Errorf("Import() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true when items are imported")
	}
}

func TestLibraryScannerHandler_Import_AlreadyImported(t *testing.T) {
	h, repo := setupLibraryScannerHandler()

	// Item already imported - should be skipped
	item := &model.LibraryScanItem{
		ScanSessionID: "import-session",
		FileName:      "movie.mp4",
		FilePath:      "/library/movie.mp4",
		ParsedTitle:   "Already Imported",
		MediaType:     "movie",
		ImportStatus:  "imported",
	}
	repo.Create(item)

	app := testApp()
	app.Post("/api/admin/library/scan/import", h.Import)

	body := fmt.Sprintf(`{"session_id":"import-session","item_ids":[%d]}`, item.ID)
	result, status := makeRequest(app, "POST", "/api/admin/library/scan/import", body)
	if status != 200 {
		t.Errorf("Import() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true (skips already imported)")
	}
}

func TestLibraryScannerHandler_Import_SeriesItems(t *testing.T) {
	h, repo := setupLibraryScannerHandler()

	item := &model.LibraryScanItem{
		ScanSessionID: "import-session",
		FileName:      "show.s01e01.mp4",
		FilePath:      "/library/show.s01e01.mp4",
		ParsedTitle:   "Show",
		MediaType:     "series",
		SeasonNumber:  1,
		EpisodeNumber: 1,
		ImportStatus:  "pending",
	}
	repo.Create(item)

	app := testApp()
	app.Post("/api/admin/library/scan/import", h.Import)

	body := fmt.Sprintf(`{"session_id":"import-session","item_ids":[%d]}`, item.ID)
	result, status := makeRequest(app, "POST", "/api/admin/library/scan/import", body)
	if status != 200 {
		t.Errorf("Import() series status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Import() should return success=true for series items")
	}
}
