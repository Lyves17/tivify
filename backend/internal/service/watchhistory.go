package service

import (
	"errors"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
)

type WatchHistoryService struct {
	repo        WatchHistoryRepositoryInterface
	channelRepo ChannelRepositoryInterface
	vodRepo     VODRepositoryInterface
}

func NewWatchHistoryService(
	repo WatchHistoryRepositoryInterface,
	channelRepo ChannelRepositoryInterface,
	vodRepo VODRepositoryInterface,
) *WatchHistoryService {
	return &WatchHistoryService{
		repo:        repo,
		channelRepo: channelRepo,
		vodRepo:     vodRepo,
	}
}

type HistoryItem struct {
	ID            uint   `json:"id"`
	ContentType   string `json:"content_type"`
	ContentID     uint   `json:"content_id"`
	Progress      int    `json:"progress"`
	Duration      int    `json:"duration"`
	WatchedAt     string `json:"watched_at"`
	ContentName   string `json:"content_name"`
	ContentPoster string `json:"content_poster"`
	ContentSlug   string `json:"content_slug"`
}

func (s *WatchHistoryService) enrichItem(item *HistoryItem) {
	switch item.ContentType {
	case "channel":
		if ch, err := s.channelRepo.FindByID(item.ContentID); err == nil {
			item.ContentName = ch.Name
			item.ContentPoster = ch.LogoURL
			item.ContentSlug = ch.Slug
		} else {
			item.ContentName = "(eliminado)"
		}
	case "vod":
		if v, err := s.vodRepo.FindByID(item.ContentID); err == nil {
			item.ContentName = v.Title
			item.ContentPoster = v.PosterURL
			item.ContentSlug = v.Slug
		} else {
			item.ContentName = "(eliminado)"
		}
	}
}

func (s *WatchHistoryService) ListByUser(userID uuid.UUID, page, perPage int) ([]HistoryItem, int64, error) {
	history, total, err := s.repo.ListByUser(userID, page, perPage)
	if err != nil {
		return nil, 0, err
	}
	var result []HistoryItem
	for _, h := range history {
		item := HistoryItem{
			ID:          h.ID,
			ContentType: h.ContentType,
			ContentID:   h.ContentID,
			Progress:    h.Progress,
			Duration:    h.Duration,
			WatchedAt:   h.WatchedAt.Format("2006-01-02T15:04:05Z"),
		}
		s.enrichItem(&item)
		result = append(result, item)
	}
	return result, total, nil
}

func (s *WatchHistoryService) ContinueWatching(userID uuid.UUID, limit int) ([]HistoryItem, error) {
	history, err := s.repo.ListContinueWatching(userID, limit)
	if err != nil {
		return nil, err
	}
	var result []HistoryItem
	for _, h := range history {
		item := HistoryItem{
			ID:          h.ID,
			ContentType: h.ContentType,
			ContentID:   h.ContentID,
			Progress:    h.Progress,
			Duration:    h.Duration,
			WatchedAt:   h.WatchedAt.Format("2006-01-02T15:04:05Z"),
		}
		s.enrichItem(&item)
		result = append(result, item)
	}
	return result, nil
}

func (s *WatchHistoryService) Record(userID uuid.UUID, contentType string, contentID uint, progress, duration int) error {
	if contentType != "channel" && contentType != "vod" {
		return errors.New("content_type debe ser 'channel' o 'vod'")
	}
	if contentID == 0 {
		return errors.New("content_id invalido")
	}
	entry := &model.WatchHistory{
		UserID:      userID,
		ContentType: contentType,
		ContentID:   contentID,
		Progress:    progress,
		Duration:    duration,
	}
	return s.repo.Upsert(entry)
}

func (s *WatchHistoryService) Delete(id uint, userID uuid.UUID) error {
	return s.repo.Delete(id, userID)
}
