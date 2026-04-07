package service

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock SeriesRepository ---

type mockSeriesRepo struct {
	series        map[uint]*model.Series
	bySlug        map[string]*model.Series
	episodeCounts map[uint]int64
	nextID        uint
	createErr     error
	updateErr     error
}

func newMockSeriesRepo() *mockSeriesRepo {
	return &mockSeriesRepo{
		series:        make(map[uint]*model.Series),
		bySlug:        make(map[string]*model.Series),
		episodeCounts: make(map[uint]int64),
		nextID:        1,
	}
}

func (m *mockSeriesRepo) FindByID(id uint) (*model.Series, error) {
	s, ok := m.series[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}

func (m *mockSeriesRepo) FindBySlug(slug string) (*model.Series, error) {
	s, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return s, nil
}

func (m *mockSeriesRepo) List(page, perPage int) ([]model.Series, int64, error) {
	var list []model.Series
	for _, s := range m.series {
		list = append(list, *s)
	}
	return list, int64(len(list)), nil
}

func (m *mockSeriesRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Series, int64, error) {
	var list []model.Series
	for _, s := range m.series {
		if s.IsActive {
			list = append(list, *s)
		}
	}
	return list, int64(len(list)), nil
}

func (m *mockSeriesRepo) Create(series *model.Series) error {
	if m.createErr != nil {
		return m.createErr
	}
	series.ID = m.nextID
	m.nextID++
	m.series[series.ID] = series
	m.bySlug[series.Slug] = series
	return nil
}

func (m *mockSeriesRepo) Update(series *model.Series) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.series[series.ID] = series
	m.bySlug[series.Slug] = series
	return nil
}

func (m *mockSeriesRepo) Delete(id uint) error {
	s, ok := m.series[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.series, id)
	delete(m.bySlug, s.Slug)
	return nil
}

func (m *mockSeriesRepo) Count() (int64, error) {
	return int64(len(m.series)), nil
}

func (m *mockSeriesRepo) CountActive() (int64, error) {
	var count int64
	for _, s := range m.series {
		if s.IsActive {
			count++
		}
	}
	return count, nil
}

func (m *mockSeriesRepo) CountEpisodes(seriesID uint) (int64, error) {
	return m.episodeCounts[seriesID], nil
}

func (m *mockSeriesRepo) ListWithoutPoster() ([]model.Series, error) {
	var list []model.Series
	for _, s := range m.series {
		if s.PosterURL == "" {
			list = append(list, *s)
		}
	}
	return list, nil
}

func (m *mockSeriesRepo) addSeries(s *model.Series) {
	if s.ID == 0 {
		s.ID = m.nextID
		m.nextID++
	}
	m.series[s.ID] = s
	m.bySlug[s.Slug] = s
}

// --- SeriesService Tests ---

func TestSeriesService_List(t *testing.T) {
	t.Run("returns all series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		vRepo := newMockVODRepo()
		svc := NewSeriesService(sRepo, vRepo, nil)

		sRepo.addSeries(&model.Series{Title: "Series 1", Slug: "series-1", IsActive: true})
		sRepo.addSeries(&model.Series{Title: "Series 2", Slug: "series-2", IsActive: true})

		series, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(series) != 2 {
			t.Errorf("List() returned %d series, want 2", len(series))
		}
	})

	t.Run("empty list", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		series, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 0 {
			t.Errorf("List() total = %d, want 0", total)
		}
		if series != nil {
			t.Errorf("List() should return nil for empty")
		}
	})

	t.Run("includes episode count", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Breaking Bad", Slug: "breaking-bad", IsActive: true})
		sRepo.episodeCounts[1] = 62

		series, _, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if len(series) != 1 {
			t.Fatalf("List() returned %d, want 1", len(series))
		}
		if series[0].EpisodesCount != 62 {
			t.Errorf("List() episodes_count = %d, want 62", series[0].EpisodesCount)
		}
	})

	t.Run("includes inactive series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Active", Slug: "active", IsActive: true})
		sRepo.addSeries(&model.Series{Title: "Inactive", Slug: "inactive", IsActive: false})

		series, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(series) != 2 {
			t.Errorf("List() returned %d, want 2", len(series))
		}
	})
}

