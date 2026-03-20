package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Notification 消息通知表
type Notification struct {
	NotificationID uuid.UUID  `gorm:"type:uuid;primaryKey;column:notification_id" json:"notification_id"`
	RecipientID    uuid.UUID  `gorm:"type:uuid;not null;index;column:recipient_id" json:"recipient_id"`
	ActorID        uuid.UUID  `gorm:"type:uuid;not null;column:actor_id"           json:"actor_id"`
	Type           string     `gorm:"type:varchar(20);not null;column:type"        json:"type"` // like | comment | reply
	PostID         *uuid.UUID `gorm:"type:uuid;column:post_id"                     json:"post_id,omitempty"`
	IsRead         bool       `gorm:"column:is_read;default:false"                 json:"is_read"`
	CreatedAt      time.Time  `gorm:"autoCreateTime;column:created_at"             json:"created_at"`
}

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.NotificationID == uuid.Nil {
		n.NotificationID = uuid.New()
	}
	return nil
}

func (Notification) TableName() string {
	return "notifications"
}
