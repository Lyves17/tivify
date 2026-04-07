package dto

import "time"

type CreateCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Type      string `json:"type"` // live, vod, series
	ParentID  *uint  `json:"parent_id"`
	SortOrder int    `json:"sort_order"`
}

type UpdateCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Type      string `json:"type"`
	ParentID  *uint  `json:"parent_id"`
	SortOrder *int   `json:"sort_order"`
}

type CategoryResponse struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Type      string    `json:"type"`
	ParentID  *uint     `json:"parent_id"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}