func TestSeriesService_ListActive(t *testing.T) {
	t.Run("only active series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Active", Slug: "active", IsActive: true})
		sRepo.addSeries(&model.Series{Title: "Inactive", Slug: "inactive", IsActive: false})
		sRepo.addSeries(&model.Series{Title: "Active 2", Slug: "active-2", IsActive: true})

		series, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 2 {
			t.Errorf("ListActive() total = %d, want 2", total)
		}
		if len(series) != 2 {
			t.Errorf("ListActive() returned %d series, want 2", len(series))
		}
	})

	t.Run("no active series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Inactive", Slug: "inactive", IsActive: false})

		series, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 0 {
			t.Errorf("ListActive() total = %d, want 0", total)
		}
		if series != nil {
			t.Errorf("ListActive() should return nil for empty")
		}
	})
}

func TestSeriesService_GetByID(t *testing.T) {
	t.Run("found with episodes count", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Breaking Bad", Slug: "breaking-bad", IsActive: true, Year: 2008, Rating: 9.5})
		sRepo.episodeCounts[1] = 62

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Title != "Breaking Bad" {
			t.Errorf("title = %q", resp.Title)
		}
		if resp.EpisodesCount != 62 {
			t.Errorf("episodes_count = %d, want 62", resp.EpisodesCount)
		}
		if resp.Year != 2008 {
			t.Errorf("year = %d", resp.Year)
		}
		if resp.Rating != 9.5 {
			t.Errorf("rating = %f", resp.Rating)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		_, err := svc.GetByID(999)
		if err == nil {
			t.Fatal("GetByID() should return error for nonexistent series")
		}
		if err.Error() != "serie no encontrada" {
			t.Errorf("error = %q, want %q", err.Error(), "serie no encontrada")
		}
	})

	t.Run("with category", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		catID := uint(1)
		sRepo.addSeries(&model.Series{
			Title:      "Series",
			Slug:       "series",
			IsActive:   true,
			CategoryID: &catID,
			Category:   &model.Category{ID: 1, Name: "Drama", Slug: "drama", Type: "series"},
		})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Category == nil {
			t.Fatal("category should not be nil")
		}
		if resp.Category.Name != "Drama" {
			t.Errorf("category name = %q", resp.Category.Name)
		}
	})

	t.Run("zero episodes", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "New Series", Slug: "new", IsActive: true})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.EpisodesCount != 0 {
			t.Errorf("episodes_count = %d, want 0", resp.EpisodesCount)
		}
	})
}

func TestSeriesService_GetEpisodes(t *testing.T) {
	t.Run("returns episodes for series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		vRepo := newMockVODRepo()
		svc := NewSeriesService(sRepo, vRepo, nil)

		sRepo.addSeries(&model.Series{Title: "Breaking Bad", Slug: "breaking-bad", IsActive: true})

		seriesID := uint(1)
		vRepo.addVOD(&model.VOD{Title: "Pilot", Slug: "s01e01", IsActive: true, SeriesID: &seriesID, SeasonNumber: 1, EpisodeNumber: 1})
		vRepo.addVOD(&model.VOD{Title: "Cat's in the Bag", Slug: "s01e02", IsActive: true, SeriesID: &seriesID, SeasonNumber: 1, EpisodeNumber: 2})

		episodes, err := svc.GetEpisodes(1)
		if err != nil {
			t.Fatalf("GetEpisodes() error = %v", err)
		}
		if len(episodes) != 2 {
			t.Errorf("GetEpisodes() returned %d episodes, want 2", len(episodes))
		}
	})

	t.Run("series not found", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		_, err := svc.GetEpisodes(999)
		if err == nil {
			t.Fatal("GetEpisodes() should return error for nonexistent series")
		}
	})

	t.Run("no episodes", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "New Series", Slug: "new", IsActive: true})

		episodes, err := svc.GetEpisodes(1)
		if err != nil {
			t.Fatalf("GetEpisodes() error = %v", err)
		}
		if episodes != nil {
			t.Errorf("GetEpisodes() should return nil for series with no episodes, got %d", len(episodes))
		}
	})

	t.Run("only episodes from this series", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		vRepo := newMockVODRepo()
		svc := NewSeriesService(sRepo, vRepo, nil)

		sRepo.addSeries(&model.Series{Title: "Series A", Slug: "series-a", IsActive: true})
		sRepo.addSeries(&model.Series{Title: "Series B", Slug: "series-b", IsActive: true})

		seriesA := uint(1)
		seriesB := uint(2)
		vRepo.addVOD(&model.VOD{Title: "A-E01", Slug: "a-e01", SeriesID: &seriesA})
		vRepo.addVOD(&model.VOD{Title: "B-E01", Slug: "b-e01", SeriesID: &seriesB})

		episodes, err := svc.GetEpisodes(1)
		if err != nil {
			t.Fatalf("GetEpisodes() error = %v", err)
		}
		if len(episodes) != 1 {
			t.Errorf("GetEpisodes(1) returned %d, want 1", len(episodes))
		}
	})
}

