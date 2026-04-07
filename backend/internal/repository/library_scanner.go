package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type LibraryScannerRepository struct {
	db *gorm.DB
}

func NewLibraryScannerRepository(db *gorm.DB) *LibraryScannerRepository {
	return &LibraryScannerRepository{db: db}
}

func (r *LibraryScannerRepository) Create(item *model.LibraryScanItem) error {
	return r.db.Create(item).Error
}

func (r *LibraryScannerRepository) CreateBatch(items []model.LibraryScanItem) error {
	if len(items) == 0 {
		return nil
	}
	return r.db.CreateInBatches(items, 50).Error
}

func (r *LibraryScannerRepository) FindByID(id uint) (*model.LibraryScanItem, error) {
	var item model.LibraryScanItem
	err := r.db.First(&item, id).Error
	return &item, err
}

func (r *LibraryScannerRepository) FindBySessionID(sessionID string, page, perPage int) ([]model.LibraryScanItem, int64, error) {
	var items []model.LibraryScanItem
	var total int64

	r.db.Model(&model.LibraryScanItem{}).Where("scan_session_id = ?", sessionID).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Where("scan_session_id = ?", sessionID).
		Order("media_type ASC, parsed_title ASC, season_number ASC, episode_number ASC").
		Offset(offset).Limit(perPage).
		Find(&items).Error
	return items, total, err
}

func (r *LibraryScannerRepository) FindPendingBySessionID(sessionID string) ([]model.LibraryScanItem, error) {
	var items []model.LibraryScanItem
	err := r.db.Where("scan_session_id = ? AND import_status = ?", sessionID, "pending").
		Order("parsed_title ASC, season_number ASC, episode_number ASC").
		Find(&items).Error
	return items, err
}

func (r *LibraryScannerRepository) FindByIDs(ids []uint) ([]model.LibraryScanItem, error) {
	var items []model.LibraryScanItem
	err := r.db.Where("id IN ?", ids).Find(&items).Error
	return items, err
}

func (r *LibraryScannerRepository) Update(item *model.LibraryScanItem) error {
	return r.db.Save(item).Error
}

func (r *LibraryScannerRepository) UpdateImportStatus(id uint, status string, vodID *uint, seriesID *uint, errMsg string) error {
	updates := map[string]interface{}{
		"import_status": status,
	}
	if vodID != nil {
		updates["imported_vod_id"] = *vodID
	}
	if seriesID != nil {
		updates["imported_series_id"] = *seriesID
	}
	if errMsg != "" {
		updates["error_message"] = errMsg
	}
	return r.db.Model(&model.LibraryScanItem{}).Where("id = ?", id).Updates(updates).Error
}

func (r *LibraryScannerRepository) DeleteBySessionID(sessionID string) error {
	return r.db.Where("scan_session_id = ?", sessionID).Delete(&model.LibraryScanItem{}).Error
}

func (r *LibraryScannerRepository) ExistsFilePath(filePath string) (bool, error) {
	var count int64
	err := r.db.Model(&model.LibraryScanItem{}).Where("file_path = ? AND import_status = ?", filePath, "imported").Count(&count).Error
	return count > 0, err
}

func (r *LibraryScannerRepository) CountBySessionID(sessionID string) (int64, error) {
	var count int64
	err := r.db.Model(&model.LibraryScanItem{}).Where("scan_session_id = ?", sessionID).Count(&count).Error
	return count, err
}
