package dao

import (
	"github.com/google/uuid"

	"my-backend/conf"
)

// UserStatsRow 用户统计信息（来自 user_stats 视图）
type UserStatsRow struct {
	UserID         string `gorm:"column:user_id"`
	Username       string `gorm:"column:username"`
	Email          string `gorm:"column:email"`
	ProfilePicture string `gorm:"column:profile_picture"`
	Bio            string `gorm:"column:bio"`
	PostCount      int64  `gorm:"column:post_count"`
	FollowingCount int64  `gorm:"column:following_count"`
	FollowerCount  int64  `gorm:"column:follower_count"`
}

// HotTagRow 热门标签（数据库查询结果）
type HotTagRow struct {
	TagName   string `gorm:"column:tag_name"`
	PostCount int64  `gorm:"column:post_count"`
}

// RecommendedUserRow 推荐用户
type RecommendedUserRow struct {
	UserID         string `gorm:"column:user_id"`
	Username       string `gorm:"column:username"`
	Bio            string `gorm:"column:bio"`
	ProfilePicture string `gorm:"column:profile_picture"`
}

// GetUserStats 从 user_stats 视图获取用户统计信息，未找到返回 (nil, nil)。
func GetUserStats(userID uuid.UUID) (*UserStatsRow, error) {
	var rows []UserStatsRow
	err := conf.DB.Raw(`
SELECT user_id, username, email, profile_picture, bio,
	post_count, following_count, follower_count
FROM user_stats
WHERE user_id = ?`, userID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

// GetHotTagsFromDB 从数据库实时统计热门标签（top 10，按帖子数降序）。
func GetHotTagsFromDB() ([]HotTagRow, error) {
	var rows []HotTagRow
	err := conf.DB.Raw(`
SELECT t.tag_name, COUNT(pt.post_id) AS post_count
FROM tags t
JOIN post_tags pt ON t.tag_id = pt.tag_id
JOIN posts p ON pt.post_id = p.post_id AND p.deleted_at IS NULL
GROUP BY t.tag_name
ORDER BY post_count DESC
LIMIT 10`).Scan(&rows).Error
	if rows == nil {
		rows = []HotTagRow{}
	}
	return rows, err
}

// GetRecommendedUsers 获取推荐用户（排除当前用户及已关注的用户，最多 limit 条）。
func GetRecommendedUsers(currentUserID uuid.UUID, limit int) ([]RecommendedUserRow, error) {
	var rows []RecommendedUserRow
	err := conf.DB.Raw(`
SELECT u.user_id, u.username, u.bio, u.profile_picture
FROM users u
WHERE u.user_id != ?
  AND u.user_id NOT IN (
      SELECT followee_id FROM follows WHERE follower_id = ?
  )
LIMIT ?`, currentUserID, currentUserID, limit).Scan(&rows).Error
	if rows == nil {
		rows = []RecommendedUserRow{}
	}
	return rows, err
}
