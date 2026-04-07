package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

// --- Error-returning wrapper repos for List operations ---

// errorChannelRepo wraps mockChannelRepo to return errors
type errorChannelRepo struct {
	*mockChannelRepo
	listErr       error
	listActiveErr error
}

func (m *errorChannelRepo) List(page, perPage int) ([]model.Channel, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockChannelRepo.List(page, perPage)
}

func (m *errorChannelRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Channel, int64, error) {
	if m.listActiveErr != nil {
		return nil, 0, m.listActiveErr
	}
	return m.mockChannelRepo.ListActive(page, perPage, search, categoryID)
}

// errorVODRepo wraps mockVODRepo to return errors
type errorVODRepo struct {
	*mockVODRepo
	listErr       error
	listActiveErr error
}

func (m *errorVODRepo) List(page, perPage int) ([]model.VOD, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockVODRepo.List(page, perPage)
}

func (m *errorVODRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.VOD, int64, error) {
	if m.listActiveErr != nil {
		return nil, 0, m.listActiveErr
	}
	return m.mockVODRepo.ListActive(page, perPage, search, categoryID)
}

// errorSeriesRepo wraps mockSeriesRepo to return errors
type errorSeriesRepo struct {
	*mockSeriesRepo
	listErr       error
	listActiveErr error
}

func (m *errorSeriesRepo) List(page, perPage int) ([]model.Series, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockSeriesRepo.List(page, perPage)
}

func (m *errorSeriesRepo) ListActive(page, perPage int, search string, categoryID *uint) ([]model.Series, int64, error) {
	if m.listActiveErr != nil {
		return nil, 0, m.listActiveErr
	}
	return m.mockSeriesRepo.ListActive(page, perPage, search, categoryID)
}

// errorEPGRepo wraps mockEPGRepo to return errors
type errorEPGRepo struct {
	*mockEPGRepo
	listErr error
}

func (m *errorEPGRepo) List(page, perPage int) ([]model.EPGEntry, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockEPGRepo.List(page, perPage)
}

// errorWatchHistoryRepo wraps to return errors
type errorWatchHistoryRepo struct {
	*mockWatchHistoryRepo
	listErr     error
	continueErr error
}

func (m *errorWatchHistoryRepo) ListByUser(userID uuid.UUID, page, perPage int) ([]model.WatchHistory, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockWatchHistoryRepo.ListByUser(userID, page, perPage)
}

func (m *errorWatchHistoryRepo) ListContinueWatching(userID uuid.UUID, limit int) ([]model.WatchHistory, error) {
	if m.continueErr != nil {
		return nil, m.continueErr
	}
	return m.mockWatchHistoryRepo.ListContinueWatching(userID, limit)
}

// errorLocalMediaRepo wraps to return errors
type errorLocalMediaRepo struct {
	*mockLocalMediaRepo
	listErr error
}

func (m *errorLocalMediaRepo) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockLocalMediaRepo.List(page, perPage)
}

// errorFavoriteRepo wraps to return errors
type errorFavoriteRepo struct {
	*mockFavoriteRepo
	listErr error
}

func (m *errorFavoriteRepo) ListByUser(userID uuid.UUID, page, perPage int) ([]model.Favorite, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockFavoriteRepo.ListByUser(userID, page, perPage)
}

// errorUserRepo wraps to return errors
type errorFullUserRepo struct {
	*mockFullUserRepo
	listErr error
}

func (m *errorFullUserRepo) List(page, perPage int) ([]model.User, int64, error) {
	if m.listErr != nil {
		return nil, 0, m.listErr
	}
	return m.mockFullUserRepo.List(page, perPage)
}

// --- Tests ---

