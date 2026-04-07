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

// --- Mock VODRepository ---

type mockVODRepo struct {
	vods      map[uint]*model.VOD
	bySlug    map[string]*model.VOD
	nextID    uint
	createErr error
	updateErr error
}

func newMockVODRepo() *mockVODRepo {
	return &mockVODRepo{
		vods:   make(map[uint]*model.VOD),
		bySlug: make(map[string]*model.VOD),
		nextID: 1,
	}
}

func (m *mockVODRepo) FindByID(id uint) (*model.VOD, error) {
	v, ok := m.vods[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return v, nil
}

func (m *mockVODRepo) FindBySlug(slug string) (*model.VOD, error) {
	v, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return v, nil
}

func (m *mockVODRepo) List(page, perPage int) ([]model.VOD, int64, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		vods = append(vods, *v)
	}
	return vods, int64(len(vods)), nil
}

func (m *mockVODRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.VOD, int64, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		if v.IsActive {
			vods = append(vods, *v)
		}
	}
	return vods, int64(len(vods)), nil
}

func (m *mockVODRepo) ListBySeries(seriesID uint) ([]model.VOD, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		if v.SeriesID != nil && *v.SeriesID == seriesID {
			vods = append(vods, *v)
		}
	}
	return vods, nil
}

func (m *mockVODRepo) Create(vod *model.VOD) error {
	if m.createErr != nil {
		return m.createErr
	}
	vod.ID = m.nextID
	m.nextID++
	m.vods[vod.ID] = vod
	m.bySlug[vod.Slug] = vod
	return nil
}

func (m *mockVODRepo) Update(vod *model.VOD) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.vods[vod.ID] = vod
	m.bySlug[vod.Slug] = vod
	return nil
}

func (m *mockVODRepo) Delete(id uint) error {
	v, ok := m.vods[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.vods, id)
	delete(m.bySlug, v.Slug)
	return nil
}

func (m *mockVODRepo) Count() (int64, error) {
	return int64(len(m.vods)), nil
}

func (m *mockVODRepo) CountActive() (int64, error) {
	var count int64
	for _, v := range m.vods {
		if v.IsActive {
			count++
		}
	}
	return count, nil
}

func (m *mockVODRepo) ListRecent(limit int) ([]model.VOD, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		vods = append(vods, *v)
		if len(vods) >= limit {
			break
		}
	}
	return vods, nil
}

func (m *mockVODRepo) ListByTranscodeStatus(statuses []string) ([]model.VOD, error) {
	statusSet := make(map[string]bool)
	for _, s := range statuses {
		statusSet[s] = true
	}
	var vods []model.VOD
	for _, v := range m.vods {
		if statusSet[v.TranscodeStatus] {
			vods = append(vods, *v)
		}
	}
	return vods, nil
}

func (m *mockVODRepo) ListWithoutPoster() ([]model.VOD, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		if v.PosterURL == "" {
			vods = append(vods, *v)
		}
	}
	return vods, nil
}

func (m *mockVODRepo) DebugAll() ([]model.VOD, error) {
	var vods []model.VOD
	for _, v := range m.vods {
		vods = append(vods, *v)
	}
	return vods, nil
}

func (m *mockVODRepo) addVOD(vod *model.VOD) {
	if vod.ID == 0 {
		vod.ID = m.nextID
		m.nextID++
	}
	m.vods[vod.ID] = vod
	m.bySlug[vod.Slug] = vod
}

// --- VODService Tests ---

func TestVODService_List(t *testing.T) {
	t.Run("returns all VODs", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
		repo.addVOD(&model.VOD{Title: "Movie 2", Slug: "movie-2", IsActive: true})

		vods, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(vods) != 2 {
			t.Errorf("List() returned %d vods, want 2", len(vods))
		}
	})

	t.Run("empty list", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		vods, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 0 {
			t.Errorf("List() total = %d, want 0", total)
		}
		if vods != nil {
			t.Errorf("List() should return nil for empty")
		}
	})

	t.Run("includes inactive VODs", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Active", Slug: "active", IsActive: true})
		repo.addVOD(&model.VOD{Title: "Inactive", Slug: "inactive", IsActive: false})

		vods, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(vods) != 2 {
			t.Errorf("List() returned %d, want 2", len(vods))
		}
	})
}

func TestVODService_ListActive(t *testing.T) {
	t.Run("only active VODs", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
		repo.addVOD(&model.VOD{Title: "Movie 2", Slug: "movie-2", IsActive: false})
		repo.addVOD(&model.VOD{Title: "Movie 3", Slug: "movie-3", IsActive: true})

		vods, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 2 {
			t.Errorf("ListActive() total = %d, want 2", total)
		}
		if len(vods) != 2 {
			t.Errorf("ListActive() returned %d vods, want 2", len(vods))
		}
	})

	t.Run("no active VODs", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: false})

		vods, total, err := svc.ListActive(1, 20, "", nil)
		if err != nil {
			t.Fatalf("ListActive() error = %v", err)
		}
		if total != 0 {
			t.Errorf("ListActive() total = %d, want 0", total)
		}
		if vods != nil {
			t.Errorf("ListActive() should return nil for empty")
		}
	})
}

