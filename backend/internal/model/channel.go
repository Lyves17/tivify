package model

import (
	"time"

	"gorm.io/gorm"
)

type Channel struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	Name          string `gorm:"size:255;not null" json:"name"`
	Slug          string `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	CategoryID    *uint  `gorm:"index" json:"category_id"`
	LogoURL       string `gorm:"size:500" json:"logo_url"`
	EPGChannelID  string `gorm:"size:100" json:"epg_channel_id"`
	ChannelNumber *int   `json:"channel_number"`
	IsActive      bool   `gorm:"default:true;index" json:"is_active"`
	// Source identifica el origen del canal:
	//   ""         → creado manualmente (nunca se borra en reimportaciones)
	//   "iptv-org" → importado desde iptv-org
	//   cualquier string personalizado → importado desde fuente custom
	Source    string         `gorm:"size:100;default:'';index" json:"source"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relaciones
	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Streams  []Stream  `gorm:"foreignKey:ChannelID" json:"streams,omitempty"`
}

func (Channel) TableName() string {
	return "channels"
}
