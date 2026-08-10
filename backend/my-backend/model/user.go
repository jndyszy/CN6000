package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User 用户表
type User struct {
	UserID         uuid.UUID `gorm:"type:uuid;primaryKey;column:user_id"                          json:"user_id"`
	Username       string    `gorm:"type:character varying(50);not null;column:username"          json:"username"`
	Email          string    `gorm:"type:character varying(100);not null;column:email"            json:"email"`
	PasswordHash   string    `gorm:"type:character varying(255);not null;column:password_hash"    json:"-"`
	ProfilePicture string    `gorm:"type:character varying(500);column:profile_picture"           json:"profile_picture,omitempty"`
	Bio            string    `gorm:"type:text;column:bio"                                   json:"bio,omitempty"`
	// Role 三级角色：user（默认）| admin（管理员）| super_admin（超级管理员）
	Role             string `gorm:"type:varchar(20);not null;default:'user';column:role"           json:"role"`
	IsBanned         bool   `gorm:"not null;default:false;column:is_banned"                        json:"is_banned"`
	BanReason        string `gorm:"type:text;column:ban_reason"                                    json:"ban_reason,omitempty"`
	IsPostRestricted bool   `gorm:"not null;default:false;column:is_post_restricted"               json:"is_post_restricted"`
	RestrictedReason string `gorm:"type:text;column:restricted_reason"                             json:"restricted_reason,omitempty"`
	CreatedAt      time.Time `gorm:"autoCreateTime;column:created_at"                       json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime;column:updated_at"                       json:"updated_at"`
}

// BeforeCreate 在插入前自动生成 UUID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.UserID == uuid.Nil {
		u.UserID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}
