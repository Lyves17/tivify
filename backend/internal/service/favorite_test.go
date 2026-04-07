package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock FavoriteRepository ---

type mockFavoriteRepo struct {
	favorites map[uint]*model.Favorite
	nextID    uint
	createErr error
	deleteErr error
}

func newMockFavoriteRepo() *mockFavoriteRepo {
	return &mockFavoriteRepo{
		favorites: make(map[uint]*model.Favorite),
		nextID:    1,
	}
}

func (m *mockFavoriteRepo) FindByUserAndItem(userID uuid.UUID, favType string, favID uint) (*model.Favorite, error) {
	for _, f := range m.favorites {
		if f.UserID == userID && f.FavoritableType == favType && f.FavoritableID == favID {
			return f, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockFavoriteRepo) ListByUser(userID uuid.UUID, page, perPage int) ([]model.Favorite, int64, error) {
	var favs []model.Favorite
	for _, f := range m.favorites {
		if f.UserID == userID {
			favs = append(favs, *f)
		}
	}
	total := int64(len(favs))
	start := (page - 1) * perPage
	if start >= len(favs) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(favs) {
		end = len(favs)
	}
	return favs[start:end], total, nil
}

func (m *mockFavoriteRepo) Create(fav *model.Favorite) error {
	if m.createErr != nil {
		return m.createErr
	}
	fav.ID = m.nextID
	fav.CreatedAt = time.Now()
	m.nextID++
	m.favorites[fav.ID] = fav
	return nil
}

func (m *mockFavoriteRepo) Delete(id uint) error {
	delete(m.favorites, id)
	return nil
}

func (m *mockFavoriteRepo) DeleteByUserAndItem(userID uuid.UUID, favType string, favID uint) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	for id, f := range m.favorites {
		if f.UserID == userID && f.FavoritableType == favType && f.FavoritableID == favID {
			delete(m.favorites, id)
			return nil
		}
	}
	return nil
}

// --- FavoriteService Tests ---

func TestFavoriteService_Toggle(t *testing.T) {
	t.Run("add channel favorite", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		added, err := svc.Toggle(userID, "channel", 1)
		if err != nil {
			t.Fatalf("Toggle() error = %v", err)
		}
		if !added {
			t.Error("Toggle() should return true when adding")
		}
		if len(favRepo.favorites) != 1 {
			t.Errorf("should have 1 favorite, got %d", len(favRepo.favorites))
		}
	})

	t.Run("add vod favorite", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		added, err := svc.Toggle(userID, "vod", 1)
		if err != nil {
			t.Fatalf("Toggle(vod) error = %v", err)
		}
		if !added {
			t.Error("should return true when adding")
		}
	})

	t.Run("add series favorite", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		added, err := svc.Toggle(userID, "series", 1)
		if err != nil {
			t.Fatalf("Toggle(series) error = %v", err)
		}
		if !added {
			t.Error("should return true when adding")
		}
	})

	t.Run("remove existing favorite", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		// Add first
		svc.Toggle(userID, "channel", 1)
		if len(favRepo.favorites) != 1 {
			t.Fatalf("expected 1 favorite after add, got %d", len(favRepo.favorites))
		}

		// Remove
		added, err := svc.Toggle(userID, "channel", 1)
		if err != nil {
			t.Fatalf("Toggle() error = %v", err)
		}
		if added {
			t.Error("should return false when removing")
		}
		if len(favRepo.favorites) != 0 {
			t.Errorf("should have 0 favorites after remove, got %d", len(favRepo.favorites))
		}
	})

	t.Run("toggle add then remove then add again", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		added1, _ := svc.Toggle(userID, "channel", 1)
		if !added1 {
			t.Error("first toggle should add")
		}

		added2, _ := svc.Toggle(userID, "channel", 1)
		if added2 {
			t.Error("second toggle should remove")
		}

		added3, _ := svc.Toggle(userID, "channel", 1)
		if !added3 {
			t.Error("third toggle should add again")
		}
	})

	t.Run("invalid type", func(t *testing.T) {
		svc := NewFavoriteService(newMockFavoriteRepo(), newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		_, err := svc.Toggle(uuid.New(), "invalid", 1)
		if err == nil {
			t.Fatal("should return error for invalid type")
		}
		if err.Error() != "tipo invalido" {
			t.Errorf("error = %q, want %q", err.Error(), "tipo invalido")
		}
	})

	t.Run("invalid types are rejected", func(t *testing.T) {
		svc := NewFavoriteService(newMockFavoriteRepo(), newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		invalidTypes := []string{"movie", "Channel", "VOD", "SERIES", "", "channels"}
		for _, typ := range invalidTypes {
			_, err := svc.Toggle(uuid.New(), typ, 1)
			if err == nil {
				t.Errorf("Toggle(%q) should return error", typ)
			}
		}
	})

	t.Run("different users can favorite same item", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		user1 := uuid.New()
		user2 := uuid.New()

		added1, err := svc.Toggle(user1, "channel", 1)
		if err != nil {
			t.Fatalf("Toggle user1 error = %v", err)
		}
		if !added1 {
			t.Error("user1 should add")
		}

		added2, err := svc.Toggle(user2, "channel", 1)
		if err != nil {
			t.Fatalf("Toggle user2 error = %v", err)
		}
		if !added2 {
			t.Error("user2 should add")
		}

		if len(favRepo.favorites) != 2 {
			t.Errorf("should have 2 favorites, got %d", len(favRepo.favorites))
		}
	})

	t.Run("same user different items", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		svc.Toggle(userID, "channel", 1)
		svc.Toggle(userID, "vod", 2)
		svc.Toggle(userID, "series", 3)

		if len(favRepo.favorites) != 3 {
			t.Errorf("should have 3 favorites, got %d", len(favRepo.favorites))
		}
	})

	t.Run("create error", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		favRepo.createErr = gorm.ErrInvalidDB
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		_, err := svc.Toggle(uuid.New(), "channel", 1)
		if err == nil {
			t.Fatal("should return error when create fails")
		}
	})

	t.Run("delete error", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		// Add first
		svc.Toggle(userID, "channel", 1)

		// Set delete error
		favRepo.deleteErr = gorm.ErrInvalidDB

		// Try to remove — should fail
		_, err := svc.Toggle(userID, "channel", 1)
		if err == nil {
			t.Fatal("should return error when delete fails")
		}
	})
}

