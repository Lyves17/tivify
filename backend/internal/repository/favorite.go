package repository

import (
	"github.com/google/uuid"
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type FavoriteRepository struct {
	db *gorm.DB
}

func NewFavoriteRepository(db *gorm.DB) *FavoriteRepository {
	return &FavoriteRepository{db: db}
}

func (r *FavoriteRepository) FindByUserAndItem(userID uuid.UUID, favType string, favID uint) (*model.Favorite, error) {
	var fav model.Favorite
	err := r.db.Where("user_id = ? AND favoritable_type = ? AND favoritable_id = ?", userID, favType, favID).First(&fav).Error
	return &fav, err
}

func (r *FavoriteRepository) ListByUser(userID uuid.UUID, page, perPage int) ([]model.Favorite, int64, error) {
	var favorites []model.Favorite
	var total int64

	r.db.Model(&model.Favorite{}).Where("user_id = ?", userID).Count(&total)

	offset := (page - 1) * perPage
	err := r.db.Where("user_id = ?", userID).
		Offset(offset).Limit(perPage).
		Order("created_at DESC").
		Find(&favorites).Error
	return favorites, total, err
}

func (r *FavoriteRepository) Create(fav *model.Favorite) error {
	return r.db.Create(fav).Error
}

func (r *FavoriteRepository) Delete(id uint) error {
	return r.db.Delete(&model.Favorite{}, id).Error
}

func (r *FavoriteRepository) DeleteByUserAndItem(userID uuid.UUID, favType string, favID uint) error {
	return r.db.Where("user_id = ? AND favoritable_type = ? AND favoritable_id = ?", userID, favType, favID).
		Delete(&model.Favorite{}).Error
}
