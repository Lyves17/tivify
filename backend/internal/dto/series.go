package dto

import "time"

type CreateSeriesRequest struct {
	Title        string  `json:"title"`
	Slug         string  `json:"slug"`
	Description  string  `json:"description"`
	CategoryID   *uint   `json:"category_id"`
	PosterURL    string  `json:"poster_url"`
	BackdropURL  string  `json:"backdrop_url"`
	Year         int     `json:"year"`
	Rating       float64 `json:"rating"`
	TotalSeasons int     `json:"total_seasons"`
	IsActive     *bool   `json:"is_active"`
}

type UpdateSeriesRequest struct {
	Title        string   `json:"title"`
	Slug         string   `json:"slug"`
	Description  string   `json:"description"`
	CategoryID   *uint    `json:"category_id"`
	PosterURL    string   `json:"poster_url"`
	BackdropURL  string   `json:"backdrop_url"`
	Year         *int     `json:"year"`
	Rating       *float64 `json:"rating"`
	TotalSeasons *int     `json:"total_seasons"`
	IsActive     *bool    `json:"is_active"`
}

type SeriesResponse struct {
	ID            uint              `json:"id"`
	Title         string            `json:"title"`
	Slug          string            `json:"slug"`
	Description   string            `json:"description"`
	CategoryID    *uint             `json:"category_id"`
	Category      *CategoryResponse `json:"category,omitempty"`
	PosterURL     string            `json:"poster_url"`
	BackdropURL   string            `json:"backdrop_url"`
	Year          int               `json:"year"`
	Rating        float64           `json:"rating"`
	TotalSeasons  int               `json:"total_seasons"`
	IsActive      bool              `json:"is_active"`
	EpisodesCount int               `json:"episodes_count"`
	CreatedAt     time.Time         `json:"created_at"`
}