func TestSeriesService_Create(t *testing.T) {
	t.Run("success with auto-slug", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		resp, err := svc.Create(dto.CreateSeriesRequest{
			Title:       "New Series",
			Description: "A great show",
			Year:        2024,
			Rating:      8.5,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Title != "New Series" {
			t.Errorf("title = %q", resp.Title)
		}
		if resp.Slug != "new-series" {
			t.Errorf("auto-slug = %q, want %q", resp.Slug, "new-series")
		}
		if !resp.IsActive {
			t.Error("should default to active")
		}
		if resp.Year != 2024 {
			t.Errorf("year = %d", resp.Year)
		}
		if resp.Rating != 8.5 {
			t.Errorf("rating = %f", resp.Rating)
		}
	})

	t.Run("success with custom slug", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		resp, err := svc.Create(dto.CreateSeriesRequest{
			Title: "Series",
			Slug:  "custom-slug",
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Slug != "custom-slug" {
			t.Errorf("slug = %q, want %q", resp.Slug, "custom-slug")
		}
	})

	t.Run("with IsActive false", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		isActive := false
		resp, err := svc.Create(dto.CreateSeriesRequest{
			Title:    "Series",
			IsActive: &isActive,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.IsActive {
			t.Error("should respect IsActive=false")
		}
	})

	t.Run("with total seasons", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		resp, err := svc.Create(dto.CreateSeriesRequest{
			Title:        "Series",
			TotalSeasons: 5,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.TotalSeasons != 5 {
			t.Errorf("total_seasons = %d, want 5", resp.TotalSeasons)
		}
	})

	t.Run("with category", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		catID := uint(3)
		resp, err := svc.Create(dto.CreateSeriesRequest{
			Title:      "Series",
			CategoryID: &catID,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.CategoryID == nil || *resp.CategoryID != 3 {
			t.Error("categoryID incorrect")
		}
	})

	t.Run("empty title", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		_, err := svc.Create(dto.CreateSeriesRequest{})
		if err == nil {
			t.Fatal("should return error for empty title")
		}
	})

	t.Run("repo error non-slug-collision", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		sRepo.createErr = errors.New("database connection lost")
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		_, err := svc.Create(dto.CreateSeriesRequest{Title: "Series"})
		if err == nil {
			t.Fatal("should return error when repo fails")
		}
	})

	t.Run("slug collision retries", func(t *testing.T) {
		callCount := 0
		sRepo := &mockSeriesRepoWithSlugCollision{
			mockSeriesRepo: newMockSeriesRepo(),
			failCount:      1,
			currentAttempt: &callCount,
		}
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		resp, err := svc.Create(dto.CreateSeriesRequest{Title: "Series"})
		if err != nil {
			t.Fatalf("Create() with slug collision retry error = %v", err)
		}
		if resp == nil {
			t.Fatal("should succeed after retry")
		}
	})
}

// mockSeriesRepoWithSlugCollision simulates slug collisions for the first N create attempts
type mockSeriesRepoWithSlugCollision struct {
	*mockSeriesRepo
	failCount      int
	currentAttempt *int
}

func (m *mockSeriesRepoWithSlugCollision) Create(series *model.Series) error {
	*m.currentAttempt++
	if *m.currentAttempt <= m.failCount {
		return errors.New("duplicate key value violates unique constraint idx_series_slug")
	}
	return m.mockSeriesRepo.Create(series)
}

func TestSeriesService_Create_SlugCollisionExhausted(t *testing.T) {
	// All 5 retry attempts fail with slug collision — should return error
	callCount := 0
	sRepo := &mockSeriesRepoWithSlugCollision{
		mockSeriesRepo: newMockSeriesRepo(),
		failCount:      5,
		currentAttempt: &callCount,
	}
	svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

	_, err := svc.Create(dto.CreateSeriesRequest{Title: "Series"})
	if err == nil {
		t.Fatal("Create() should return error when all slug collision retries are exhausted")
	}
	if callCount != 5 {
		t.Errorf("expected 5 retry attempts, got %d", callCount)
	}
}

func TestSeriesService_Create_WithAllFields(t *testing.T) {
	sRepo := newMockSeriesRepo()
	svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

	catID := uint(2)
	resp, err := svc.Create(dto.CreateSeriesRequest{
		Title:        "Full Series",
		Slug:         "full-series",
		Description:  "An amazing series",
		CategoryID:   &catID,
		PosterURL:    "https://poster.jpg",
		BackdropURL:  "https://backdrop.jpg",
		Year:         2024,
		Rating:       9.0,
		TotalSeasons: 3,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp.Description != "An amazing series" {
		t.Errorf("description = %q", resp.Description)
	}
	if resp.PosterURL != "https://poster.jpg" {
		t.Errorf("poster_url = %q", resp.PosterURL)
	}
	if resp.BackdropURL != "https://backdrop.jpg" {
		t.Errorf("backdrop_url = %q", resp.BackdropURL)
	}
	if resp.TotalSeasons != 3 {
		t.Errorf("total_seasons = %d", resp.TotalSeasons)
	}
	if resp.CategoryID == nil || *resp.CategoryID != 2 {
		t.Error("categoryID incorrect")
	}
}

func TestSeriesService_Update(t *testing.T) {
	t.Run("success - update title", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Old Title", Slug: "old-title", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateSeriesRequest{Title: "New Title"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Title != "New Title" {
			t.Errorf("title = %q", resp.Title)
		}
	})

	t.Run("success - update year and rating", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		year := 2025
		rating := 9.0
		resp, err := svc.Update(1, dto.UpdateSeriesRequest{Year: &year, Rating: &rating})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Year != 2025 {
			t.Errorf("year = %d", resp.Year)
		}
		if resp.Rating != 9.0 {
			t.Errorf("rating = %f", resp.Rating)
		}
	})

	t.Run("success - update slug", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateSeriesRequest{Slug: "new-slug"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Slug != "new-slug" {
			t.Errorf("slug = %q", resp.Slug)
		}
	})

	t.Run("success - update total seasons", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true, TotalSeasons: 3})

		totalSeasons := 5
		resp, err := svc.Update(1, dto.UpdateSeriesRequest{TotalSeasons: &totalSeasons})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.TotalSeasons != 5 {
			t.Errorf("total_seasons = %d, want 5", resp.TotalSeasons)
		}
	})

	t.Run("success - toggle active", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		isActive := false
		resp, err := svc.Update(1, dto.UpdateSeriesRequest{IsActive: &isActive})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.IsActive {
			t.Error("should set IsActive to false")
		}
	})

	t.Run("success - update poster and backdrop", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateSeriesRequest{
			PosterURL:   "https://poster.jpg",
			BackdropURL: "https://backdrop.jpg",
		})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.PosterURL != "https://poster.jpg" {
			t.Errorf("poster_url = %q", resp.PosterURL)
		}
		if resp.BackdropURL != "https://backdrop.jpg" {
			t.Errorf("backdrop_url = %q", resp.BackdropURL)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		_, err := svc.Update(999, dto.UpdateSeriesRequest{Title: "test"})
		if err == nil {
			t.Fatal("should return error for nonexistent series")
		}
	})

	t.Run("repo update error", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})
		sRepo.updateErr = gorm.ErrInvalidDB

		_, err := svc.Update(1, dto.UpdateSeriesRequest{Title: "New"})
		if err == nil {
			t.Fatal("should return error when repo update fails")
		}
	})

	t.Run("success - update description", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateSeriesRequest{Description: "Updated description"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Description != "Updated description" {
			t.Errorf("description = %q, want %q", resp.Description, "Updated description")
		}
	})

	t.Run("success - update category ID", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true})

		catID := uint(5)
		resp, err := svc.Update(1, dto.UpdateSeriesRequest{CategoryID: &catID})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.CategoryID == nil || *resp.CategoryID != 5 {
			t.Error("Update() categoryID incorrect")
		}
	})

	t.Run("empty update preserves fields", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{
			Title:        "Series",
			Slug:         "series",
			IsActive:     true,
			Year:         2020,
			Rating:       8.0,
			TotalSeasons: 3,
			Description:  "Great show",
		})

		resp, err := svc.Update(1, dto.UpdateSeriesRequest{})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Title != "Series" {
			t.Errorf("should preserve title, got %q", resp.Title)
		}
		if resp.Year != 2020 {
			t.Errorf("should preserve year, got %d", resp.Year)
		}
	})
}