func TestVODService_GetByID(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Test Movie", Slug: "test-movie", IsActive: true, Year: 2024, Rating: 8.5})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Title != "Test Movie" {
			t.Errorf("GetByID() title = %q", resp.Title)
		}
		if resp.Year != 2024 {
			t.Errorf("GetByID() year = %d", resp.Year)
		}
		if resp.Rating != 8.5 {
			t.Errorf("GetByID() rating = %f", resp.Rating)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		_, err := svc.GetByID(999)
		if err == nil {
			t.Fatal("GetByID() should return error for nonexistent VOD")
		}
		if err.Error() != "VOD no encontrado" {
			t.Errorf("GetByID() error = %q, want %q", err.Error(), "VOD no encontrado")
		}
	})

	t.Run("with category", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		catID := uint(1)
		repo.addVOD(&model.VOD{
			Title:      "Movie",
			Slug:       "movie",
			IsActive:   true,
			CategoryID: &catID,
			Category:   &model.Category{ID: 1, Name: "Action", Slug: "action", Type: "vod"},
		})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Category == nil {
			t.Fatal("GetByID() category should not be nil")
		}
		if resp.Category.Name != "Action" {
			t.Errorf("GetByID() category name = %q", resp.Category.Name)
		}
	})

	t.Run("with series info", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		seriesID := uint(1)
		repo.addVOD(&model.VOD{
			Title:         "Episode 1",
			Slug:          "ep-1",
			IsActive:      true,
			SeriesID:      &seriesID,
			SeasonNumber:  1,
			EpisodeNumber: 1,
		})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.SeriesID == nil || *resp.SeriesID != 1 {
			t.Error("GetByID() seriesID incorrect")
		}
		if resp.SeasonNumber != 1 {
			t.Errorf("GetByID() season = %d", resp.SeasonNumber)
		}
		if resp.EpisodeNumber != 1 {
			t.Errorf("GetByID() episode = %d", resp.EpisodeNumber)
		}
	})
}

