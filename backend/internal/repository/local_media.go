package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type LocalMediaRepository struct {
	db *gorm.DB
}

func NewLocalMediaRepository(db *gorm.DB) *LocalMediaRepository {
	return &LocalMediaRepository{db: db}
}

func (r *LocalMediaRepository) Create(media *model.LocalMedia) error {
	return r.db.Create(media).Error
}

func (r *LocalMediaRepository) FindByID(id uint) (*model.LocalMedia, error) {
	var media model.LocalMedia
	err := r.db.First(&media, id).Error
	return &media, err
}

func (r *LocalMediaRepository) List(page, perPage int) ([]model.LocalMedia, int64, error) {
	var media []model.LocalMedia
	var total int64

	r.db.Model(&model.LocalMedia{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&media).Error
	return media, total, err
}

func (r *LocalMediaRepository) Update(media *model.LocalMedia) error {
	return r.db.Save(media).Error
}

func (r *LocalMediaRepository) UpdateStatus(id uint, status string, progress int, errorMsg string) error {
	updates := map[string]interface{}{
		"status":   status,
		"progress": progress,
	}
	if errorMsg != "" {
		updates["error_message"] = errorMsg
	}
	return r.db.Model(&model.LocalMedia{}).Where("id = ?", id).Updates(updates).Error
}

func (r *LocalMediaRepository) Delete(id uint) error {
	return r.db.Delete(&model.LocalMedia{}, id).Error
}

func (r *LocalMediaRepository) FindPendingTranscodes() ([]model.LocalMedia, error) {
	var media []model.LocalMedia
	err := r.db.Where("status IN ?", []string{"pending", "processing"}).Find(&media).Error
	return media, err
}

// ListRecent devuelve los últimos N registros de local_media para diagnóstico
func (r *LocalMediaRepository) ListRecent(limit int) ([]model.LocalMedia, error) {
	var media []model.LocalMedia
	err := r.db.Order("created_at DESC").Limit(limit).Find(&media).Error
	return media, err
}
