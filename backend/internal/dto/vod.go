package dto

import "time"

type CreateVODFromMediaRequest struct {
	Title         string  `json:"title"`
	Slug          string  `json:"slug"`
	Description   string  `json:"description"`
	CategoryID    *uint   `json:"category_id"`
	Year          int     `json:"year"`
	Rating        float64 `json:"rating"`
	PosterURL     string  `json:"poster_url"`
	BackdropURL   string  `json:"backdrop_url"`
	IsActive      *bool   `json:"is_active"`
	SeriesID      *uint   `json:"series_id"`
	SeasonNumber  int     `json:"season_number"`
	EpisodeNumber int     `json:"episode_number"`
}

type CreateVODRequest struct {
	Title         string  `json:"title"`
	Slug          string  `json:"slug"`
	Description   string  `json:"description"`
	CategoryID    *uint   `json:"category_id"`
	Duration      int     `json:"duration"`
	PosterURL     string  `json:"poster_url"`
	BackdropURL   string  `json:"backdrop_url"`
	HLSPath       string  `json:"hls_path"`
	Year          int     `json:"year"`
	Rating        float64 `json:"rating"`
	IsActive      *bool   `json:"is_active"`
	SeriesID      *uint   `json:"series_id"`
	SeasonNumber  int     `json:"season_number"`
	EpisodeNumber int     `json:"episode_number"`
}

type UpdateVODRequest struct {
	Title         string   `json:"title"`
	Slug          string   `json:"slug"`
	Description   string   `json:"description"`
	CategoryID    *uint    `json:"category_id"`
	Duration      *int     `json:"duration"`
	PosterURL     string   `json:"poster_url"`
	BackdropURL   string   `json:"backdrop_url"`
	HLSPath       string   `json:"hls_path"`
	Year          *int     `json:"year"`
	Rating        *float64 `json:"rating"`
	IsActive      *bool    `json:"is_active"`
	SeriesID      *uint    `json:"series_id"`
	SeasonNumber  *int     `json:"season_number"`
	EpisodeNumber *int     `json:"episode_number"`
}

type VODResponse struct {
	ID                uint              `json:"id"`
	Title             string            `json:"title"`
	Slug              string            `json:"slug"`
	Description       string            `json:"description"`
	CategoryID        *uint             `json:"category_id"`
	Category          *CategoryResponse `json:"category,omitempty"`
	Duration          int               `json:"duration"`
	PosterURL         string            `json:"poster_url"`
	BackdropURL       string            `json:"backdrop_url"`
	HLSPath           string            `json:"hls_path"`
	TranscodeStatus   string            `json:"transcode_status"`
	TranscodeProgress int               `json:"transcode_progress"`
	FileSize          int64             `json:"file_size"`
	Resolution        string            `json:"resolution"`
	Year              int               `json:"year"`
	Rating            float64           `json:"rating"`
	IsActive          bool              `json:"is_active"`
	SeriesID          *uint             `json:"series_id"`
	SeasonNumber      int               `json:"season_number"`
	EpisodeNumber     int               `json:"episode_number"`
	CreatedAt         time.Time         `json:"created_at"`
}
