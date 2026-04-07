package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type StreamRepository struct {
	db *gorm.DB
}

func NewStreamRepository(db *gorm.DB) *StreamRepository {
	return &StreamRepository{db: db}
}

func (r *StreamRepository) FindByID(id uint) (*model.Stream, error) {
	var stream model.Stream
	err := r.db.First(&stream, id).Error
	return &stream, err
}

func (r *StreamRepository) ListByChannel(channelID uint) ([]model.Stream, error) {
	var streams []model.Stream
	err := r.db.Where("channel_id = ?", channelID).Order("priority DESC").Find(&streams).Error
	return streams, err
}

func (r *StreamRepository) Create(stream *model.Stream) error {
	return r.db.Create(stream).Error
}

func (r *StreamRepository) Update(stream *model.Stream) error {
	return r.db.Save(stream).Error
}

func (r *StreamRepository) Delete(id uint) error {
	return r.db.Delete(&model.Stream{}, id).Error
}

func (r *StreamRepository) DeleteByChannel(channelID uint) error {
	return r.db.Where("channel_id = ?", channelID).Delete(&model.Stream{}).Error
}