func TestFavoriteService_ListByUser(t *testing.T) {
	t.Run("returns enriched favorites", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		chRepo := newMockChannelRepo()
		vRepo := newMockVODRepo()
		sRepo := newMockSeriesRepo()
		svc := NewFavoriteService(favRepo, chRepo, vRepo, sRepo)

		userID := uuid.New()

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", IsActive: true, LogoURL: "https://espn-logo.png"})
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", IsActive: true, PosterURL: "https://movie-poster.jpg"})
		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", IsActive: true, PosterURL: "https://series-poster.jpg"})

		svc.Toggle(userID, "channel", 1)
		svc.Toggle(userID, "vod", 1)
		svc.Toggle(userID, "series", 1)

		items, total, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(items) != 3 {
			t.Errorf("returned %d items, want 3", len(items))
		}

		// Check enrichment happened
		for _, item := range items {
			if item.ContentName == "" {
				t.Errorf("item type=%q should have content_name", item.FavoritableType)
			}
			if item.CreatedAt == "" {
				t.Error("created_at should be formatted")
			}
		}
	})

	t.Run("enriches channel favorites", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		chRepo := newMockChannelRepo()
		svc := NewFavoriteService(favRepo, chRepo, newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()
		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn", LogoURL: "https://logo.png"})
		svc.Toggle(userID, "channel", 1)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("returned %d items, want 1", len(items))
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

	t.Run("enriches vod favorites", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		vRepo := newMockVODRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), vRepo, newMockSeriesRepo())

		userID := uuid.New()
		vRepo.addVOD(&model.VOD{Title: "Movie", Slug: "movie", PosterURL: "https://poster.jpg"})
		svc.Toggle(userID, "vod", 1)

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
	})

	t.Run("enriches series favorites", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		sRepo := newMockSeriesRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), sRepo)

		userID := uuid.New()
		sRepo.addSeries(&model.Series{Title: "Series", Slug: "series", PosterURL: "https://poster.jpg"})
		svc.Toggle(userID, "series", 1)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		if len(items) != 1 {
			t.Fatalf("returned %d, want 1", len(items))
		}
		if items[0].ContentName != "Series" {
			t.Errorf("content_name = %q", items[0].ContentName)
		}
	})

	t.Run("deleted content shows eliminado", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

		userID := uuid.New()

		// Add favorites for non-existent content
		svc.Toggle(userID, "channel", 999)
		svc.Toggle(userID, "vod", 999)
		svc.Toggle(userID, "series", 999)

		items, _, err := svc.ListByUser(userID, 1, 20)
		if err != nil {
			t.Fatalf("ListByUser() error = %v", err)
		}
		for _, item := range items {
			if item.ContentName != "(eliminado)" {
				t.Errorf("type=%q content_name = %q, want %q", item.FavoritableType, item.ContentName, "(eliminado)")
			}
		}
	})

	t.Run("empty list for user with no favorites", func(t *testing.T) {
		svc := NewFavoriteService(newMockFavoriteRepo(), newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())

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

	t.Run("only returns favorites for specified user", func(t *testing.T) {
		favRepo := newMockFavoriteRepo()
		chRepo := newMockChannelRepo()
		svc := NewFavoriteService(favRepo, chRepo, newMockVODRepo(), newMockSeriesRepo())

		chRepo.addChannel(&model.Channel{Name: "ESPN", Slug: "espn"})

		user1 := uuid.New()
		user2 := uuid.New()

		svc.Toggle(user1, "channel", 1)
		svc.Toggle(user2, "channel", 1)

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