func TestSeriesService_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Test", Slug: "test", IsActive: true})

		err := svc.Delete(1)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		_, err = sRepo.FindByID(1)
		if err == nil {
			t.Error("Delete() should remove series from repo")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		err := svc.Delete(999)
		if err == nil {
			t.Fatal("should return error for nonexistent series")
		}
	})
}

func TestSeriesService_CountActive(t *testing.T) {
	t.Run("counts only active", func(t *testing.T) {
		sRepo := newMockSeriesRepo()
		svc := NewSeriesService(sRepo, newMockVODRepo(), nil)

		sRepo.addSeries(&model.Series{Title: "Active", Slug: "active", IsActive: true})
		sRepo.addSeries(&model.Series{Title: "Inactive", Slug: "inactive", IsActive: false})
		sRepo.addSeries(&model.Series{Title: "Active 2", Slug: "active-2", IsActive: true})

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 2 {
			t.Errorf("CountActive() = %d, want 2", count)
		}
	})

	t.Run("zero when empty", func(t *testing.T) {
		svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 0 {
			t.Errorf("CountActive() = %d, want 0", count)
		}
	})
}

func TestSeriesService_CountEpisodes(t *testing.T) {
	sRepo := newMockSeriesRepo()

	sRepo.episodeCounts[1] = 62
	sRepo.episodeCounts[2] = 10

	count, err := sRepo.CountEpisodes(1)
	if err != nil {
		t.Fatalf("CountEpisodes() error = %v", err)
	}
	if count != 62 {
		t.Errorf("CountEpisodes(1) = %d, want 62", count)
	}

	count, err = sRepo.CountEpisodes(999)
	if err != nil {
		t.Fatalf("CountEpisodes() error = %v", err)
	}
	if count != 0 {
		t.Errorf("CountEpisodes(999) = %d, want 0", count)
	}
}

