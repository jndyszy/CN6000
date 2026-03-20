package model

import (
	"time"

	"github.com/google/uuid"
)

// Follow 关注关系表
// 复合主键 (follower_id, followee_id) 防止重复关注
type Follow struct {
	FollowerID uuid.UUID `gorm:"type:uuid;primaryKey;column:follower_id" json:"follower_id"`
	FolloweeID uuid.UUID `gorm:"type:uuid;primaryKey;column:followee_id" json:"followee_id"`
	CreatedAt  time.Time `gorm:"autoCreateTime;column:created_at"        json:"created_at"`
}

// TableName 指定表名
func (Follow) TableName() string {
	return "follows"
}
