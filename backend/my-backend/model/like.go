package model

import (
	"time"

	"github.com/google/uuid"
)

// Like 点赞记录表
// 复合主键 (user_id, post_id) 防止重复点赞
type Like struct {
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey;column:user_id" json:"user_id"`
	PostID    uuid.UUID `gorm:"type:uuid;primaryKey;column:post_id" json:"post_id"`
	CreatedAt time.Time `gorm:"autoCreateTime;column:created_at"   json:"created_at"`
}

// TableName 指定表名
func (Like) TableName() string {
	return "likes"
}
