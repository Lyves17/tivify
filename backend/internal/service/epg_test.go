package service

import (
	"testing"
	"time"

	"github.com/tivify/backend/internal/dto"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

// --- Mock EPG Repository ---

type mockEPGRepo struct {
	entries map[uint]*model.EPGEntry
	nextID  uint
}

func newMockEPGRepo() *mockEPGRepo {
	return &mockEPGRepo{entries: make(map[uint]*model.EPGEntry), nextID: 1}
}

func (m *mockEPGRepo) FindByID(id uint) (*model.EPGEntry, error) {
	e, ok := m.entries[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return e, nil
}

func (m *mockEPGRepo) List(page, perPage int) ([]model.EPGEntry, int64, error) {
	var result []model.EPGEntry
	for _, e := range m.entries {
		result = append(result, *e)
	}
	total := int64(len(result))
	start := (page - 1) * perPage
	if start >= len(result) {
		return nil, total, nil
	}
	end := start + perPage
	if end > len(result) {
		end = len(result)
	}
	return result[start:end], total, nil
}

func (m *mockEPGRepo) ListByChannel(channelID uint, date time.Time) ([]model.EPGEntry, error) {
	var result []model.EPGEntry
	for _, e := range m.entries {
		if e.ChannelID == channelID {
			result = append(result, *e)
		}
	}
	return result, nil
}

func (m *mockEPGRepo) Create(entry *model.EPGEntry) error {
	entry.ID = m.nextID
	m.nextID++
	m.entries[entry.ID] = entry
	return nil
}

func (m *mockEPGRepo) Update(entry *model.EPGEntry) error {
	m.entries[entry.ID] = entry
	return nil
}

func (m *mockEPGRepo) Delete(id uint) error {
	delete(m.entries, id)
	return nil
}

func (m *mockEPGRepo) Count() (int64, error) {
	return int64(len(m.entries)), nil
}

// --- Mock Channel Repository for EPG ---

type mockChannelRepoForEPG struct {
	channels map[uint]*model.Channel
}

func newMockChannelRepoForEPG() *mockChannelRepoForEPG {
	return &mockChannelRepoForEPG{channels: make(map[uint]*model.Channel)}
}

func (m *mockChannelRepoForEPG) FindByID(id uint) (*model.Channel, error) {
	c, ok := m.channels[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return c, nil
}

func (m *mockChannelRepoForEPG) FindBySlug(slug string) (*model.Channel, error) {
	return nil, gorm.ErrRecordNotFound
}
func (m *mockChannelRepoForEPG) List(page, perPage int) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForEPG) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error) {
	return nil, 0, nil
}
func (m *mockChannelRepoForEPG) Create(channel *model.Channel) error  { return nil }
func (m *mockChannelRepoForEPG) Update(channel *model.Channel) error  { return nil }
func (m *mockChannelRepoForEPG) Delete(id uint) error                 { return nil }
func (m *mockChannelRepoForEPG) Count() (int64, error)                { return 0, nil }
func (m *mockChannelRepoForEPG) CountActive() (int64, error)          { return 0, nil }
func (m *mockChannelRepoForEPG) CountBySource(source string) (int64, error) { return 0, nil }
func (m *mockChannelRepoForEPG) DeleteBySource(source string) error   { return nil }

// --- Tests ---

func setupEPGService() (*EPGService, *mockEPGRepo, *mockChannelRepoForEPG) {
	epgRepo := newMockEPGRepo()
	channelRepo := newMockChannelRepoForEPG()
	channelRepo.channels[1] = &model.Channel{ID: 1, Name: "Test Channel"}
	svc := NewEPGService(epgRepo, channelRepo)
	return svc, epgRepo, channelRepo
}

func TestEPGService_List(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	now := time.Now()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News", StartTime: now, EndTime: now.Add(time.Hour)}
	epgRepo.entries[2] = &model.EPGEntry{ID: 2, ChannelID: 1, Title: "Sports", StartTime: now.Add(time.Hour), EndTime: now.Add(2 * time.Hour)}

	result, total, err := svc.List(1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(result) != 2 {
		t.Errorf("len(result) = %d, want 2", len(result))
	}
}

func TestEPGService_ListByChannel(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	now := time.Now()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News", StartTime: now}
	epgRepo.entries[2] = &model.EPGEntry{ID: 2, ChannelID: 2, Title: "Other", StartTime: now}

	result, err := svc.ListByChannel(1, "2025-01-15")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Errorf("len(result) = %d, want 1", len(result))
	}
}

func TestEPGService_ListByChannel_InvalidDate(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	now := time.Now()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News", StartTime: now}

	// Invalid date should fallback to today
	result, err := svc.ListByChannel(1, "not-a-date")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Errorf("len(result) = %d, want 1", len(result))
	}
}

func TestEPGService_GetByID(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News"}

	result, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title != "News" {
		t.Errorf("title = %q, want %q", result.Title, "News")
	}
}

func TestEPGService_GetByID_NotFound(t *testing.T) {
	svc, _, _ := setupEPGService()

	_, err := svc.GetByID(999)
	if err == nil {
		t.Error("expected error for missing entry")
	}
}

