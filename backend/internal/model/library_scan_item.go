package model

import "time"

type LibraryScanItem struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ScanSessionID  string    `gorm:"size:36;index;not null" json:"scan_session_id"`
	FilePath       string    `gorm:"size:1000;not null" json:"file_path"`
	FileName       string    `gorm:"size:500;not null" json:"file_name"`
	FileSize       int64     `json:"file_size"`
	ParsedTitle    string    `gorm:"size:500" json:"parsed_title"`
	ParsedYear     int       `json:"parsed_year"`
	MediaType      string    `gorm:"size:10" json:"media_type"` // movie, series
	SeasonNumber   int       `json:"season_number"`
	EpisodeNumber  int       `json:"episode_number"`
	Duration       float64   `json:"duration"`
	Resolution     string    `gorm:"size:20" json:"resolution"`
	VideoCodec     string    `gorm:"size:50" json:"video_codec"`
	AudioCodec     string    `gorm:"size:50" json:"audio_codec"`
	Container      string    `gorm:"size:20" json:"container"`
	NeedsTranscode bool      `json:"needs_transcode"`
	DirectPlayPath string    `gorm:"size:1000" json:"direct_play_path"`
	TMDBId         int       `json:"tmdb_id"`
	TMDBTitle      string    `gorm:"size:500" json:"tmdb_title"`
	TMDBYear       int       `json:"tmdb_year"`
	TMDBPosterURL  string    `gorm:"size:500" json:"tmdb_poster_url"`
	TMDBBackdropURL string   `gorm:"size:500" json:"tmdb_backdrop_url"`
	TMDBDescription string   `gorm:"type:text" json:"tmdb_description"`
	TMDBRating     float64   `gorm:"type:decimal(3,1)" json:"tmdb_rating"`
	TMDBSeriesName string    `gorm:"size:500" json:"tmdb_series_name"`
	ImportStatus   string    `gorm:"size:20;default:'pending'" json:"import_status"` // pending, imported, skipped, failed
	ImportedVODID  *uint     `json:"imported_vod_id"`
	ImportedSeriesID *uint   `json:"imported_series_id"`
	ErrorMessage   string    `gorm:"type:text" json:"error_message"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (LibraryScanItem) TableName() string {
	return "library_scan_items"
}