func TestSeriesService_ListWithoutPoster(t *testing.T) {
	sRepo := newMockSeriesRepo()

	sRepo.addSeries(&model.Series{Title: "With Poster", Slug: "with-poster", PosterURL: "https://poster.jpg"})
	sRepo.addSeries(&model.Series{Title: "No Poster 1", Slug: "no-poster-1", PosterURL: ""})
	sRepo.addSeries(&model.Series{Title: "No Poster 2", Slug: "no-poster-2", PosterURL: ""})

	list, err := sRepo.ListWithoutPoster()
	if err != nil {
		t.Fatalf("ListWithoutPoster() error = %v", err)
	}
	if len(list) != 2 {
		t.Errorf("ListWithoutPoster() returned %d, want 2", len(list))
	}
}

func TestSeriesService_EnrichWithTMDB_NilTMDB(t *testing.T) {
	svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), nil)

	_, err := svc.EnrichWithTMDB()
	if err == nil {
		t.Fatal("EnrichWithTMDB() should return error when TMDB is nil")
	}
}

func TestSeriesService_EnrichWithTMDB_NotConfigured(t *testing.T) {
	tmdb := NewTMDBService("")
	svc := NewSeriesService(newMockSeriesRepo(), newMockVODRepo(), tmdb)

	_, err := svc.EnrichWithTMDB()
	if err == nil {
		t.Fatal("EnrichWithTMDB() should return error when TMDB is not configured")
	}
}

