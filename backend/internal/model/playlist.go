package model

import "time"

type Playlist struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	ChannelID    uint   `gorm:"uniqueIndex;not null" json:"channel_id"`
	PlaybackMode string `gorm:"size:20;default:loop" json:"playback_mode"`
	IsActive     bool   `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Channel *Channel       `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
	Items   []PlaylistItem `gorm:"foreignKey:PlaylistID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
}

func (Playlist) TableName() string {
	return "playlists"
}

type PlaylistItem struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	PlaylistID   uint      `gorm:"not null;index" json:"playlist_id"`
	LocalMediaID uint      `gorm:"not null" json:"local_media_id"`
	SortOrder    int       `gorm:"default:0" json:"sort_order"`
	CreatedAt    time.Time `json:"created_at"`

	LocalMedia *LocalMedia `gorm:"foreignKey:LocalMediaID" json:"local_media,omitempty"`
}

func (PlaylistItem) TableName() string {
	return "playlist_items"
}
