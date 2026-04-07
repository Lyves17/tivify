package dto

import "time"

type EmissionResponse struct {
	ID        uint       `json:"id"`
	ChannelID uint       `json:"channel_id"`
	Status    string     `json:"status"`
	Error     string     `json:"error,omitempty"`
	StartedAt *time.Time `json:"started_at,omitempty"`
}

type EmissionStatusResponse struct {
	ChannelID uint   `json:"channel_id"`
	IsLive    bool   `json:"is_live"`
	Status    string `json:"status"`
	StreamURL string `json:"stream_url,omitempty"`
	Error     string `json:"error,omitempty"`
}

type LiveChannelsResponse struct {
	LiveChannelIDs []uint `json:"live_channel_ids"`
}
