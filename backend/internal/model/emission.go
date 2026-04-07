package model

import "time"

type Emission struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	ChannelID uint       `gorm:"uniqueIndex;not null" json:"channel_id"`
	Status    string     `gorm:"size:20;default:stopped" json:"status"` // stopped, starting, running, error
	PID       int        `json:"pid"`
	Error     string     `gorm:"type:text" json:"error"`
	StartedAt *time.Time `json:"started_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`

	Channel *Channel `gorm:"foreignKey:ChannelID" json:"channel,omitempty"`
}
