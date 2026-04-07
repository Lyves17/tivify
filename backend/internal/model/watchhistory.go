package model

import (
	"time"

	"github.com/google/uuid"
)

type WatchHistory struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;index:idx_watch_user_content,priority:1;index" json:"user_id"`
	ContentType string    `gorm:"size:20;not null;index:idx_watch_user_content,priority:2" json:"content_type"` // channel, vod
	ContentID   uint      `gorm:"not null;index:idx_watch_user_content,priority:3" json:"content_id"`
	Progress    int       `gorm:"default:0" json:"progress"` // segundos vistos (para VOD resume)
	Duration    int       `json:"duration"`                   // duracion total
	WatchedAt   time.Time `gorm:"not null;index" json:"watched_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relaciones
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (WatchHistory) TableName() string {
	return "watch_history"
}
