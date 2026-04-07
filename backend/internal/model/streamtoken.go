package model

import (
	"time"

	"github.com/google/uuid"
)

type StreamToken struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Token     string    `gorm:"size:64;uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`

	// Relaciones
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (StreamToken) TableName() string {
	return "stream_tokens"
}
