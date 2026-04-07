package repository

import (
	"github.com/tivify/backend/internal/model"
	"gorm.io/gorm"
)

type PlaylistRepository struct {
	db *gorm.DB
}

func NewPlaylistRepository(db *gorm.DB) *PlaylistRepository {
	return &PlaylistRepository{db: db}
}

func (r *PlaylistRepository) FindByChannelID(channelID uint) (*model.Playlist, error) {
	var playlist model.Playlist
	err := r.db.Where("channel_id = ?", channelID).
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC")
		}).
		Preload("Items.LocalMedia").
		First(&playlist).Error
	return &playlist, err
}

func (r *PlaylistRepository) Create(playlist *model.Playlist) error {
	return r.db.Create(playlist).Error
}

func (r *PlaylistRepository) Update(playlist *model.Playlist) error {
	return r.db.Save(playlist).Error
}

func (r *PlaylistRepository) AddItem(item *model.PlaylistItem) error {
	return r.db.Create(item).Error
}

func (r *PlaylistRepository) RemoveItem(itemID uint) error {
	return r.db.Delete(&model.PlaylistItem{}, itemID).Error
}

func (r *PlaylistRepository) FindItemByID(itemID uint) (*model.PlaylistItem, error) {
	var item model.PlaylistItem
	err := r.db.First(&item, itemID).Error
	return &item, err
}

func (r *PlaylistRepository) ReorderItems(playlistID uint, items []struct {
	ID        uint
	SortOrder int
}) error {
	tx := r.db.Begin()
	for _, item := range items {
		if err := tx.Model(&model.PlaylistItem{}).
			Where("id = ? AND playlist_id = ?", item.ID, playlistID).
			Update("sort_order", item.SortOrder).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}

func (r *PlaylistRepository) DeleteByChannelID(channelID uint) error {
	var playlist model.Playlist
	if err := r.db.Where("channel_id = ?", channelID).First(&playlist).Error; err != nil {
		return err
	}
	r.db.Where("playlist_id = ?", playlist.ID).Delete(&model.PlaylistItem{})
	return r.db.Delete(&playlist).Error
}
