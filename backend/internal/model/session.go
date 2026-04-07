package model

import (
	"time"

	"github.com/google/uuid"
)

type Session struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	RefreshToken string    `gorm:"size:255;uniqueIndex;not null" json:"-"`
	UserAgent    string    `gorm:"type:text" json:"user_agent"`
	IPAddress    string    `gorm:"size:45" json:"ip_address"`
	ExpiresAt    time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt    time.Time `json:"created_at"`

	// Relaciones
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Session) TableName() string {
	return "sessions"
}
