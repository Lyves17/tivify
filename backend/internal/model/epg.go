package model

import "time"

type EPGEntry struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ChannelID   uint      `gorm:"not null;index:idx_epg_channel_time" json:"channel_id"`
	Title       string    `gorm:"size:255;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	StartTime   time.Time `gorm:"not null;index:idx_epg_channel_time" json:"start_time"`
	EndTime     time.Time `gorm:"not null" json:"end_time"`
	Category    string    `gorm:"size:100" json:"category"`
	Language    string    `gorm:"size:10" json:"language"`
	EpisodeNum  string    `gorm:"size:50" json:"episode_num"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relaciones
	Channel *Channel `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
}

func (EPGEntry) TableName() string {
	return "epg_entries"
}
