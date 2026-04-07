package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock WatchHistoryRepository ---

type mockWatchHistoryRepo struct {
	entries   map[uint]*model.WatchHistory
	nextID    uint
	upsertErr error
	deleteErr error
}

func newMockWatchHistoryRepo() *mockWatchHistoryRepo {
	return &mockWatchHistoryRepo{
		entries: make(map[uint]*model.WatchHistory),
		nextID:  1,
	}
}

func (m *mockWatchHistoryRepo) ListByUser(userID uuid.UUID, page, perPage int) ([]model.WatchHistory, int64, error) {
	var history []model.WatchHistory
	for _, h := range m.entries {
		if h.UserID == userID {
			history = append(history, *h)
		}
	}
	total := int64(len(history))
	start := (page - 1) * perPage
	if start >= len(history) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(history) {
		end = len(history)
	}
	return history[start:end], total, nil
}

func (m *mockWatchHistoryRepo) Upsert(entry *model.WatchHistory) error {
	if m.upsertErr != nil {
		return m.upsertErr
	}
	// Check for existing entry with same user+content
	for _, h := range m.entries {
		if h.UserID == entry.UserID && h.ContentType == entry.ContentType && h.ContentID == entry.ContentID {
			h.Progress = entry.Progress
			h.Duration = entry.Duration
			h.WatchedAt = time.Now()
			return nil
		}
	}
	entry.ID = m.nextID
	entry.WatchedAt = time.Now()
	m.nextID++
	m.entries[entry.ID] = entry
	return nil
}

func (m *mockWatchHistoryRepo) ListContinueWatching(userID uuid.UUID, limit int) ([]model.WatchHistory, error) {
	var history []model.WatchHistory
	for _, h := range m.entries {
		if h.UserID == userID && h.ContentType == "vod" && h.Progress > 0 && h.Progress < h.Duration {
			history = append(history, *h)
			if len(history) >= limit {
				break
			}
		}
	}
	return history, nil
}

func (m *mockWatchHistoryRepo) Delete(id uint, userID uuid.UUID) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	h, ok := m.entries[id]
	if !ok || h.UserID != userID {
		return gorm.ErrRecordNotFound
	}
	delete(m.entries, id)
	return nil
}

// --- WatchHistoryService Tests ---

func TestWatchHistoryService_Record(t *testing.T) {
	t.Run("success - vod", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()
		err := svc.Record(userID, "vod", 1, 300, 7200)
		if err != nil {
			t.Fatalf("Record() error = %v", err)
		}
		if len(repo.entries) != 1 {
			t.Errorf("should create 1 entry, got %d", len(repo.entries))
		}
	})

	t.Run("success - channel", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		err := svc.Record(uuid.New(), "channel", 1, 0, 0)
		if err != nil {
			t.Fatalf("Record(channel) error = %v", err)
		}
		if len(repo.entries) != 1 {
			t.Errorf("should create 1 entry, got %d", len(repo.entries))
		}
	})

	t.Run("invalid content type", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		err := svc.Record(uuid.New(), "invalid", 1, 0, 0)
		if err == nil {
			t.Fatal("should return error for invalid content_type")
		}
		if err.Error() != "content_type debe ser 'channel' o 'vod'" {
			t.Errorf("error = %q", err.Error())
		}
	})

	t.Run("various invalid types", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		invalidTypes := []string{"series", "movie", "Channel", "VOD", ""}
		for _, typ := range invalidTypes {
			err := svc.Record(uuid.New(), typ, 1, 0, 0)
			if err == nil {
				t.Errorf("Record(%q) should return error", typ)
			}
		}
	})

	t.Run("zero content ID", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		err := svc.Record(uuid.New(), "vod", 0, 0, 0)
		if err == nil {
			t.Fatal("should return error for zero content_id")
		}
		if err.Error() != "content_id invalido" {
			t.Errorf("error = %q", err.Error())
		}
	})

	t.Run("upsert updates existing entry", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		// First record
		svc.Record(userID, "vod", 1, 300, 7200)
		if len(repo.entries) != 1 {
			t.Fatalf("expected 1 entry after first record, got %d", len(repo.entries))
		}

		// Update progress for same content
		svc.Record(userID, "vod", 1, 600, 7200)
		if len(repo.entries) != 1 {
			t.Errorf("upsert should not create new entry, got %d", len(repo.entries))
		}

		// Verify progress updated
		for _, h := range repo.entries {
			if h.Progress != 600 {
				t.Errorf("progress = %d, want 600", h.Progress)
			}
		}
	})

	t.Run("different content creates separate entries", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		svc.Record(userID, "vod", 1, 300, 7200)
		svc.Record(userID, "vod", 2, 100, 3600)
		svc.Record(userID, "channel", 1, 0, 0)

		if len(repo.entries) != 3 {
			t.Errorf("should have 3 entries, got %d", len(repo.entries))
		}
	})

	t.Run("repo upsert error", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		repo.upsertErr = gorm.ErrInvalidDB
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		err := svc.Record(uuid.New(), "vod", 1, 300, 7200)
		if err == nil {
			t.Fatal("should return error when upsert fails")
		}
	})
}

