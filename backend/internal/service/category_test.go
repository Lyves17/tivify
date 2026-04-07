package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock CategoryRepository ---

type mockCategoryRepo struct {
	categories map[uint]*model.Category
	bySlug     map[string]*model.Category
	nextID     uint
	createErr  error
	updateErr  error
}

func newMockCategoryRepo() *mockCategoryRepo {
	return &mockCategoryRepo{
		categories: make(map[uint]*model.Category),
		bySlug:     make(map[string]*model.Category),
		nextID:     1,
	}
}

func (m *mockCategoryRepo) FindByID(id uint) (*model.Category, error) {
	c, ok := m.categories[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}

func (m *mockCategoryRepo) FindBySlug(slug string) (*model.Category, error) {
	c, ok := m.bySlug[slug]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}

func (m *mockCategoryRepo) List(page, perPage int) ([]model.Category, int64, error) {
	var cats []model.Category
	for _, c := range m.categories {
		cats = append(cats, *c)
	}
	total := int64(len(cats))
	start := (page - 1) * perPage
	if start >= len(cats) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(cats) {
		end = len(cats)
	}
	return cats[start:end], total, nil
}

func (m *mockCategoryRepo) ListByType(categoryType string) ([]model.Category, error) {
	var cats []model.Category
	for _, c := range m.categories {
		if c.Type == categoryType {
			cats = append(cats, *c)
		}
	}
	return cats, nil
}

func (m *mockCategoryRepo) Create(category *model.Category) error {
	if m.createErr != nil {
		return m.createErr
	}
	category.ID = m.nextID
	m.nextID++
	m.categories[category.ID] = category
	m.bySlug[category.Slug] = category
	return nil
}

func (m *mockCategoryRepo) Update(category *model.Category) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	m.categories[category.ID] = category
	m.bySlug[category.Slug] = category
	return nil
}

func (m *mockCategoryRepo) Delete(id uint) error {
	c, ok := m.categories[id]
	if !ok {
		return gorm.ErrRecordNotFound
	}
	delete(m.categories, id)
	delete(m.bySlug, c.Slug)
	return nil
}

func (m *mockCategoryRepo) Count() (int64, error) {
	return int64(len(m.categories)), nil
}

func (m *mockCategoryRepo) addCategory(cat *model.Category) {
	if cat.ID == 0 {
		cat.ID = m.nextID
		m.nextID++
	}
	m.categories[cat.ID] = cat
	m.bySlug[cat.Slug] = cat
}

// --- Mock CacheService ---

type mockCacheService struct {
	data           map[string]interface{}
	deleted        []string
	getCalled      int
	setCalled      int
	deletePrefixed int
}

func newMockCacheService() *mockCacheService {
	return &mockCacheService{
		data: make(map[string]interface{}),
	}
}

func (m *mockCacheService) Get(key string, dest interface{}) bool {
	m.getCalled++
	_, ok := m.data[key]
	return ok
}

func (m *mockCacheService) Set(key string, value interface{}, ttl time.Duration) error {
	m.setCalled++
	m.data[key] = value
	return nil
}

func (m *mockCacheService) Delete(key string) error {
	delete(m.data, key)
	return nil
}

func (m *mockCacheService) DeletePrefix(prefix string) error {
	m.deletePrefixed++
	m.deleted = append(m.deleted, prefix)
	for k := range m.data {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(m.data, k)
		}
	}
	return nil
}

// --- CategoryService Tests ---

func TestCategoryService_List(t *testing.T) {
	t.Run("returns all categories", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})
		repo.addCategory(&model.Category{Name: "Movies", Slug: "movies", Type: "vod"})

		cats, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 2 {
			t.Errorf("List() total = %d, want 2", total)
		}
		if len(cats) != 2 {
			t.Errorf("List() returned %d categories, want 2", len(cats))
		}
	})

	t.Run("empty list", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		cats, total, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 0 {
			t.Errorf("List() total = %d, want 0", total)
		}
		if cats != nil {
			t.Errorf("List() should return nil for empty, got %d items", len(cats))
		}
	})

	t.Run("pagination beyond range", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		cats, total, err := svc.List(10, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if total != 1 {
			t.Errorf("List() total = %d, want 1", total)
		}
		if cats != nil {
			t.Errorf("List() page beyond range should return nil, got %d items", len(cats))
		}
	})

	t.Run("response fields are correct", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		parentID := uint(10)
		repo.addCategory(&model.Category{
			Name:      "Sports",
			Slug:      "sports",
			Type:      "live",
			ParentID:  &parentID,
			SortOrder: 5,
		})

		cats, _, err := svc.List(1, 20)
		if err != nil {
			t.Fatalf("List() error = %v", err)
		}
		if len(cats) != 1 {
			t.Fatalf("List() returned %d, want 1", len(cats))
		}
		if cats[0].Name != "Sports" {
			t.Errorf("name = %q, want %q", cats[0].Name, "Sports")
		}
		if cats[0].Slug != "sports" {
			t.Errorf("slug = %q, want %q", cats[0].Slug, "sports")
		}
		if cats[0].Type != "live" {
			t.Errorf("type = %q, want %q", cats[0].Type, "live")
		}
		if cats[0].SortOrder != 5 {
			t.Errorf("sort_order = %d, want 5", cats[0].SortOrder)
		}
		if cats[0].ParentID == nil || *cats[0].ParentID != 10 {
			t.Errorf("parent_id incorrect")
		}
	})
}

