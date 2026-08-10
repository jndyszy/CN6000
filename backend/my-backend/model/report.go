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
	// Status 处理状态：pending（待处理，默认）| removed（已下架内容）| dismissed（已驳回）
	Status     string     `gorm:"type:varchar(20);not null;default:'pending';column:status" json:"status"`
	ResolvedBy *uuid.UUID `gorm:"type:uuid;column:resolved_by"                              json:"resolved_by,omitempty"`
	ResolvedAt *time.Time `gorm:"column:resolved_at"                                        json:"resolved_at,omitempty"`
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
