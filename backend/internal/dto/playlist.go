package dto

import "time"

type PlaylistItemResponse struct {
	ID           uint                `json:"id"`
	LocalMediaID uint                `json:"local_media_id"`
	SortOrder    int                 `json:"sort_order"`
	LocalMedia   *LocalMediaResponse `json:"local_media,omitempty"`
	CreatedAt    time.Time           `json:"created_at"`
}

type PlaylistResponse struct {
	ID           uint                   `json:"id"`
	ChannelID    uint                   `json:"channel_id"`
	PlaybackMode string                 `json:"playback_mode"`
	IsActive     bool                   `json:"is_active"`
	Items        []PlaylistItemResponse `json:"items"`
	CreatedAt    time.Time              `json:"created_at"`
}

type AddPlaylistItemRequest struct {
	LocalMediaID uint `json:"local_media_id"`
	SortOrder    int  `json:"sort_order"`
}

type ReorderPlaylistRequest struct {
	Items []ReorderItem `json:"items"`
}

type ReorderItem struct {
	ID        uint `json:"id"`
	SortOrder int  `json:"sort_order"`
}

type UpdatePlaylistModeRequest struct {
	PlaybackMode string `json:"playback_mode"`
}