func TestVODService_Create(t *testing.T) {
	t.Run("success with auto-slug", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		resp, err := svc.Create(dto.CreateVODRequest{Title: "New Movie"})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Title != "New Movie" {
			t.Errorf("Create() title = %q", resp.Title)
		}
		if resp.Slug != "new-movie" {
			t.Errorf("Create() auto-slug = %q, want %q", resp.Slug, "new-movie")
		}
		if resp.TranscodeStatus != "pending" {
			t.Errorf("Create() transcode_status = %q, want %q", resp.TranscodeStatus, "pending")
		}
		if resp.TranscodeProgress != 0 {
			t.Errorf("Create() transcode_progress = %d, want 0", resp.TranscodeProgress)
		}
		if !resp.IsActive {
			t.Error("Create() should default to active")
		}
	})

	t.Run("success with custom slug", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		resp, err := svc.Create(dto.CreateVODRequest{Title: "Movie", Slug: "custom-slug"})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Slug != "custom-slug" {
			t.Errorf("Create() slug = %q, want %q", resp.Slug, "custom-slug")
		}
	})

	t.Run("with HLS path marks as completed", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		resp, err := svc.Create(dto.CreateVODRequest{
			Title:   "Completed Movie",
			HLSPath: "/media/movie/index.m3u8",
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.TranscodeStatus != "completed" {
			t.Errorf("Create() transcode_status = %q, want %q", resp.TranscodeStatus, "completed")
		}
		if resp.TranscodeProgress != 100 {
			t.Errorf("Create() transcode_progress = %d, want 100", resp.TranscodeProgress)
		}
	})

	t.Run("with IsActive false", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		isActive := false
		resp, err := svc.Create(dto.CreateVODRequest{
			Title:    "Movie",
			IsActive: &isActive,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.IsActive {
			t.Error("Create() should respect IsActive=false")
		}
	})

	t.Run("with series association", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		seriesID := uint(5)
		resp, err := svc.Create(dto.CreateVODRequest{
			Title:         "Episode 1",
			SeriesID:      &seriesID,
			SeasonNumber:  2,
			EpisodeNumber: 3,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.SeriesID == nil || *resp.SeriesID != 5 {
			t.Error("Create() seriesID incorrect")
		}
		if resp.SeasonNumber != 2 {
			t.Errorf("Create() season = %d, want 2", resp.SeasonNumber)
		}
		if resp.EpisodeNumber != 3 {
			t.Errorf("Create() episode = %d, want 3", resp.EpisodeNumber)
		}
	})

	t.Run("empty title", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		_, err := svc.Create(dto.CreateVODRequest{})
		if err == nil {
			t.Fatal("Create() should return error for empty title")
		}
	})

	t.Run("repo error non-slug-collision", func(t *testing.T) {
		repo := newMockVODRepo()
		repo.createErr = errors.New("database connection lost")
		svc := NewVODService(repo, nil)

		_, err := svc.Create(dto.CreateVODRequest{Title: "Movie"})
		if err == nil {
			t.Fatal("Create() should return error when repo fails")
		}
	})

	t.Run("slug collision retries", func(t *testing.T) {
		repo := newMockVODRepo()
		callCount := 0
		originalCreate := repo.Create
		_ = originalCreate
		// Simulate slug collision on first attempt then success
		repo.createErr = nil

		// Add a VOD that will cause the slug collision check path
		// The service checks for "idx_vods_slug" or "23505" in error message
		repo2 := &mockVODRepoWithSlugCollision{
			mockVODRepo:    newMockVODRepo(),
			failCount:      1,
			currentAttempt: &callCount,
		}
		svc2 := NewVODService(repo2, nil)

		resp, err := svc2.Create(dto.CreateVODRequest{Title: "Movie"})
		if err != nil {
			t.Fatalf("Create() with slug collision retry error = %v", err)
		}
		if resp == nil {
			t.Fatal("Create() should succeed after retry")
		}
	})
}

// mockVODRepoWithSlugCollision simulates slug collisions for the first N create attempts
type mockVODRepoWithSlugCollision struct {
	*mockVODRepo
	failCount      int
	currentAttempt *int
}

func (m *mockVODRepoWithSlugCollision) Create(vod *model.VOD) error {
	*m.currentAttempt++
	if *m.currentAttempt <= m.failCount {
		return errors.New("duplicate key value violates unique constraint idx_vods_slug")
	}
	return m.mockVODRepo.Create(vod)
}

func TestVODService_Create_SlugCollisionExhausted(t *testing.T) {
	// All 5 retry attempts fail with slug collision — should return error
	callCount := 0
	repo := &mockVODRepoWithSlugCollision{
		mockVODRepo:    newMockVODRepo(),
		failCount:      5, // fail all 5 attempts
		currentAttempt: &callCount,
	}
	svc := NewVODService(repo, nil)

	_, err := svc.Create(dto.CreateVODRequest{Title: "Movie"})
	if err == nil {
		t.Fatal("Create() should return error when all slug collision retries are exhausted")
	}
	if callCount != 5 {
		t.Errorf("expected 5 retry attempts, got %d", callCount)
	}
}

func TestVODService_Create_WithAllFields(t *testing.T) {
	repo := newMockVODRepo()
	svc := NewVODService(repo, nil)

	catID := uint(3)
	seriesID := uint(7)
	resp, err := svc.Create(dto.CreateVODRequest{
		Title:         "Full Movie",
		Slug:          "full-movie",
		Description:   "A complete movie",
		CategoryID:    &catID,
		Duration:      7200,
		PosterURL:     "https://poster.jpg",
		BackdropURL:   "https://backdrop.jpg",
		HLSPath:       "/media/full/index.m3u8",
		Year:          2024,
		Rating:        8.5,
		SeriesID:      &seriesID,
		SeasonNumber:  2,
		EpisodeNumber: 5,
	})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if resp.Description != "A complete movie" {
		t.Errorf("description = %q", resp.Description)
	}
	if resp.PosterURL != "https://poster.jpg" {
		t.Errorf("poster_url = %q", resp.PosterURL)
	}
	if resp.BackdropURL != "https://backdrop.jpg" {
		t.Errorf("backdrop_url = %q", resp.BackdropURL)
	}
	if resp.Duration != 7200 {
		t.Errorf("duration = %d", resp.Duration)
	}
	if resp.Year != 2024 {
		t.Errorf("year = %d", resp.Year)
	}
	if resp.Rating != 8.5 {
		t.Errorf("rating = %f", resp.Rating)
	}
	if resp.CategoryID == nil || *resp.CategoryID != 3 {
		t.Error("categoryID incorrect")
	}
}

func TestVODService_Update(t *testing.T) {
	t.Run("success - update title", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Old Title", Slug: "old-title", IsActive: true, TranscodeStatus: "completed"})

		resp, err := svc.Update(1, dto.UpdateVODRequest{Title: "New Title"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Title != "New Title" {
			t.Errorf("Update() title = %q", resp.Title)
		}
	})

	t.Run("success - update year and rating", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		year := 2024
		rating := 8.5
		resp, err := svc.Update(1, dto.UpdateVODRequest{Year: &year, Rating: &rating})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Year != 2024 {
			t.Errorf("Update() year = %d", resp.Year)
		}
		if resp.Rating != 8.5 {
			t.Errorf("Update() rating = %f", resp.Rating)
		}
	})

	t.Run("HLS path updates transcode status from pending", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: "pending"})

		resp, err := svc.Update(1, dto.UpdateVODRequest{HLSPath: "/media/movie/index.m3u8"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.TranscodeStatus != "completed" {
			t.Errorf("Update() transcode_status = %q, want %q", resp.TranscodeStatus, "completed")
		}
		if resp.TranscodeProgress != 100 {
			t.Errorf("Update() transcode_progress = %d, want 100", resp.TranscodeProgress)
		}
	})

	t.Run("HLS path does not change status if already failed", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: "failed"})

		resp, err := svc.Update(1, dto.UpdateVODRequest{HLSPath: "/media/movie/index.m3u8"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		// The service only changes status if it was "pending" or ""
		if resp.TranscodeStatus != "failed" {
			t.Errorf("Update() transcode_status = %q, should remain %q", resp.TranscodeStatus, "failed")
		}
	})

	t.Run("success - update IsActive", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		isActive := false
		resp, err := svc.Update(1, dto.UpdateVODRequest{IsActive: &isActive})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.IsActive {
			t.Error("Update() should set IsActive to false")
		}
	})

	t.Run("success - update duration", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		dur := 7200
		resp, err := svc.Update(1, dto.UpdateVODRequest{Duration: &dur})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Duration != 7200 {
			t.Errorf("Update() duration = %d, want 7200", resp.Duration)
		}
	})

	t.Run("success - update series association", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Episode", Slug: "ep", IsActive: true})

		seriesID := uint(5)
		season := 2
		episode := 3
		resp, err := svc.Update(1, dto.UpdateVODRequest{
			SeriesID:      &seriesID,
			SeasonNumber:  &season,
			EpisodeNumber: &episode,
		})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.SeriesID == nil || *resp.SeriesID != 5 {
			t.Error("Update() seriesID incorrect")
		}
		if resp.SeasonNumber != 2 {
			t.Errorf("Update() season = %d", resp.SeasonNumber)
		}
		if resp.EpisodeNumber != 3 {
			t.Errorf("Update() episode = %d", resp.EpisodeNumber)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		_, err := svc.Update(999, dto.UpdateVODRequest{Title: "test"})
		if err == nil {
			t.Fatal("Update() should return error for nonexistent VOD")
		}
	})

	t.Run("repo update error", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})
		repo.updateErr = gorm.ErrInvalidDB

		_, err := svc.Update(1, dto.UpdateVODRequest{Title: "New"})
		if err == nil {
			t.Fatal("Update() should return error when repo update fails")
		}
	})

	t.Run("HLS path updates transcode status from empty string", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		// TranscodeStatus is empty string (not "pending")
		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: ""})

		resp, err := svc.Update(1, dto.UpdateVODRequest{HLSPath: "/media/movie/index.m3u8"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.TranscodeStatus != "completed" {
			t.Errorf("Update() transcode_status = %q, want %q", resp.TranscodeStatus, "completed")
		}
		if resp.TranscodeProgress != 100 {
			t.Errorf("Update() transcode_progress = %d, want 100", resp.TranscodeProgress)
		}
	})

	t.Run("HLS path does not change status if already completed", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: "completed", TranscodeProgress: 100})

		resp, err := svc.Update(1, dto.UpdateVODRequest{HLSPath: "/media/new/index.m3u8"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.TranscodeStatus != "completed" {
			t.Errorf("Update() transcode_status should remain %q, got %q", "completed", resp.TranscodeStatus)
		}
		if resp.HLSPath != "/media/new/index.m3u8" {
			t.Errorf("Update() hls_path = %q, want %q", resp.HLSPath, "/media/new/index.m3u8")
		}
	})

	t.Run("success - update slug", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateVODRequest{Slug: "new-slug"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Slug != "new-slug" {
			t.Errorf("Update() slug = %q, want %q", resp.Slug, "new-slug")
		}
	})

	t.Run("success - update description", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateVODRequest{Description: "A great movie"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Description != "A great movie" {
			t.Errorf("Update() description = %q, want %q", resp.Description, "A great movie")
		}
	})

	t.Run("success - update poster and backdrop", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		resp, err := svc.Update(1, dto.UpdateVODRequest{
			PosterURL:   "https://poster.jpg",
			BackdropURL: "https://backdrop.jpg",
		})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.PosterURL != "https://poster.jpg" {
			t.Errorf("Update() poster_url = %q", resp.PosterURL)
		}
		if resp.BackdropURL != "https://backdrop.jpg" {
			t.Errorf("Update() backdrop_url = %q", resp.BackdropURL)
		}
	})

	t.Run("empty update preserves fields", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{
			Title:    "Movie",
			Slug:     "movie",
			IsActive: true,
			Year:     2020,
			Rating:   7.5,
			Duration: 3600,
		})

		resp, err := svc.Update(1, dto.UpdateVODRequest{})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Title != "Movie" {
			t.Errorf("should preserve title, got %q", resp.Title)
		}
		if resp.Year != 2020 {
			t.Errorf("should preserve year, got %d", resp.Year)
		}
		if resp.Rating != 7.5 {
			t.Errorf("should preserve rating, got %f", resp.Rating)
		}
	})
}