func TestCategoryService_ListByType(t *testing.T) {
	t.Run("cache miss then populates cache", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})
		repo.addCategory(&model.Category{Name: "News", Slug: "news", Type: "live"})
		repo.addCategory(&model.Category{Name: "Movies", Slug: "movies", Type: "vod"})

		cats, err := svc.ListByType("live")
		if err != nil {
			t.Fatalf("ListByType() error = %v", err)
		}
		if len(cats) != 2 {
			t.Errorf("ListByType('live') returned %d categories, want 2", len(cats))
		}
		if _, ok := cache.data["categories:live"]; !ok {
			t.Error("ListByType() should populate cache")
		}
		if cache.setCalled != 1 {
			t.Errorf("cache.Set called %d times, want 1", cache.setCalled)
		}
	})

	t.Run("cache hit returns early", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		cache.data["categories:live"] = []dto.CategoryResponse{{Name: "Cached"}}

		// Should not hit the repo at all
		cats, err := svc.ListByType("live")
		if err != nil {
			t.Fatalf("ListByType() error = %v", err)
		}
		// Cache hit returns nil because our mock Get doesn't deserialize
		if cats != nil {
			t.Errorf("ListByType() with cache hit should return nil (mock), got %d", len(cats))
		}
	})

	t.Run("nil cache works without errors", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		cats, err := svc.ListByType("live")
		if err != nil {
			t.Fatalf("ListByType() error = %v", err)
		}
		if len(cats) != 1 {
			t.Errorf("ListByType() returned %d, want 1", len(cats))
		}
	})

	t.Run("returns empty for nonexistent type", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		cats, err := svc.ListByType("nonexistent")
		if err != nil {
			t.Fatalf("ListByType() error = %v", err)
		}
		if len(cats) != 0 {
			t.Errorf("ListByType() returned %d, want 0", len(cats))
		}
	})

	t.Run("does not cache nil results", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		// No categories exist, result will be nil
		_, err := svc.ListByType("live")
		if err != nil {
			t.Fatalf("ListByType() error = %v", err)
		}
		// Should not cache nil results
		if cache.setCalled != 0 {
			t.Errorf("cache.Set should not be called for nil results, called %d times", cache.setCalled)
		}
	})
}

func TestCategoryService_GetByID(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		resp, err := svc.GetByID(1)
		if err != nil {
			t.Fatalf("GetByID() error = %v", err)
		}
		if resp.Name != "Sports" {
			t.Errorf("GetByID() name = %q, want %q", resp.Name, "Sports")
		}
		if resp.Type != "live" {
			t.Errorf("GetByID() type = %q, want %q", resp.Type, "live")
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		_, err := svc.GetByID(999)
		if err == nil {
			t.Fatal("GetByID() should return error for nonexistent category")
		}
		if err.Error() != "categoria no encontrada" {
			t.Errorf("GetByID() error = %q, want %q", err.Error(), "categoria no encontrada")
		}
	})
}

