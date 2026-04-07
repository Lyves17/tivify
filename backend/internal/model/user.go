package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID             uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Username       string         `gorm:"size:50;uniqueIndex;not null" json:"username"`
	Email          string         `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash   string         `gorm:"size:255;not null" json:"-"`
	Role           string         `gorm:"size:20;not null;default:'user'" json:"role"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	MaxConnections int            `gorm:"default:1" json:"max_connections"`
	ExpDate        *time.Time     `json:"exp_date"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string {
	return "users"
}