func TestVODService_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Test", Slug: "test", IsActive: true})

		err := svc.Delete(1)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}

		_, err = repo.FindByID(1)
		if err == nil {
			t.Error("Delete() should remove VOD from repo")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		err := svc.Delete(999)
		if err == nil {
			t.Fatal("Delete() should return error for nonexistent VOD")
		}
	})
}

func TestVODService_CreateFromMedia(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		media := &dto.LocalMediaResponse{
			ID:               1,
			OriginalFilename: "movie.mp4",
			HLSPath:          "/media/movie/index.m3u8",
			FileSize:         1024000,
			Duration:         7200,
			Resolution:       "1920x1080",
			Status:           "completed",
			ThumbnailPath:    "/media/movie/thumb.jpg",
		}

		resp, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{
			Title: "Movie From Media",
		})
		if err != nil {
			t.Fatalf("CreateFromMedia() error = %v", err)
		}
		if resp.Title != "Movie From Media" {
			t.Errorf("title = %q", resp.Title)
		}
		if resp.TranscodeStatus != "completed" {
			t.Errorf("transcode_status = %q, want %q", resp.TranscodeStatus, "completed")
		}
		if resp.TranscodeProgress != 100 {
			t.Errorf("transcode_progress = %d, want 100", resp.TranscodeProgress)
		}
		if resp.HLSPath != "/media/movie/index.m3u8" {
			t.Errorf("hls_path = %q", resp.HLSPath)
		}
		if resp.Duration != 7200 {
			t.Errorf("duration = %d, want 7200", resp.Duration)
		}
	})

	t.Run("uses thumbnail as poster and backdrop", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		media := &dto.LocalMediaResponse{
			Status:        "completed",
			HLSPath:       "/media/movie/index.m3u8",
			ThumbnailPath: "/media/movie/thumb.jpg",
		}

		resp, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{Title: "Movie"})
		if err != nil {
			t.Fatalf("CreateFromMedia() error = %v", err)
		}
		if resp.PosterURL != "/media/movie/thumb.jpg" {
			t.Errorf("poster should use thumbnail, got %q", resp.PosterURL)
		}
	})

	t.Run("explicit poster overrides thumbnail", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		media := &dto.LocalMediaResponse{
			Status:        "completed",
			HLSPath:       "/media/movie/index.m3u8",
			ThumbnailPath: "/media/movie/thumb.jpg",
		}

		resp, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{
			Title:     "Movie",
			PosterURL: "https://custom-poster.jpg",
		})
		if err != nil {
			t.Fatalf("CreateFromMedia() error = %v", err)
		}
		if resp.PosterURL != "https://custom-poster.jpg" {
			t.Errorf("poster should use custom URL, got %q", resp.PosterURL)
		}
	})

	t.Run("with series association", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		media := &dto.LocalMediaResponse{
			Status:  "completed",
			HLSPath: "/media/ep/index.m3u8",
		}

		seriesID := uint(5)
		resp, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{
			Title:         "Episode 1",
			SeriesID:      &seriesID,
			SeasonNumber:  1,
			EpisodeNumber: 1,
		})
		if err != nil {
			t.Fatalf("CreateFromMedia() error = %v", err)
		}
		if resp.SeriesID == nil || *resp.SeriesID != 5 {
			t.Error("seriesID incorrect")
		}
	})

	t.Run("empty title", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		media := &dto.LocalMediaResponse{Status: "completed", HLSPath: "/path"}

		_, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{})
		if err == nil {
			t.Fatal("should return error for empty title")
		}
	})

	t.Run("media not completed", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		media := &dto.LocalMediaResponse{Status: "processing", HLSPath: "/some/path"}

		_, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{Title: "Test"})
		if err == nil {
			t.Fatal("should return error for non-completed media")
		}
	})

	t.Run("media without HLS path", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		media := &dto.LocalMediaResponse{Status: "completed", HLSPath: ""}

		_, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{Title: "Test"})
		if err == nil {
			t.Fatal("should return error for media without HLS path")
		}
	})

	t.Run("repo create error", func(t *testing.T) {
		repo := newMockVODRepo()
		repo.createErr = gorm.ErrInvalidDB
		svc := NewVODService(repo, nil)

		media := &dto.LocalMediaResponse{
			Status:  "completed",
			HLSPath: "/media/movie/index.m3u8",
		}

		_, err := svc.CreateFromMedia(media, dto.CreateVODFromMediaRequest{Title: "Movie"})
		if err == nil {
			t.Fatal("should return error when repo create fails")
		}
	})
}

