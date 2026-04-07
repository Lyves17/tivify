package dto

import "time"

type CreateEPGRequest struct {
	ChannelID   uint      `json:"channel_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Category    string    `json:"category"`
	Language    string    `json:"language"`
	EpisodeNum  string    `json:"episode_num"`
}

type UpdateEPGRequest struct {
	ChannelID   *uint      `json:"channel_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	StartTime   *time.Time `json:"start_time"`
	EndTime     *time.Time `json:"end_time"`
	Category    string     `json:"category"`
	Language    string     `json:"language"`
	EpisodeNum  string     `json:"episode_num"`
}

type EPGResponse struct {
	ID          uint      `json:"id"`
	ChannelID   uint      `json:"channel_id"`
	ChannelName string    `json:"channel_name,omitempty"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Category    string    `json:"category"`
	Language    string    `json:"language"`
	EpisodeNum  string    `json:"episode_num"`
	CreatedAt   time.Time `json:"created_at"`
}