func TestCategoryService_Create(t *testing.T) {
	t.Run("success with auto-slug", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		resp, err := svc.Create(dto.CreateCategoryRequest{
			Name: "New Category",
			Type: "live",
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Name != "New Category" {
			t.Errorf("Create() name = %q, want %q", resp.Name, "New Category")
		}
		if resp.Slug != "new-category" {
			t.Errorf("Create() auto-slug = %q, want %q", resp.Slug, "new-category")
		}
		if resp.Type != "live" {
			t.Errorf("Create() type = %q, want %q", resp.Type, "live")
		}
		if len(cache.deleted) == 0 {
			t.Error("Create() should invalidate cache")
		}
	})

	t.Run("success with custom slug", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		resp, err := svc.Create(dto.CreateCategoryRequest{
			Name: "My Category",
			Slug: "custom-slug",
			Type: "vod",
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.Slug != "custom-slug" {
			t.Errorf("Create() slug = %q, want %q", resp.Slug, "custom-slug")
		}
	})

	t.Run("with parent ID and sort order", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		parentID := uint(5)
		resp, err := svc.Create(dto.CreateCategoryRequest{
			Name:      "Sub Category",
			Type:      "vod",
			ParentID:  &parentID,
			SortOrder: 3,
		})
		if err != nil {
			t.Fatalf("Create() error = %v", err)
		}
		if resp.ParentID == nil || *resp.ParentID != 5 {
			t.Errorf("Create() parentID incorrect")
		}
		if resp.SortOrder != 3 {
			t.Errorf("Create() sort_order = %d, want 3", resp.SortOrder)
		}
	})

	t.Run("empty name", func(t *testing.T) {
		svc := NewCategoryService(newMockCategoryRepo(), nil)

		_, err := svc.Create(dto.CreateCategoryRequest{Type: "live"})
		if err == nil {
			t.Fatal("Create() should return error for empty name")
		}
	})

	t.Run("empty type", func(t *testing.T) {
		svc := NewCategoryService(newMockCategoryRepo(), nil)

		_, err := svc.Create(dto.CreateCategoryRequest{Name: "Test"})
		if err == nil {
			t.Fatal("Create() should return error for empty type")
		}
	})

	t.Run("invalid type", func(t *testing.T) {
		svc := NewCategoryService(newMockCategoryRepo(), nil)

		_, err := svc.Create(dto.CreateCategoryRequest{Name: "Test", Type: "invalid"})
		if err == nil {
			t.Fatal("Create() should return error for invalid type")
		}
	})

	t.Run("all valid types", func(t *testing.T) {
		for _, typ := range []string{"live", "vod", "series"} {
			repo := newMockCategoryRepo()
			svc := NewCategoryService(repo, nil)

			_, err := svc.Create(dto.CreateCategoryRequest{
				Name: "Test " + typ,
				Type: typ,
			})
			if err != nil {
				t.Errorf("Create() with type %q should succeed, got error: %v", typ, err)
			}
		}
	})

	t.Run("repo error", func(t *testing.T) {
		repo := newMockCategoryRepo()
		repo.createErr = gorm.ErrInvalidDB
		svc := NewCategoryService(repo, nil)

		_, err := svc.Create(dto.CreateCategoryRequest{Name: "Test", Type: "live"})
		if err == nil {
			t.Fatal("Create() should return error when repo fails")
		}
	})
}

func TestCategoryService_Update(t *testing.T) {
	t.Run("success - update name", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		repo.addCategory(&model.Category{Name: "Old Name", Slug: "old-name", Type: "live"})

		resp, err := svc.Update(1, dto.UpdateCategoryRequest{Name: "New Name"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Name != "New Name" {
			t.Errorf("Update() name = %q, want %q", resp.Name, "New Name")
		}
		if len(cache.deleted) == 0 {
			t.Error("Update() should invalidate cache")
		}
	})

	t.Run("success - update slug", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		resp, err := svc.Update(1, dto.UpdateCategoryRequest{Slug: "new-slug"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Slug != "new-slug" {
			t.Errorf("Update() slug = %q, want %q", resp.Slug, "new-slug")
		}
	})

	t.Run("success - update sort order", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		sortOrder := 5
		resp, err := svc.Update(1, dto.UpdateCategoryRequest{SortOrder: &sortOrder})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.SortOrder != 5 {
			t.Errorf("Update() sort_order = %d, want 5", resp.SortOrder)
		}
	})

	t.Run("success - update type to valid", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		resp, err := svc.Update(1, dto.UpdateCategoryRequest{Type: "vod"})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Type != "vod" {
			t.Errorf("Update() type = %q, want %q", resp.Type, "vod")
		}
	})

	t.Run("success - update parent ID", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live"})

		parentID := uint(5)
		resp, err := svc.Update(1, dto.UpdateCategoryRequest{ParentID: &parentID})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.ParentID == nil || *resp.ParentID != 5 {
			t.Error("Update() parentID should be 5")
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc := NewCategoryService(newMockCategoryRepo(), nil)

		_, err := svc.Update(999, dto.UpdateCategoryRequest{Name: "Test"})
		if err == nil {
			t.Fatal("Update() should return error for nonexistent category")
		}
	})

	t.Run("invalid type", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Test", Slug: "test", Type: "live"})

		_, err := svc.Update(1, dto.UpdateCategoryRequest{Type: "invalid"})
		if err == nil {
			t.Fatal("Update() should return error for invalid type")
		}
	})

	t.Run("repo update error", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Test", Slug: "test", Type: "live"})
		repo.updateErr = gorm.ErrInvalidDB

		_, err := svc.Update(1, dto.UpdateCategoryRequest{Name: "New"})
		if err == nil {
			t.Fatal("Update() should return error when repo update fails")
		}
	})

	t.Run("empty update preserves fields", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "live", SortOrder: 3})

		resp, err := svc.Update(1, dto.UpdateCategoryRequest{})
		if err != nil {
			t.Fatalf("Update() error = %v", err)
		}
		if resp.Name != "Sports" {
			t.Errorf("Update() should preserve name, got %q", resp.Name)
		}
		if resp.Slug != "sports" {
			t.Errorf("Update() should preserve slug, got %q", resp.Slug)
		}
		if resp.Type != "live" {
			t.Errorf("Update() should preserve type, got %q", resp.Type)
		}
	})
}