func TestVODService_UpdateFileInfo(t *testing.T) {
	t.Run("updates file info", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		svc.UpdateFileInfo(1, "movie.mp4", "1920x1080", 1024000)

		vod, _ := repo.FindByID(1)
		if vod.OriginalFilename != "movie.mp4" {
			t.Errorf("original_filename = %q", vod.OriginalFilename)
		}
		if vod.Resolution != "1920x1080" {
			t.Errorf("resolution = %q", vod.Resolution)
		}
		if vod.FileSize != 1024000 {
			t.Errorf("file_size = %d", vod.FileSize)
		}
	})

	t.Run("no-op for nonexistent VOD", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)
		// Should not panic
		svc.UpdateFileInfo(999, "movie.mp4", "1080p", 1000)
	})
}

func TestVODService_UpdateTranscodeStatus(t *testing.T) {
	t.Run("updates status and progress", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: "pending"})

		svc.UpdateTranscodeStatus(1, "processing", 50, "")

		vod, _ := repo.FindByID(1)
		if vod.TranscodeStatus != "processing" {
			t.Errorf("transcode_status = %q", vod.TranscodeStatus)
		}
		if vod.TranscodeProgress != 50 {
			t.Errorf("transcode_progress = %d", vod.TranscodeProgress)
		}
	})

	t.Run("updates HLS path when provided", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, TranscodeStatus: "processing"})

		svc.UpdateTranscodeStatus(1, "completed", 100, "/media/movie/index.m3u8")

		vod, _ := repo.FindByID(1)
		if vod.HLSPath != "/media/movie/index.m3u8" {
			t.Errorf("hls_path = %q", vod.HLSPath)
		}
	})

	t.Run("does not update HLS path when empty", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{
			Title:           "Movie",
			Slug:            "movie",
			IsActive:        true,
			TranscodeStatus: "processing",
			HLSPath:         "/existing/path",
		})

		svc.UpdateTranscodeStatus(1, "failed", 0, "")

		vod, _ := repo.FindByID(1)
		if vod.HLSPath != "/existing/path" {
			t.Errorf("hls_path should be preserved, got %q", vod.HLSPath)
		}
	})

	t.Run("no-op for nonexistent VOD", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)
		// Should not panic
		svc.UpdateTranscodeStatus(999, "completed", 100, "/path")
	})
}