func TestChannelService_List_Error(t *testing.T) {
	repo := &errorChannelRepo{mockChannelRepo: newMockChannelRepo(), listErr: fmt.Errorf("db error")}
	svc := NewChannelService(repo, newMockStreamRepo(), nil)
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

func TestChannelService_ListActive_Error(t *testing.T) {
	repo := &errorChannelRepo{mockChannelRepo: newMockChannelRepo(), listActiveErr: fmt.Errorf("db error")}
	svc := NewChannelService(repo, newMockStreamRepo(), nil)
	_, _, err := svc.ListActive(1, 10, "", nil)
	if err == nil {
		t.Error("ListActive() should propagate error")
	}
}

func TestVODService_List_Error(t *testing.T) {
	repo := &errorVODRepo{mockVODRepo: newMockVODRepo(), listErr: fmt.Errorf("db error")}
	svc := NewVODService(repo, nil)
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

func TestVODService_ListActive_Error(t *testing.T) {
	repo := &errorVODRepo{mockVODRepo: newMockVODRepo(), listActiveErr: fmt.Errorf("db error")}
	svc := NewVODService(repo, nil)
	_, _, err := svc.ListActive(1, 10, "", nil)
	if err == nil {
		t.Error("ListActive() should propagate error")
	}
}

func TestSeriesService_List_Error(t *testing.T) {
	repo := &errorSeriesRepo{mockSeriesRepo: newMockSeriesRepo(), listErr: fmt.Errorf("db error")}
	svc := NewSeriesService(repo, newMockVODRepo(), nil)
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

func TestSeriesService_ListActive_Error(t *testing.T) {
	repo := &errorSeriesRepo{mockSeriesRepo: newMockSeriesRepo(), listActiveErr: fmt.Errorf("db error")}
	svc := NewSeriesService(repo, newMockVODRepo(), nil)
	_, _, err := svc.ListActive(1, 10, "", nil)
	if err == nil {
		t.Error("ListActive() should propagate error")
	}
}

func TestEPGService_List_Error(t *testing.T) {
	repo := &errorEPGRepo{mockEPGRepo: newMockEPGRepo(), listErr: fmt.Errorf("db error")}
	svc := NewEPGService(repo, newMockChannelRepo())
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

func TestWatchHistoryService_ListByUser_Error(t *testing.T) {
	repo := &errorWatchHistoryRepo{mockWatchHistoryRepo: newMockWatchHistoryRepo(), listErr: fmt.Errorf("db error")}
	svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())
	_, _, err := svc.ListByUser(uuid.New(), 1, 10)
	if err == nil {
		t.Error("ListByUser() should propagate error")
	}
}

func TestWatchHistoryService_ContinueWatching_Error(t *testing.T) {
	repo := &errorWatchHistoryRepo{mockWatchHistoryRepo: newMockWatchHistoryRepo(), continueErr: fmt.Errorf("db error")}
	svc := NewWatchHistoryService(repo, newMockChannelRepo(), newMockVODRepo())
	_, err := svc.ContinueWatching(uuid.New(), 10)
	if err == nil {
		t.Error("ContinueWatching() should propagate error")
	}
}

func TestFavoriteService_ListByUser_Error(t *testing.T) {
	favRepo := &errorFavoriteRepo{mockFavoriteRepo: newMockFavoriteRepo(), listErr: fmt.Errorf("db error")}
	svc := NewFavoriteService(favRepo, newMockChannelRepo(), newMockVODRepo(), newMockSeriesRepo())
	_, _, err := svc.ListByUser(uuid.New(), 1, 10)
	if err == nil {
		t.Error("ListByUser() should propagate error")
	}
}

func TestUserService_List_Error(t *testing.T) {
	repo := &errorFullUserRepo{mockFullUserRepo: newMockFullUserRepo(), listErr: fmt.Errorf("db error")}
	svc := NewUserService(repo)
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

func TestLocalMediaService_List_Error(t *testing.T) {
	repo := &errorLocalMediaRepo{mockLocalMediaRepo: newMockLocalMediaRepo(), listErr: fmt.Errorf("db error")}
	svc := NewLocalMediaService(repo, nil, nil, "/tmp")
	_, _, err := svc.List(1, 10)
	if err == nil {
		t.Error("List() should propagate error")
	}
}

// Test EPG ListByChannel error branch
func TestEPGService_ListByChannel_NoDate(t *testing.T) {
	repo := newMockEPGRepo()
	svc := NewEPGService(repo, newMockChannelRepo())

	// ListByChannel with a channel that has no programs
	result, err := svc.ListByChannel(999, "")
	if err != nil {
		t.Fatalf("ListByChannel() error = %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 results, got %d", len(result))
	}
}

func TestEPGService_ListByChannel_WithDate(t *testing.T) {
	repo := newMockEPGRepo()
	svc := NewEPGService(repo, newMockChannelRepo())

	result, err := svc.ListByChannel(1, time.Now().Format("2006-01-02"))
	if err != nil {
		t.Fatalf("ListByChannel() error = %v", err)
	}
	_ = result
}
