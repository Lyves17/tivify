package model

import "time"

type LocalMedia struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	OriginalFilename string    `gorm:"size:500;not null" json:"original_filename"`
	FilePath         string    `gorm:"size:500;not null" json:"file_path"`
	HLSPath          string    `gorm:"size:500" json:"hls_path"`
	FileSize         int64     `json:"file_size"`
	Duration         float64   `json:"duration"`
	Resolution       string    `gorm:"size:20" json:"resolution"`
	MimeType         string    `gorm:"size:100" json:"mime_type"`
	Status           string    `gorm:"size:20;default:pending" json:"status"`
	Progress         int       `gorm:"default:0" json:"progress"`
	ErrorMessage     string    `gorm:"type:text" json:"error_message"`
	ThumbnailPath    string    `gorm:"size:500" json:"thumbnail_path"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (LocalMedia) TableName() string {
	return "local_media"
}