func TestVODService_DebugStats(t *testing.T) {
	t.Run("complete stats", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		seriesID := uint(1)
		repo.addVOD(&model.VOD{Title: "Active Standalone", Slug: "active-standalone", IsActive: true, HLSPath: "/path", TranscodeStatus: "completed"})
		repo.addVOD(&model.VOD{Title: "Episode", Slug: "episode", IsActive: true, SeriesID: &seriesID, HLSPath: "/path", TranscodeStatus: "completed"})
		repo.addVOD(&model.VOD{Title: "Inactive", Slug: "inactive", IsActive: false})
		repo.addVOD(&model.VOD{Title: "No HLS", Slug: "no-hls", IsActive: true, HLSPath: "", TranscodeStatus: "pending"})

		stats, err := svc.DebugStats()
		if err != nil {
			t.Fatalf("DebugStats() error = %v", err)
		}
		if stats.Total != 4 {
			t.Errorf("total = %d, want 4", stats.Total)
		}
		if stats.ActiveStandalone != 2 {
			t.Errorf("active_standalone = %d, want 2", stats.ActiveStandalone)
		}
		if stats.ActiveEpisodes != 1 {
			t.Errorf("active_episodes = %d, want 1", stats.ActiveEpisodes)
		}
		if stats.Inactive != 1 {
			t.Errorf("inactive = %d, want 1", stats.Inactive)
		}
		if stats.VisibleToUsers != 2 {
			t.Errorf("visible_to_users = %d, want 2", stats.VisibleToUsers)
		}
	})

	t.Run("problems detected", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Inactive", Slug: "inactive", IsActive: false})
		repo.addVOD(&model.VOD{Title: "No HLS", Slug: "no-hls", IsActive: true, HLSPath: ""})
		repo.addVOD(&model.VOD{Title: "Processing", Slug: "processing", IsActive: true, HLSPath: "/path", TranscodeStatus: "processing"})

		stats, err := svc.DebugStats()
		if err != nil {
			t.Fatalf("DebugStats() error = %v", err)
		}
		if len(stats.Problems) != 3 {
			t.Errorf("problems count = %d, want 3", len(stats.Problems))
		}
	})

	t.Run("no problems for healthy VODs", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Good Movie", Slug: "good", IsActive: true, HLSPath: "/path", TranscodeStatus: "completed"})

		stats, err := svc.DebugStats()
		if err != nil {
			t.Fatalf("DebugStats() error = %v", err)
		}
		if len(stats.Problems) != 0 {
			t.Errorf("problems count = %d, want 0", len(stats.Problems))
		}
		if stats.VisibleToUsers != 1 {
			t.Errorf("visible_to_users = %d, want 1", stats.VisibleToUsers)
		}
	})

	t.Run("empty repository", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		stats, err := svc.DebugStats()
		if err != nil {
			t.Fatalf("DebugStats() error = %v", err)
		}
		if stats.Total != 0 {
			t.Errorf("total = %d, want 0", stats.Total)
		}
		if stats.VisibleToUsers != 0 {
			t.Errorf("visible_to_users = %d, want 0", stats.VisibleToUsers)
		}
	})
}

