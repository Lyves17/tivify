package dto

import "time"

type CreateStreamRequest struct {
	ChannelID    uint   `json:"channel_id"`
	URL          string `json:"url"`
	StreamFormat string `json:"stream_format"` // hls, rtmp, mpegts
	Priority     int    `json:"priority"`
	IsActive     *bool  `json:"is_active"`
	UserAgent    string `json:"user_agent"`
	Headers      string `json:"headers"` // JSON string
}

type UpdateStreamRequest struct {
	URL          string `json:"url"`
	StreamFormat string `json:"stream_format"`
	Priority     *int   `json:"priority"`
	IsActive     *bool  `json:"is_active"`
	UserAgent    string `json:"user_agent"`
	Headers      string `json:"headers"`
}

type StreamResponse struct {
	ID           uint      `json:"id"`
	ChannelID    uint      `json:"channel_id"`
	URL          string    `json:"url"`
	StreamFormat string    `json:"stream_format"`
	Priority     int       `json:"priority"`
	IsActive     bool      `json:"is_active"`
	UserAgent    string    `json:"user_agent"`
	Headers      string    `json:"headers"`
	CreatedAt    time.Time `json:"created_at"`
}
