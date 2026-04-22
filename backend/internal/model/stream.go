package model

import "time"

type Stream struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ChannelID    uint      `gorm:"not null;index" json:"channel_id"`
	URL          string    `gorm:"type:text;not null" json:"url"`
	StreamFormat string    `gorm:"size:20;not null" json:"stream_format"` // hls, rtmp, mpegts
	Priority     int       `gorm:"default:0" json:"priority"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	UserAgent    string    `gorm:"size:255" json:"user_agent"`
	Headers      string    `gorm:"type:jsonb" json:"headers"` // JSON object with custom headers
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Relaciones
	Channel *Channel `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
}

func (Stream) TableName() string {
	return "streams"
}
