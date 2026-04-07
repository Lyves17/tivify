package model

import (
	"time"

	"github.com/google/uuid"
)

type Favorite struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	UserID          uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_user_fav" json:"user_id"`
	FavoritableType string    `gorm:"size:20;not null;uniqueIndex:idx_user_fav" json:"favoritable_type"` // channel, vod, series
	FavoritableID   uint      `gorm:"not null;uniqueIndex:idx_user_fav" json:"favoritable_id"`
	CreatedAt       time.Time `json:"created_at"`

	// Relaciones
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Favorite) TableName() string {
	return "favorites"
}
