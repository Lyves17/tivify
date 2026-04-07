package model

import (
	"time"

	"gorm.io/gorm"
)

type VOD struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Title             string         `gorm:"size:255;not null" json:"title"`
	Slug              string         `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Description       string         `gorm:"type:text" json:"description"`
	CategoryID        *uint          `gorm:"index" json:"category_id"`
	Duration          int            `json:"duration"` // segundos
	PosterURL         string         `gorm:"size:500" json:"poster_url"`
	BackdropURL       string         `gorm:"size:500" json:"backdrop_url"`
	OriginalFilename  string         `gorm:"size:255" json:"original_filename"`
	HLSPath           string         `gorm:"size:500" json:"hls_path"`
	TranscodeStatus   string         `gorm:"size:20;default:'pending';index" json:"transcode_status"` // pending, processing, completed, failed
	TranscodeProgress int            `gorm:"default:0" json:"transcode_progress"`               // 0-100
	FileSize          int64          `json:"file_size"`
	Resolution        string         `gorm:"size:20" json:"resolution"`
	Year              int            `json:"year"`
	Rating            float64        `gorm:"type:decimal(3,1)" json:"rating"`
	IsActive          bool           `gorm:"default:true;index" json:"is_active"`
	SeriesID          *uint          `gorm:"index" json:"series_id"`
	SeasonNumber      int            `json:"season_number"`
	EpisodeNumber     int            `json:"episode_number"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	// Relaciones
	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Series   *Series   `gorm:"foreignKey:SeriesID" json:"series,omitempty"`
}

func (VOD) TableName() string {
	return "vods"
}
