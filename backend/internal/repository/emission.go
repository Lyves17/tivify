package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type EmissionRepository struct {
	db *gorm.DB
}

func NewEmissionRepository(db *gorm.DB) *EmissionRepository {
	return &EmissionRepository{db: db}
}

func (r *EmissionRepository) FindByChannelID(channelID uint) (*model.Emission, error) {
	var emission model.Emission
	err := r.db.Where("channel_id = ?", channelID).First(&emission).Error
	return &emission, err
}

func (r *EmissionRepository) FindAllRunning() ([]model.Emission, error) {
	var emissions []model.Emission
	err := r.db.Where("status IN ?", []string{"running", "starting"}).Find(&emissions).Error
	return emissions, err
}

func (r *EmissionRepository) Create(emission *model.Emission) error {
	return r.db.Create(emission).Error
}

func (r *EmissionRepository) Save(emission *model.Emission) error {
	return r.db.Save(emission).Error
}

func (r *EmissionRepository) UpdateStatus(channelID uint, status string, pid int, errMsg string) error {
	updates := map[string]interface{}{
		"status": status,
		"p_id":   pid,
		"error":  errMsg,
	}
	return r.db.Model(&model.Emission{}).Where("channel_id = ?", channelID).Updates(updates).Error
}

func (r *EmissionRepository) ListAll() ([]model.Emission, error) {
	var emissions []model.Emission
	err := r.db.Preload("Channel").Find(&emissions).Error
	return emissions, err
}