func TestSeriesService_EnrichWithTMDB_WithMockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{
					ID:           1399,
					Name:         "Test Series",
					Overview:     "A test series description",
					PosterPath:   "/poster123.jpg",
					BackdropPath: "/backdrop456.jpg",
					FirstAirDate: "2008-01-20",
					VoteAverage:  9.5,
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	sRepo := newMockSeriesRepo()
	sRepo.addSeries(&model.Series{Title: "Test Series", Slug: "test-series", IsActive: true, PosterURL: "", Year: 0})
	svc := NewSeriesService(sRepo, newMockVODRepo(), tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Enriched != 1 {
		t.Errorf("enriched = %d, want 1", result.Enriched)
	}

	// Verify the series was updated
	series, _ := sRepo.FindByID(1)
	if series.PosterURL == "" {
		t.Error("PosterURL should have been enriched")
	}
	if series.BackdropURL == "" {
		t.Error("BackdropURL should have been enriched")
	}
	if series.Description == "" {
		t.Error("Description should have been enriched")
	}
	if series.Rating == 0 {
		t.Error("Rating should have been enriched")
	}
	if series.Year == 0 {
		t.Error("Year should have been enriched")
	}
}

func TestSeriesService_EnrichWithTMDB_NoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{Page: 1, TotalResults: 0, Results: []TMDBSearchResult{}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	sRepo := newMockSeriesRepo()
	sRepo.addSeries(&model.Series{Title: "Unknown Series", Slug: "unknown", IsActive: true, PosterURL: ""})
	svc := NewSeriesService(sRepo, newMockVODRepo(), tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Skipped != 1 {
		t.Errorf("skipped = %d, want 1", result.Skipped)
	}
}

func TestSeriesService_EnrichWithTMDB_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"status_message":"Internal error"}`))
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	sRepo := newMockSeriesRepo()
	sRepo.addSeries(&model.Series{Title: "Some Series", Slug: "some-series", IsActive: true, PosterURL: ""})
	svc := NewSeriesService(sRepo, newMockVODRepo(), tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Failed != 1 {
		t.Errorf("failed = %d, want 1", result.Failed)
	}
}

func TestSeriesService_EnrichWithTMDB_UpdateError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page: 1, TotalResults: 1,
			Results: []TMDBSearchResult{{ID: 1, Name: "Series", PosterPath: "/p.jpg", VoteAverage: 8.0}},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	sRepo := newMockSeriesRepo()
	sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true, PosterURL: ""})
	sRepo.updateErr = gorm.ErrInvalidDB
	svc := NewSeriesService(sRepo, newMockVODRepo(), tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Failed != 1 {
		t.Errorf("failed = %d, want 1", result.Failed)
	}
}

func TestSeriesService_EnrichWithTMDB_NoSeriesWithoutPoster(t *testing.T) {
	tmdb := NewTMDBService("test-key")

	sRepo := newMockSeriesRepo()
	sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true, PosterURL: "https://poster.jpg"})
	svc := NewSeriesService(sRepo, newMockVODRepo(), tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Enriched != 0 {
		t.Errorf("enriched = %d, want 0", result.Enriched)
	}
}
