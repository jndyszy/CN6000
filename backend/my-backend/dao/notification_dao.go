package dao

import (
	"time"

	"github.com/google/uuid"

	"my-backend/conf"
	"my-backend/model"
)

// NotificationRow 通知查询结果（含操作者信息）
type NotificationRow struct {
	NotificationID string    `gorm:"column:notification_id" json:"notification_id"`
	ActorID        string    `gorm:"column:actor_id"        json:"actor_id"`
	ActorName      string    `gorm:"column:actor_name"      json:"actor_name"`
	ActorPicture   string    `gorm:"column:actor_picture"   json:"actor_picture"`
	Type           string    `gorm:"column:type"            json:"type"`
	PostID         *string   `gorm:"column:post_id"         json:"post_id"`
	IsRead         bool      `gorm:"column:is_read"         json:"is_read"`
	CreatedAt      time.Time `gorm:"column:created_at"      json:"created_at"`
}

// CreateNotification 插入一条通知（自身操作不通知自己）
func CreateNotification(n *model.Notification) error {
	if n.RecipientID == n.ActorID {
		return nil
	}
	return conf.DB.Create(n).Error
}

// GetNotifications 获取用户的最近通知列表（含操作者信息）
func GetNotifications(recipientID uuid.UUID, limit int) ([]NotificationRow, error) {
	var rows []NotificationRow
	query := `
SELECT n.notification_id, n.actor_id, u.username AS actor_name,
       COALESCE(u.profile_picture, '') AS actor_picture,
       n.type, n.post_id::text AS post_id, n.is_read, n.created_at
FROM notifications n
LEFT JOIN users u ON n.actor_id = u.user_id
WHERE n.recipient_id = ?
ORDER BY n.created_at DESC
LIMIT ?
`
	if err := conf.DB.Raw(query, recipientID, limit).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []NotificationRow{}
	}
	return rows, nil
}

// GetUnreadCount 获取用户未读通知数
func GetUnreadCount(recipientID uuid.UUID) (int64, error) {
	var count int64
	err := conf.DB.Model(&model.Notification{}).
		Where("recipient_id = ? AND is_read = false", recipientID).
		Count(&count).Error
	return count, err
}

// MarkAllRead 将用户所有未读通知标为已读
func MarkAllRead(recipientID uuid.UUID) error {
	return conf.DB.Model(&model.Notification{}).
		Where("recipient_id = ? AND is_read = false", recipientID).
		Update("is_read", true).Error
}
