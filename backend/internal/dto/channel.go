package dto

import "time"

type CreateChannelRequest struct {
	Name          string                `json:"name"`
	Slug          string                `json:"slug"`
	CategoryID    *uint                 `json:"category_id"`
	LogoURL       string                `json:"logo_url"`
	EPGChannelID  string                `json:"epg_channel_id"`
	ChannelNumber *int                  `json:"channel_number"`
	IsActive      *bool                 `json:"is_active"`
	Streams       []CreateStreamRequest `json:"streams"`
}

type UpdateChannelRequest struct {
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	CategoryID    *uint  `json:"category_id"`
	LogoURL       string `json:"logo_url"`
	EPGChannelID  string `json:"epg_channel_id"`
	ChannelNumber *int   `json:"channel_number"`
	IsActive      *bool  `json:"is_active"`
}

type ChannelResponse struct {
	ID            uint              `json:"id"`
	Name          string            `json:"name"`
	Slug          string            `json:"slug"`
	CategoryID    *uint             `json:"category_id"`
	Category      *CategoryResponse `json:"category,omitempty"`
	LogoURL       string            `json:"logo_url"`
	EPGChannelID  string            `json:"epg_channel_id"`
	ChannelNumber *int              `json:"channel_number"`
	IsActive      bool              `json:"is_active"`
	Streams       []StreamResponse  `json:"streams,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
}

type ChannelListResponse struct {
	ID            uint              `json:"id"`
	Name          string            `json:"name"`
	Slug          string            `json:"slug"`
	CategoryID    *uint             `json:"category_id"`
	Category      *CategoryResponse `json:"category,omitempty"`
	LogoURL       string            `json:"logo_url"`
	EPGChannelID  string            `json:"epg_channel_id"`
	ChannelNumber *int              `json:"channel_number"`
	IsActive      bool              `json:"is_active"`
	StreamCount   int               `json:"stream_count"`
	CreatedAt     time.Time         `json:"created_at"`
}
