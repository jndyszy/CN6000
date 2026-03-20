package dao

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"my-backend/conf"
	"my-backend/model"
)

// UserRow 用户简要信息（用于搜索、关注列表、推荐等场景）
type UserRow struct {
	UserID         string `gorm:"column:user_id"`
	Username       string `gorm:"column:username"`
	Bio            string `gorm:"column:bio"`
	ProfilePicture string `gorm:"column:profile_picture"`
}

// GetUserByEmail 根据邮箱查找用户，未找到时返回 (nil, nil)
func GetUserByEmail(email string) (*model.User, error) {
	var user model.User
	err := conf.DB.Where("email = ?", email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

// GetUserByUsername 根据用户名查找用户，未找到时返回 (nil, nil)
func GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	err := conf.DB.Where("username = ?", username).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

// CreateUser 创建新用户
func CreateUser(user *model.User) error {
	return conf.DB.Create(user).Error
}

// UpdateUserPassword 更新指定用户的密码哈希
func UpdateUserPassword(userID uuid.UUID, passwordHash string) error {
	return conf.DB.Model(&model.User{}).
		Where("user_id = ?", userID).
		Update("password_hash", passwordHash).Error
}

// GetUserByID 根据 UUID 查找用户，未找到时返回 (nil, nil)
func GetUserByID(userID uuid.UUID) (*model.User, error) {
	var user model.User
	err := conf.DB.Where("user_id = ?", userID).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &user, err
}

// UpdateUserProfile 用 map 更新用户资料（支持清空字段，map 不跳过零值）
func UpdateUserProfile(userID uuid.UUID, updates map[string]interface{}) error {
	return conf.DB.Model(&model.User{}).
		Where("user_id = ?", userID).
		Updates(updates).Error
}

// SearchUsers 按用户名模糊搜索（ILIKE），返回匹配列表和总数
func SearchUsers(q string, limit int) ([]UserRow, int64, error) {
	pattern := "%" + q + "%"
	var rows []UserRow
	if err := conf.DB.Raw(`
SELECT user_id, username, bio, profile_picture
FROM users
WHERE username ILIKE ?
LIMIT ?`, pattern, limit).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	var total int64
	conf.DB.Raw("SELECT COUNT(*) FROM users WHERE username ILIKE ?", pattern).Scan(&total)
	if rows == nil {
		rows = []UserRow{}
	}
	return rows, total, nil
}

// GetFollowingList 获取指定用户关注的人列表
func GetFollowingList(userID uuid.UUID) ([]UserRow, error) {
	var rows []UserRow
	err := conf.DB.Raw(`
SELECT u.user_id, u.username, u.bio, u.profile_picture
FROM follows f
JOIN users u ON f.followee_id = u.user_id
WHERE f.follower_id = ?`, userID).Scan(&rows).Error
	if rows == nil {
		rows = []UserRow{}
	}
	return rows, err
}

// DeleteAccount 在单个事务内完成账号注销的全部数据库操作：
// 软删除帖子与评论、物理删除点赞与关注、匿名化用户记录。
func DeleteAccount(userID uuid.UUID) error {
	return conf.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// 1. 软删除该用户所有帖子
		if err := tx.Model(&model.Post{}).
			Where("user_id = ? AND deleted_at IS NULL", userID).
			Update("deleted_at", now).Error; err != nil {
			return fmt.Errorf("软删除帖子失败: %w", err)
		}

		// 2. 软删除该用户所有评论
		if err := tx.Model(&model.Comment{}).
			Where("user_id = ? AND deleted_at IS NULL", userID).
			Update("deleted_at", now).Error; err != nil {
			return fmt.Errorf("软删除评论失败: %w", err)
		}

		// 3. 删除该用户所有点赞记录
		if err := tx.Where("user_id = ?", userID).Delete(&model.Like{}).Error; err != nil {
			return fmt.Errorf("删除点赞记录失败: %w", err)
		}

		// 4. 删除该用户所有关注关系（关注者与被关注者）
		if err := tx.Where("follower_id = ? OR followee_id = ?", userID, userID).
			Delete(&model.Follow{}).Error; err != nil {
			return fmt.Errorf("删除关注关系失败: %w", err)
		}

		// 5. 匿名化用户记录（保留行避免外键孤儿问题）
		placeholder := "deleted_" + userID.String()
		if err := tx.Model(&model.User{}).
			Where("user_id = ?", userID).
			Updates(map[string]interface{}{
				"username":        placeholder,
				"email":           placeholder + "@deleted.invalid",
				"password_hash":   "",
				"profile_picture": "",
				"bio":             "",
			}).Error; err != nil {
			return fmt.Errorf("匿名化用户失败: %w", err)
		}

		return nil
	})
}

// GetFollowersList 获取关注指定用户的人列表（粉丝）
func GetFollowersList(userID uuid.UUID) ([]UserRow, error) {
	var rows []UserRow
	err := conf.DB.Raw(`
SELECT u.user_id, u.username, u.bio, u.profile_picture
FROM follows f
JOIN users u ON f.follower_id = u.user_id
WHERE f.followee_id = ?`, userID).Scan(&rows).Error
	if rows == nil {
		rows = []UserRow{}
	}
	return rows, err
}
