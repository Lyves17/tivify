package handler

import (
	"testing"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"github.com/tivify/backend/internal/service"
)

func setupDashboardHandler() (*DashboardHandler, *mockChannelRepoH, *mockVODRepoH, *mockSeriesRepoH, *mockUserRepoForHandler) {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()
	userRepo := newMockUserRepoH()
	cache := &mockCacheH{}

	channelSvc := service.NewChannelService(channelRepo, streamRepo, nil)
	vodSvc := service.NewVODService(vodRepo, nil)
	seriesSvc := service.NewSeriesService(seriesRepo, vodRepo, nil)
	userSvc := service.NewUserService(userRepo)

	handler := NewDashboardHandler(channelSvc, vodSvc, seriesSvc, userSvc, vodRepo, userRepo, cache)
	return handler, channelRepo, vodRepo, seriesRepo, userRepo
}

func TestDashboardHandler_Stats(t *testing.T) {
	h, channelRepo, vodRepo, seriesRepo, userRepo := setupDashboardHandler()

	// Add test data
	channelRepo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})
	channelRepo.addChannel(&model.Channel{Name: "Canal 2", Slug: "canal-2", IsActive: true})

	vodRepo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
	vodRepo.addVOD(&model.VOD{Title: "Movie 2", Slug: "movie-2", IsActive: true})
	vodRepo.addVOD(&model.VOD{Title: "Movie 3", Slug: "movie-3", IsActive: true})

	seriesRepo.addSeries(&model.Series{Title: "Series 1", Slug: "series-1", IsActive: true})

	user := &model.User{
		ID:       uuid.New(),
		Username: "testuser",
		Email:    "test@test.com",
		Role:     "user",
		IsActive: true,
	}
	userRepo.addUser(user)

	app := testApp()
	app.Get("/api/admin/dashboard", h.Stats)

	result, status := makeRequest(app, "GET", "/api/admin/dashboard", "")
	if status != 200 {
		t.Errorf("Stats() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stats() should return success=true")
	}
}

func TestDashboardHandler_Stats_Empty(t *testing.T) {
	h, _, _, _, _ := setupDashboardHandler()

	app := testApp()
	app.Get("/api/admin/dashboard", h.Stats)

	result, status := makeRequest(app, "GET", "/api/admin/dashboard", "")
	if status != 200 {
		t.Errorf("Stats() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stats() should return success=true even with no data")
	}
}

func TestDashboardHandler_Stats_NilCache(t *testing.T) {
	channelRepo := newMockChannelRepoH()
	streamRepo := newMockStreamRepoH()
	vodRepo := newMockVODRepoH()
	seriesRepo := newMockSeriesRepoH()
	userRepo := newMockUserRepoH()

	channelSvc := service.NewChannelService(channelRepo, streamRepo, nil)
	vodSvc := service.NewVODService(vodRepo, nil)
	seriesSvc := service.NewSeriesService(seriesRepo, vodRepo, nil)
	userSvc := service.NewUserService(userRepo)

	// Nil cache to test the no-cache path
	h := NewDashboardHandler(channelSvc, vodSvc, seriesSvc, userSvc, vodRepo, userRepo, nil)

	channelRepo.addChannel(&model.Channel{Name: "Canal 1", Slug: "canal-1", IsActive: true})
	vodRepo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})

	app := testApp()
	app.Get("/api/admin/dashboard", h.Stats)

	result, status := makeRequest(app, "GET", "/api/admin/dashboard", "")
	if status != 200 {
		t.Errorf("Stats() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stats() should return success=true with nil cache")
	}
}

func TestDashboardHandler_Stats_WithRecentData(t *testing.T) {
	h, _, vodRepo, _, userRepo := setupDashboardHandler()

	// Add VODs with different statuses
	vodRepo.addVOD(&model.VOD{Title: "Recent Movie", Slug: "recent-movie", IsActive: true, TranscodeStatus: "completed"})
	vodRepo.addVOD(&model.VOD{Title: "Processing Movie", Slug: "processing-movie", IsActive: true, TranscodeStatus: "processing"})
	vodRepo.addVOD(&model.VOD{Title: "Failed Movie", Slug: "failed-movie", IsActive: true, TranscodeStatus: "failed"})

	// Add a user
	user := &model.User{
		ID:       uuid.New(),
		Username: "recentuser",
		Email:    "recent@test.com",
		Role:     "user",
		IsActive: true,
	}
	userRepo.addUser(user)

	app := testApp()
	app.Get("/api/admin/dashboard", h.Stats)

	result, status := makeRequest(app, "GET", "/api/admin/dashboard", "")
	if status != 200 {
		t.Errorf("Stats() status = %d, want 200", status)
	}
	if !result.Success {
		t.Error("Stats() should return success=true")
	}
}
