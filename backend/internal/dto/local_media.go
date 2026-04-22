package dto

import "time"

type LocalMediaResponse struct {
	ID               uint      `json:"id"`
	OriginalFilename string    `json:"original_filename"`
	FilePath         string    `json:"file_path"`
	HLSPath          string    `json:"hls_path"`
	FileSize         int64     `json:"file_size"`
	Duration         float64   `json:"duration"`
	Resolution       string    `json:"resolution"`
	MimeType         string    `json:"mime_type"`
	Status           string    `json:"status"`
	Progress         int       `json:"progress"`
	ErrorMessage     string    `json:"error_message"`
	ThumbnailPath    string    `json:"thumbnail_path"`
	CreatedAt        time.Time `json:"created_at"`
}
