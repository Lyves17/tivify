package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type WatchHistoryRepository struct {
	db *gorm.DB
}

func NewWatchHistoryRepository(db *gorm.DB) *WatchHistoryRepository {
	return &WatchHistoryRepository{db: db}
}

func (r *WatchHistoryRepository) ListByUser(userID uuid.UUID, page, perPage int) ([]model.WatchHistory, int64, error) {
	var history []model.WatchHistory
	var total int64

	r.db.Model(&model.WatchHistory{}).Where("user_id = ?", userID).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Where("user_id = ?", userID).
		Offset(offset).Limit(perPage).
		Order("watched_at DESC").
		Find(&history).Error
	return history, total, err
}

func (r *WatchHistoryRepository) Upsert(entry *model.WatchHistory) error {
	var existing model.WatchHistory
	err := r.db.Where("user_id = ? AND content_type = ? AND content_id = ?",
		entry.UserID, entry.ContentType, entry.ContentID).First(&existing).Error

	if err == nil {
		existing.Progress = entry.Progress
		existing.Duration = entry.Duration
		existing.WatchedAt = time.Now()
		return r.db.Save(&existing).Error
	}

	entry.WatchedAt = time.Now()
	return r.db.Create(entry).Error
}

func (r *WatchHistoryRepository) ListContinueWatching(userID uuid.UUID, limit int) ([]model.WatchHistory, error) {
	var history []model.WatchHistory
	err := r.db.Where("user_id = ? AND content_type = ? AND progress > 0 AND duration > 0 AND progress < duration",
		userID, "vod").
		Order("watched_at DESC").
		Limit(limit).
		Find(&history).Error
	return history, err
}

func (r *WatchHistoryRepository) Delete(id uint, userID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.WatchHistory{}).Error
}