func TestEPGService_Create(t *testing.T) {
	svc, _, _ := setupEPGService()
	now := time.Now()

	req := dto.CreateEPGRequest{
		ChannelID: 1,
		Title:     "New Program",
		StartTime: now,
		EndTime:   now.Add(time.Hour),
	}

	result, err := svc.Create(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title != "New Program" {
		t.Errorf("title = %q, want %q", result.Title, "New Program")
	}
	if result.ChannelID != 1 {
		t.Errorf("channelID = %d, want 1", result.ChannelID)
	}
}

func TestEPGService_Create_MissingTitle(t *testing.T) {
	svc, _, _ := setupEPGService()

	req := dto.CreateEPGRequest{ChannelID: 1}
	_, err := svc.Create(req)
	if err == nil {
		t.Error("expected error for missing title")
	}
}

func TestEPGService_Create_MissingChannel(t *testing.T) {
	svc, _, _ := setupEPGService()

	req := dto.CreateEPGRequest{Title: "Test"}
	_, err := svc.Create(req)
	if err == nil {
		t.Error("expected error for missing channel")
	}
}

func TestEPGService_Create_InvalidChannel(t *testing.T) {
	svc, _, _ := setupEPGService()

	req := dto.CreateEPGRequest{ChannelID: 999, Title: "Test"}
	_, err := svc.Create(req)
	if err == nil {
		t.Error("expected error for invalid channel")
	}
}

func TestEPGService_Update(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "Old Title"}

	req := dto.UpdateEPGRequest{Title: "New Title", Category: "Sports"}
	result, err := svc.Update(1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title != "New Title" {
		t.Errorf("title = %q, want %q", result.Title, "New Title")
	}
}

func TestEPGService_Update_NotFound(t *testing.T) {
	svc, _, _ := setupEPGService()

	req := dto.UpdateEPGRequest{Title: "New Title"}
	_, err := svc.Update(999, req)
	if err == nil {
		t.Error("expected error for missing entry")
	}
}

func TestEPGService_Delete(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News"}

	err := svc.Delete(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, exists := epgRepo.entries[1]; exists {
		t.Error("entry should have been deleted")
	}
}

func TestEPGService_ListByChannel_EmptyDate(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	now := time.Now()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "News", StartTime: now}

	// Empty date string should use today
	result, err := svc.ListByChannel(1, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Errorf("len(result) = %d, want 1", len(result))
	}
}

func TestEPGService_List_EmptyRepo(t *testing.T) {
	svc, _, _ := setupEPGService()

	result, total, err := svc.List(1, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("total = %d, want 0", total)
	}
	if result != nil {
		t.Errorf("expected nil result for empty repo")
	}
}

func TestEPGService_Update_WithChannelID(t *testing.T) {
	svc, epgRepo, _ := setupEPGService()
	epgRepo.entries[1] = &model.EPGEntry{ID: 1, ChannelID: 1, Title: "Title"}

	newChannelID := uint(1)
	now := time.Now()
	endTime := now.Add(time.Hour)
	req := dto.UpdateEPGRequest{
		ChannelID: &newChannelID,
		Title:     "Updated",
		Description: "Desc",
		StartTime: &now,
		EndTime:   &endTime,
		Category:  "Sports",
		Language:  "es",
		EpisodeNum: "S01E01",
	}
	result, err := svc.Update(1, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Title != "Updated" {
		t.Errorf("title = %q, want %q", result.Title, "Updated")
	}
	if result.Category != "Sports" {
		t.Errorf("category = %q, want %q", result.Category, "Sports")
	}
	if result.Language != "es" {
		t.Errorf("language = %q, want %q", result.Language, "es")
	}
}

func TestToEPGResponse_WithChannel(t *testing.T) {
	now := time.Now()
	entry := model.EPGEntry{
		ID:          1,
		ChannelID:   1,
		Title:       "News",
		Description: "Daily news",
		StartTime:   now,
		EndTime:     now.Add(time.Hour),
		Category:    "News",
		Language:    "en",
		EpisodeNum:  "E01",
		Channel:     &model.Channel{Name: "CNN"},
	}

	resp := toEPGResponse(entry)
	if resp.ChannelName != "CNN" {
		t.Errorf("ChannelName = %q, want %q", resp.ChannelName, "CNN")
	}
	if resp.Description != "Daily news" {
		t.Errorf("Description = %q, want %q", resp.Description, "Daily news")
	}
	if resp.EpisodeNum != "E01" {
		t.Errorf("EpisodeNum = %q, want %q", resp.EpisodeNum, "E01")
	}
}

func TestToEPGResponse_WithoutChannel(t *testing.T) {
	entry := model.EPGEntry{
		ID:      1,
		Title:   "News",
		Channel: nil,
	}

	resp := toEPGResponse(entry)
	if resp.ChannelName != "" {
		t.Errorf("ChannelName = %q, want empty", resp.ChannelName)
	}
}

func TestNewEPGService(t *testing.T) {
	epgRepo := newMockEPGRepo()
	channelRepo := newMockChannelRepoForEPG()
	svc := NewEPGService(epgRepo, channelRepo)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
}
