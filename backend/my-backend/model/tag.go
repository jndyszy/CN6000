package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Tag 标签表
type Tag struct {
	TagID     uuid.UUID `gorm:"type:uuid;primaryKey;column:tag_id"              json:"tag_id"`
	TagName   string    `gorm:"type:character varying(50);not null;column:tag_name" json:"tag_name"`
	CreatedAt time.Time `gorm:"autoCreateTime;column:created_at"                json:"created_at"`
}

// BeforeCreate 在插入前自动生成 UUID
func (t *Tag) BeforeCreate(tx *gorm.DB) error {
	if t.TagID == uuid.Nil {
		t.TagID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (Tag) TableName() string {
	return "tags"
}

// PostTag 帖子-标签关联表
// 复合主键 (post_id, tag_id) 防止重复绑定
type PostTag struct {
	PostID uuid.UUID `gorm:"type:uuid;primaryKey;column:post_id" json:"post_id"`
	TagID  uuid.UUID `gorm:"type:uuid;primaryKey;column:tag_id"  json:"tag_id"`
}

// TableName 指定表名
func (PostTag) TableName() string {
	return "post_tags"
}
