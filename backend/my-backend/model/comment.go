package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Comment 评论表
type Comment struct {
	CommentID uuid.UUID  `gorm:"type:uuid;primaryKey;column:comment_id"          json:"comment_id"`
	PostID    uuid.UUID  `gorm:"type:uuid;not null;index;column:post_id"         json:"post_id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index;column:user_id"         json:"user_id"`
	ParentID  *uuid.UUID `gorm:"type:uuid;index;column:parent_id"                json:"parent_id,omitempty"`
	Content   string     `gorm:"type:text;not null;column:content"               json:"content"`
	CreatedAt time.Time  `gorm:"autoCreateTime;index;column:created_at"          json:"created_at"`
	// 软删除字段，NULL=正常，非NULL=已删除
	DeletedAt *time.Time `gorm:"index;column:deleted_at"                         json:"-"`
}

// BeforeCreate 在插入前自动生成 UUID
func (c *Comment) BeforeCreate(tx *gorm.DB) error {
	if c.CommentID == uuid.Nil {
		c.CommentID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (Comment) TableName() string {
	return "comments"
}
