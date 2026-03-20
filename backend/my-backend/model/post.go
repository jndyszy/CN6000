package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// Post 帖子表
type Post struct {
	PostID     uuid.UUID      `gorm:"type:uuid;primaryKey;column:post_id"                         json:"post_id"`
	UserID     uuid.UUID      `gorm:"type:uuid;not null;index;column:user_id"                     json:"user_id"`
	Content    string         `gorm:"type:text;not null;column:content"                           json:"content"`
	// content_tsv 由数据库触发器自动维护，Go 层只读
	ContentTsv string         `gorm:"type:tsvector;column:content_tsv;<-:false"                   json:"-"`
	ImageURLs  pq.StringArray `gorm:"type:text[];default:'{}';column:image_urls"                  json:"image_urls"`
	CreatedAt  time.Time      `gorm:"autoCreateTime;index;column:created_at"                      json:"created_at"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime;column:updated_at"                            json:"updated_at"`
	// 软删除字段，NULL=正常，非NULL=已删除，不使用 gorm.DeletedAt 以自行控制查询过滤
	DeletedAt  *time.Time     `gorm:"index;column:deleted_at"                                     json:"-"`
	// 可见性：public（所有人）| followers（仅关注者）| private（仅自己）
	Visibility string         `gorm:"type:varchar(10);not null;default:'public';column:visibility" json:"visibility"`
}

// BeforeCreate 在插入前自动生成 UUID
func (p *Post) BeforeCreate(tx *gorm.DB) error {
	if p.PostID == uuid.Nil {
		p.PostID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (Post) TableName() string {
	return "posts"
}