func TestVODService_CountActive(t *testing.T) {
	t.Run("counts only active", func(t *testing.T) {
		repo := newMockVODRepo()
		svc := NewVODService(repo, nil)

		repo.addVOD(&model.VOD{Title: "Active", Slug: "active", IsActive: true})
		repo.addVOD(&model.VOD{Title: "Inactive", Slug: "inactive", IsActive: false})
		repo.addVOD(&model.VOD{Title: "Active 2", Slug: "active-2", IsActive: true})

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 2 {
			t.Errorf("CountActive() = %d, want 2", count)
		}
	})

	t.Run("zero when empty", func(t *testing.T) {
		svc := NewVODService(newMockVODRepo(), nil)

		count, err := svc.CountActive()
		if err != nil {
			t.Fatalf("CountActive() error = %v", err)
		}
		if count != 0 {
			t.Errorf("CountActive() = %d, want 0", count)
		}
	})
}

func TestVODService_ListRecent(t *testing.T) {
	repo := newMockVODRepo()

	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true})
	repo.addVOD(&model.VOD{Title: "Movie 2", Slug: "movie-2", IsActive: true})
	repo.addVOD(&model.VOD{Title: "Movie 3", Slug: "movie-3", IsActive: true})

	vods, err := repo.ListRecent(2)
	if err != nil {
		t.Fatalf("ListRecent() error = %v", err)
	}
	if len(vods) > 2 {
		t.Errorf("ListRecent(2) returned %d, want <= 2", len(vods))
	}
}

func TestVODService_ListByTranscodeStatus(t *testing.T) {
	repo := newMockVODRepo()

	repo.addVOD(&model.VOD{Title: "Pending", Slug: "pending", TranscodeStatus: "pending"})
	repo.addVOD(&model.VOD{Title: "Processing", Slug: "processing", TranscodeStatus: "processing"})
	repo.addVOD(&model.VOD{Title: "Completed", Slug: "completed", TranscodeStatus: "completed"})
	repo.addVOD(&model.VOD{Title: "Failed", Slug: "failed", TranscodeStatus: "failed"})

	vods, err := repo.ListByTranscodeStatus([]string{"pending", "processing"})
	if err != nil {
		t.Fatalf("ListByTranscodeStatus() error = %v", err)
	}
	if len(vods) != 2 {
		t.Errorf("ListByTranscodeStatus() returned %d, want 2", len(vods))
	}
}

func TestVODService_ListWithoutPoster(t *testing.T) {
	repo := newMockVODRepo()

	repo.addVOD(&model.VOD{Title: "With Poster", Slug: "with-poster", PosterURL: "https://poster.jpg"})
	repo.addVOD(&model.VOD{Title: "No Poster 1", Slug: "no-poster-1", PosterURL: ""})
	repo.addVOD(&model.VOD{Title: "No Poster 2", Slug: "no-poster-2", PosterURL: ""})

	vods, err := repo.ListWithoutPoster()
	if err != nil {
		t.Fatalf("ListWithoutPoster() error = %v", err)
	}
	if len(vods) != 2 {
		t.Errorf("ListWithoutPoster() returned %d, want 2", len(vods))
	}
}

func TestVODService_ListBySeries(t *testing.T) {
	repo := newMockVODRepo()

	seriesID := uint(1)
	otherSeries := uint(2)
	repo.addVOD(&model.VOD{Title: "S01E01", Slug: "s01e01", SeriesID: &seriesID})
	repo.addVOD(&model.VOD{Title: "S01E02", Slug: "s01e02", SeriesID: &seriesID})
	repo.addVOD(&model.VOD{Title: "Other", Slug: "other", SeriesID: &otherSeries})
	repo.addVOD(&model.VOD{Title: "Standalone", Slug: "standalone"})

	vods, err := repo.ListBySeries(1)
	if err != nil {
		t.Fatalf("ListBySeries() error = %v", err)
	}
	if len(vods) != 2 {
		t.Errorf("ListBySeries(1) returned %d, want 2", len(vods))
	}

	vods, err = repo.ListBySeries(999)
	if err != nil {
		t.Fatalf("ListBySeries() error = %v", err)
	}
	if len(vods) != 0 {
		t.Errorf("ListBySeries(999) returned %d, want 0", len(vods))
	}
}

func TestVODService_EnrichWithTMDB_NilTMDB(t *testing.T) {
	svc := NewVODService(newMockVODRepo(), nil)

	_, err := svc.EnrichWithTMDB()
	if err == nil {
		t.Fatal("EnrichWithTMDB() should return error when TMDB is nil")
	}
}

func TestVODService_EnrichWithTMDB_NotConfigured(t *testing.T) {
	tmdb := NewTMDBService("")
	svc := NewVODService(newMockVODRepo(), tmdb)

	_, err := svc.EnrichWithTMDB()
	if err == nil {
		t.Fatal("EnrichWithTMDB() should return error when TMDB is not configured")
	}
}

