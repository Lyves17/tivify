package model

import (
	"time"

	"gorm.io/gorm"
)

type Series struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Title        string         `gorm:"size:255;not null" json:"title"`
	Slug         string         `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Description  string         `gorm:"type:text" json:"description"`
	CategoryID   *uint          `gorm:"index" json:"category_id"`
	PosterURL    string         `gorm:"size:500" json:"poster_url"`
	BackdropURL  string         `gorm:"size:500" json:"backdrop_url"`
	Year         int            `json:"year"`
	Rating       float64        `gorm:"type:decimal(3,1)" json:"rating"`
	TotalSeasons int            `gorm:"default:0" json:"total_seasons"`
	IsActive     bool           `gorm:"default:true;index" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Relaciones
	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Episodes []VOD     `gorm:"foreignKey:SeriesID" json:"episodes,omitempty"`
}

func (Series) TableName() string {
	return "series"
}
