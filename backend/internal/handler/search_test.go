package handler

import (
	"testing"

	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupSearchHandler() *SearchHandler {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()

	channelSvc := service.NewChannelService(channelRepo, streamRepo, nil)
	vodSvc := service.NewVODService(vodRepo, nil)
	seriesSvc := service.NewSeriesService(seriesRepo, vodRepo, nil)

	// Add some test data
	channelRepo.addChannel(&model.Channel{Name: "Test Channel", Slug: "test-channel", IsActive: true})
	vodRepo.addVOD(&model.VOD{Title: "Test Movie", Slug: "test-movie", IsActive: true})
	seriesRepo.addSeries(&model.Series{Title: "Test Series", Slug: "test-series", IsActive: true})

	return NewSearchHandler(channelSvc, vodSvc, seriesSvc)
}

func TestSearchHandler_Search(t *testing.T) {
	h := setupSearchHandler()

	app := testApp()
	app.Get("/api/search", h.Search)

	result, status := makeRequest(app, "GET", "/api/search?q=test", "")
	if status != 200 {
		t.Errorf("Search() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Search() should return success=true")
	}
}

func TestSearchHandler_Search_EmptyQuery(t *testing.T) {
	h := setupSearchHandler()

	app := testApp()
	app.Get("/api/search", h.Search)

	result, status := makeRequest(app, "GET", "/api/search", "")
	if status != 200 {
		t.Errorf("Search() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Search() should return success=true for empty query")
	}
}

func TestSearchHandler_Search_WithQuery(t *testing.T) {
	h := setupSearchHandler()

	app := testApp()
	app.Get("/api/search", h.Search)

	result, status := makeRequest(app, "GET", "/api/search?q=channel", "")
	if status != 200 {
		t.Errorf("Search() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Search() should return success=true")
	}
}

func TestSearchHandler_Search_LongQuery(t *testing.T) {
	h := setupSearchHandler()

	app := testApp()
	app.Get("/api/search", h.Search)

	// Create a very long query string (exceeds MaxSearchLength)
	longQuery := ""
	for i := 0; i < 300; i++ {
		longQuery += "a"
	}

	result, status := makeRequest(app, "GET", "/api/search?q="+longQuery, "")
	if status != 200 {
		t.Errorf("Search() long query status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Search() should return success=true even for truncated query")
	}
}