func TestVODService_EnrichWithTMDB_WithMockServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{
					ID:           550,
					Title:        "Test Movie",
					Overview:     "A test movie description",
					PosterPath:   "/poster123.jpg",
					BackdropPath: "/backdrop456.jpg",
					ReleaseDate:  "2020-01-15",
					VoteAverage:  8.5,
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	repo.addVOD(&model.VOD{Title: "Test Movie", Slug: "test-movie", IsActive: true, PosterURL: "", Year: 0})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Enriched != 1 {
		t.Errorf("enriched = %d, want 1", result.Enriched)
	}
	if result.Failed != 0 {
		t.Errorf("failed = %d, want 0", result.Failed)
	}

	// Verify the VOD was updated
	vod, _ := repo.FindByID(1)
	if vod.PosterURL == "" {
		t.Error("PosterURL should have been enriched")
	}
	if vod.BackdropURL == "" {
		t.Error("BackdropURL should have been enriched")
	}
	if vod.Description == "" {
		t.Error("Description should have been enriched")
	}
	if vod.Rating == 0 {
		t.Error("Rating should have been enriched")
	}
	if vod.Year == 0 {
		t.Error("Year should have been enriched")
	}
}

func TestVODService_EnrichWithTMDB_NoResults(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{Page: 1, TotalResults: 0, Results: []TMDBSearchResult{}}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	repo.addVOD(&model.VOD{Title: "Unknown Movie", Slug: "unknown", IsActive: true, PosterURL: ""})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Skipped != 1 {
		t.Errorf("skipped = %d, want 1", result.Skipped)
	}
	if result.Enriched != 0 {
		t.Errorf("enriched = %d, want 0", result.Enriched)
	}
}

func TestVODService_EnrichWithTMDB_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"status_message":"Internal error"}`))
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	repo.addVOD(&model.VOD{Title: "Some Movie", Slug: "some-movie", IsActive: true, PosterURL: ""})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Failed != 1 {
		t.Errorf("failed = %d, want 1", result.Failed)
	}
}

func TestVODService_EnrichWithTMDB_UpdateError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{ID: 550, Title: "Movie", PosterPath: "/poster.jpg", VoteAverage: 8.0},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, PosterURL: ""})
	repo.updateErr = gorm.ErrInvalidDB
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Failed != 1 {
		t.Errorf("failed = %d, want 1", result.Failed)
	}
}

func TestVODService_EnrichWithTMDB_AlreadyHasData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := tmdbSearchResponse{
			Page:         1,
			TotalResults: 1,
			Results: []TMDBSearchResult{
				{ID: 550, Title: "Movie", PosterPath: "", BackdropPath: "", Overview: "", VoteAverage: 0},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	// This VOD has no poster (so it's in ListWithoutPoster) but TMDB returns empty paths
	repo.addVOD(&model.VOD{
		Title:       "Movie",
		Slug:        "movie",
		IsActive:    true,
		PosterURL:   "",
		Description: "Already has description",
		Rating:      7.5,
		Year:        2020,
	})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	// Nothing to update since TMDB returned empty data and VOD already has description/rating/year
	if result.Skipped != 1 {
		t.Errorf("skipped = %d, want 1", result.Skipped)
	}
}

func TestVODService_EnrichWithTMDB_MultipleVODs(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			// First VOD: found
			resp := tmdbSearchResponse{
				Page: 1, TotalResults: 1,
				Results: []TMDBSearchResult{{ID: 1, Title: "Movie 1", PosterPath: "/p1.jpg", VoteAverage: 7.0, ReleaseDate: "2020-01-01"}},
			}
			json.NewEncoder(w).Encode(resp)
		} else {
			// Second VOD: not found
			resp := tmdbSearchResponse{Page: 1, TotalResults: 0, Results: []TMDBSearchResult{}}
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer server.Close()

	tmdb := NewTMDBService("test-key")
	tmdb.baseURL = server.URL

	repo := newMockVODRepo()
	repo.addVOD(&model.VOD{Title: "Movie 1", Slug: "movie-1", IsActive: true, PosterURL: ""})
	repo.addVOD(&model.VOD{Title: "Movie 2", Slug: "movie-2", IsActive: true, PosterURL: ""})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Enriched != 1 {
		t.Errorf("enriched = %d, want 1", result.Enriched)
	}
	if result.Skipped != 1 {
		t.Errorf("skipped = %d, want 1", result.Skipped)
	}
}

func TestVODService_EnrichWithTMDB_NoVODsWithoutPoster(t *testing.T) {
	tmdb := NewTMDBService("test-key")

	repo := newMockVODRepo()
	// All VODs have posters
	repo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, PosterURL: "https://poster.jpg"})
	svc := NewVODService(repo, tmdb)

	result, err := svc.EnrichWithTMDB()
	if err != nil {
		t.Fatalf("EnrichWithTMDB() error = %v", err)
	}
	if result.Enriched != 0 {
		t.Errorf("enriched = %d, want 0", result.Enriched)
	}
	if result.Skipped != 0 {
		t.Errorf("skipped = %d, want 0", result.Skipped)
	}
}