func TestWatchHistoryService_ListByUser(t *testing.T) {
	t.Run("returns enriched history", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		chRepo := newMockChannelRepo()
		vRepo := newMockVODRepo()
		svc := NewWatchHistoryService(repo, chRepo, vRepo)

		userID := uuid.New()

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true, LogoURL: "https://espn-logo.png"})
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, PosterURL: "https://movie-poster.jpg"})

		svc.Record(userID, "channel", 1, 0, 0)
		svc.Record(userID, "vod", 1, 300, 7200)

		items, total, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(items) != 2 {
			t.Errorf("returned %d items, want 2", len(items))
		}

		for _, item := range items {
			if item.ContentName == "" {
				t.Errorf("type=%q should have content_name", item.ContentType)
			}
			if item.WatchedAt == "" {
				t.Error("watched_at should be formatted")
			}
		}
	})

	t.Run("enriches channel history", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		chRepo := newMockChannelRepo()
		svc := NewWatchHistoryService(repo, chRepo, newMockVODRepo())

		userID := uuid.New()
		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", LogoURL: "https://logo.png"})
		svc.Record(userID, "channel", 1, 0, 0)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("returned %d, want 1", len(items))
		}
		if items[0].ContentName != "ESPN" {
			t.Errorf("content_name = %q, want %q", items[0].ContentName, "ESPN")
		}
		if items[0].ContentPoster != "https://logo.png" {
			t.Errorf("content_poster = %q", items[0].ContentPoster)
		}
		if items[0].ContentSlug != "espn" {
			t.Errorf("content_slug = %q", items[0].ContentSlug)
		}
	})

	t.Run("enriches vod history", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		vRepo := newMockVODRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), vRepo)

		userID := uuid.New()
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", PosterURL: "https://poster.jpg"})
		svc.Record(userID, "vod", 1, 300, 7200)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("returned %d, want 1", len(items))
		}
		if items[0].ContentName != "Movie" {
			t.Errorf("content_name = %q", items[0].ContentName)
		}
		if items[0].Progress != 300 {
			t.Errorf("progress = %d, want 300", items[0].Progress)
		}
		if items[0].Duration != 7200 {
			t.Errorf("duration = %d, want 7200", items[0].Duration)
		}
	})

	t.Run("deleted content shows eliminado", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()
		svc.Record(userID, "vod", 999, 100, 7200)
		svc.Record(userID, "channel", 999, 0, 0)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		for _, item := range items {
			if item.ContentName != "(eliminado)" {
				t.Errorf("type=%q content_name = %q, want %q", item.ContentType, item.ContentName, "(eliminado)")
			}
		}
	})

	t.Run("empty for user with no history", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		items, total, err := svc.ListByUser(uuid.New(), 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if total != 0 {
			t.Errorf("total = %d, want 0", total)
		}
		if items != nil {
			t.Errorf("should return nil for empty, got %d items", len(items))
		}
	})

	t.Run("only returns history for specified user", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		user1 := uuid.New()
		user2 := uuid.New()

		svc.Record(user1, "vod", 1, 300, 7200)
		svc.Record(user2, "vod", 2, 100, 3600)

		items, total, err := svc.ListByUser(user1, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(items) != 1 {
			t.Errorf("returned %d, want 1", len(items))
		}
	})
}

