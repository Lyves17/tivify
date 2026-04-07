package repository

import (
	"time"

	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type EPGRepository struct {
	db *gorm.DB
}

func NewEPGRepository(db *gorm.DB) *EPGRepository {
	return &EPGRepository{db: db}
}

func (r *EPGRepository) FindByID(id uint) (*model.EPGEntry, error) {
	var entry model.EPGEntry
	err := r.db.Preload("Channel").First(&entry, id).Error
	return &entry, err
}

func (r *EPGRepository) List(page, perPage int) ([]model.EPGEntry, int64, error) {
	var entries []model.EPGEntry
	var total int64

	r.db.Model(&model.EPGEntry{}).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Preload("Channel").
		Offset(offset).Limit(perPage).
		Order("start_time DESC").
		Find(&entries).Error
	return entries, total, err
}

func (r *EPGRepository) ListByChannel(channelID uint, date time.Time) ([]model.EPGEntry, error) {
	var entries []model.EPGEntry
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	err := r.db.Where("channel_id = ? AND start_time >= ? AND start_time < ?", channelID, startOfDay, endOfDay).
		Order("start_time ASC").
		Find(&entries).Error
	return entries, err
}

func (r *EPGRepository) Create(entry *model.EPGEntry) error {
	return r.db.Create(entry).Error
}

func (r *EPGRepository) Update(entry *model.EPGEntry) error {
	return r.db.Save(entry).Error
}

func (r *EPGRepository) Delete(id uint) error {
	return r.db.Delete(&model.EPGEntry{}, id).Error
}

func (r *EPGRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&model.EPGEntry{}).Count(&count).Error
	return count, err
}