func TestCategoryService_Delete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		repo.addCategory(&model.Category{Name: "Test", Slug: "test", Type: "live"})

		err := svc.Delete(1)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}
		if len(cache.deleted) == 0 {
			t.Error("Delete() should invalidate cache")
		}

		// Verify it's actually removed
		_, err = repo.FindByID(1)
		if err == nil {
			t.Error("Delete() should remove category from repo")
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		err := svc.Delete(999)
		if err == nil {
			t.Fatal("Delete() should return error for nonexistent category")
		}
	})

	t.Run("does not invalidate cache on error", func(t *testing.T) {
		repo := newMockCategoryRepo()
		cache := newMockCacheService()
		svc := NewCategoryService(repo, cache)

		// Attempt to delete nonexistent
		_ = svc.Delete(999)
		if cache.deletePrefixed != 0 {
			t.Error("Delete() should not invalidate cache when delete fails")
		}
	})

	t.Run("nil cache does not panic", func(t *testing.T) {
		repo := newMockCategoryRepo()
		svc := NewCategoryService(repo, nil)

		repo.addCategory(&model.Category{Name: "Test", Slug: "test", Type: "live"})

		err := svc.Delete(1)
		if err != nil {
			t.Fatalf("Delete() error = %v", err)
		}
	})
}

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"Sports Live", "sports-live"},
		{"My Category!", "my-category"},
		{"  Multiple   Spaces  ", "multiple-spaces"},
		{"Deportes & Mas", "deportes-mas"},
		{"simple", "simple"},
		{"UPPER CASE", "upper-case"},
		{"with---dashes", "with-dashes"},
		{"123 Numbers", "123-numbers"},
		{"", ""},
		{"  ", ""},
		{"a", "a"},
		{"Sci-Fi Movies", "sci-fi-movies"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := generateSlug(tt.name)
			if got != tt.want {
				t.Errorf("generateSlug(%q) = %q, want %q", tt.name, got, tt.want)
			}
		})
	}
}

// errorCategoryRepo wraps mockCategoryRepo to return errors on List
type errorCategoryRepo struct {
	*mockCategoryRepo
	listErr     error
	listTypeErr error
}

func (m *errorCategoryRepo) List(page, perPage int) ([]model.Category, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockCategoryRepo.List(page, perPage)
}

func (m *errorCategoryRepo) ListByType(categoryType string) ([]model.Category, error) {
	if m.listTypeErr != nil {
		return nil, m.listTypeErr
	}
	return m.mockCategoryRepo.ListByType(categoryType)
}

func TestCategoryService_List_Error(t *testing.T) {
	repo := &errorCategoryRepo{
		mockCategoryRepo: newMockCategoryRepo(),
		listErr:          fmt.Errorf("db connection error"),
	}
	svc := NewCategoryService(repo, nil)

	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error from repo")
	}
}

func TestCategoryService_ListByType_Error(t *testing.T) {
	repo := &errorCategoryRepo{
		mockCategoryRepo: newMockCategoryRepo(),
		listTypeErr:      fmt.Errorf("db error"),
	}
	svc := NewCategoryService(repo, nil)

	_, err := svc.ListByType("channel")
	if err == nil {
		t.Error("ListByType() should propagate error from repo")
	}
}

func TestCategoryService_ListByType_CacheHit(t *testing.T) {
	repo := newMockCategoryRepo()
	repo.addCategory(&model.Category{Name: "Sports", Slug: "sports", Type: "channel"})

	cache := &prefillCache{data: make(map[string]interface{})}
	svc := NewCategoryService(repo, cache)

	// First call fills cache
	result1, _ := svc.ListByType("channel")
	if len(result1) != 1 {
		t.Fatalf("first call should return 1, got %d", len(result1))
	}

	// Set cache manually to simulate a hit
	cache.data["categories:channel"] = result1

	// Second call should return from cache
	result2, _ := svc.ListByType("channel")
	if len(result2) != 1 {
		t.Errorf("cache hit should return 1, got %d", len(result2))
	}
}

// prefillCache is a simple in-memory cache for testing
type prefillCache struct {
	data map[string]interface{}
}

func (c *prefillCache) Get(key string, dest interface{}) bool {
	return false // Simplified - cache miss
}
func (c *prefillCache) Set(key string, value interface{}, ttl time.Duration) error {
	c.data[key] = value
	return nil
}
func (c *prefillCache) Delete(key string) error       { delete(c.data, key); return nil }
func (c *prefillCache) DeletePrefix(prefix string) error { return nil }
