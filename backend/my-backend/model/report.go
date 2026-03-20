package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Report 内容举报表
type Report struct {
	ReportID   uuid.UUID `gorm:"type:uuid;primaryKey;column:report_id"          json:"report_id"`
	ReporterID uuid.UUID `gorm:"type:uuid;not null;column:reporter_id"          json:"reporter_id"`
	TargetType string    `gorm:"type:varchar(10);not null;column:target_type"   json:"target_type"` // 'post' | 'comment'
	TargetID   uuid.UUID `gorm:"type:uuid;not null;column:target_id"            json:"target_id"`
	Reason     string    `gorm:"type:varchar(50);not null;column:reason"        json:"reason"`
	CreatedAt  time.Time `gorm:"autoCreateTime;column:created_at"               json:"created_at"`
}

// BeforeCreate 在插入前自动生成 UUID
func (r *Report) BeforeCreate(tx *gorm.DB) error {
	if r.ReportID == uuid.Nil {
		r.ReportID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (Report) TableName() string {
	return "reports"
}