func TestWatchHistoryService_ContinueWatching(t *testing.T) {
	t.Run("returns partially watched VODs", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		vRepo := newMockVODRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), vRepo)

		userID := uuid.New()
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true})

		svc.Record(userID, "vod", 1, 1800, 7200) // 25% watched

		items, err := svc.ContinueWatching(userID, 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) != 1 {
			t.Errorf("returned %d items, want 1", len(items))
		}
	})

	t.Run("excludes completed VODs", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		svc.Record(userID, "vod", 1, 7200, 7200) // fully watched

		items, err := svc.ContinueWatching(userID, 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) != 0 {
			t.Errorf("should exclude completed, got %d", len(items))
		}
	})

	t.Run("excludes zero-progress VODs", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		svc.Record(userID, "vod", 1, 0, 7200) // not started

		items, err := svc.ContinueWatching(userID, 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) != 0 {
			t.Errorf("should exclude zero-progress, got %d", len(items))
		}
	})

	t.Run("excludes channels", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		svc.Record(userID, "channel", 1, 100, 200)

		items, err := svc.ContinueWatching(userID, 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) != 0 {
			t.Errorf("should exclude channels, got %d", len(items))
		}
	})

	t.Run("respects limit", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()

		svc.Record(userID, "vod", 1, 100, 7200)
		svc.Record(userID, "vod", 2, 200, 7200)
		svc.Record(userID, "vod", 3, 300, 7200)

		items, err := svc.ContinueWatching(userID, 2)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) > 2 {
			t.Errorf("should respect limit=2, got %d", len(items))
		}
	})

	t.Run("enriches results", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		vRepo := newMockVODRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), vRepo)

		userID := uuid.New()
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", PosterURL: "https://poster.jpg"})
		svc.Record(userID, "vod", 1, 1800, 7200)

		items, err := svc.ContinueWatching(userID, 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("returned %d, want 1", len(items))
		}
		if items[0].ContentName != "Movie" {
			t.Errorf("content_name = %q", items[0].ContentName)
		}
	})

	t.Run("empty for user with no history", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		items, err := svc.ContinueWatching(uuid.New(), 10)
		if err != nil {
			t.Fatalf("ContinueWatching() error = %v", err)
		}
		if items != nil {
			t.Errorf("should return nil for empty, got %d", len(items))
		}
	})
}

func TestWatchHistoryService_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()
		svc.Record(userID, "vod", 1, 300, 7200)

		err := svc.Delete(1, userID)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}
		if len(repo.entries) != 0 {
			t.Errorf("should remove entry, got %d entries", len(repo.entries))
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewWatchHistoryService(newMockWatchHistoryRepo(), newMockChannelRepo(), newMockVODRepo())

		err := svc.Delete(999, uuid.New())
		if err == nil {
			t.Fatal("should return error for nonexistent entry")
		}
	})

	t.Run("wrong user cannot delete", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		user1 := uuid.New()
		user2 := uuid.New()

		svc.Record(user1, "vod", 1, 300, 7200)

		err := svc.Delete(1, user2)
		if err == nil {
			t.Fatal("should return error when user does not own the entry")
		}
		if len(repo.entries) != 1 {
			t.Error("should not delete entry owned by another user")
		}
	})

	t.Run("repo delete error", func(t *testing.T) {
		repo := newMockWatchHistoryRepo()
		svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())

		userID := uuid.New()
		svc.Record(userID, "vod", 1, 300, 7200)
		repo.deleteErr = gorm.ErrInvalidDB

		err := svc.Delete(1, userID)
		if err == nil {
			t.Fatal("should return error when repo delete fails")
		}
	})
}
