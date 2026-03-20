package dao

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"my-backend/conf"
	"my-backend/model"
)

// PostRow 帖子视图查询结果（含 is_liked 和 tags）
type PostRow struct {
	PostID         string         `gorm:"column:post_id"`
	UserID         string         `gorm:"column:user_id"`
	Username       string         `gorm:"column:username"`
	ProfilePicture string         `gorm:"column:profile_picture"`
	Content        string         `gorm:"column:content"`
	ImageURLs      pq.StringArray `gorm:"column:image_urls"`
	CreatedAt      time.Time      `gorm:"column:created_at"`
	LikeCount      int64          `gorm:"column:like_count"`
	CommentCount   int64          `gorm:"column:comment_count"`
	IsLiked        bool           `gorm:"column:is_liked"`
	Tags           pq.StringArray `gorm:"column:tags"`
	Visibility     string         `gorm:"column:visibility"`
}

// CommentRow 评论查询结果（含用户信息）
type CommentRow struct {
	CommentID      string    `gorm:"column:comment_id"`
	ParentID       *string   `gorm:"column:parent_id"`
	Content        string    `gorm:"column:content"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UserID         string    `gorm:"column:user_id"`
	Username       string    `gorm:"column:username"`
	ProfilePicture string    `gorm:"column:profile_picture"`
}

// ErrLikeExists 已点赞
var ErrLikeExists = errors.New("已经点赞过了")

// ErrLikeNotFound 未点赞
var ErrLikeNotFound = errors.New("尚未点赞")

// postSelectSQL 帖子列表查询前半段（含 is_liked 和 tags 聚合）
// 占位符 ? 顺序：currentUserID
const postSelectSQL = `
SELECT
	pd.post_id, pd.user_id, pd.username, pd.profile_picture,
	pd.content, pd.image_urls, pd.created_at, pd.like_count, pd.comment_count,
	pd.visibility,
	CASE WHEN lk.user_id IS NOT NULL THEN true ELSE false END AS is_liked,
	COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), ARRAY[]::text[]) AS tags
FROM post_details pd
LEFT JOIN likes lk ON pd.post_id = lk.post_id AND lk.user_id = ?
LEFT JOIN post_tags pt ON pd.post_id = pt.post_id
LEFT JOIN tags t ON pt.tag_id = t.tag_id
`

// visibilityCondSQL 可见性过滤条件（不含 WHERE / AND 前缀）
// 占位符顺序：currentUserID（作者判断）, currentUserID（关注者判断）
const visibilityCondSQL = `(pd.user_id = ? OR pd.visibility = 'public' OR (pd.visibility = 'followers' AND EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = pd.user_id)))`

const postGroupSQL = `
GROUP BY pd.post_id, pd.user_id, pd.username, pd.profile_picture,
	pd.content, pd.image_urls, pd.created_at, pd.like_count, pd.comment_count, lk.user_id,
	pd.visibility
ORDER BY pd.created_at DESC
LIMIT ?
`

// postGroupWeightedSQL 加权排序分组（HackerNews 衰减）
// 占位符顺序：limit, offset
const postGroupWeightedSQL = `
GROUP BY pd.post_id, pd.user_id, pd.username, pd.profile_picture,
	pd.content, pd.image_urls, pd.created_at, pd.like_count, pd.comment_count, lk.user_id,
	pd.visibility
ORDER BY
	(pd.like_count * 2 + pd.comment_count * 3)
	/ POWER(EXTRACT(EPOCH FROM (NOW() - pd.created_at)) / 3600 + 2, 1.5)
DESC
LIMIT ?
OFFSET ?
`

// GetPostFeed 获取帖子 Feed（时间线，游标分页，含可见性过滤）。
func GetPostFeed(currentUserID uuid.UUID, cursor time.Time, limit int) ([]PostRow, error) {
	base := postSelectSQL + "WHERE " + visibilityCondSQL
	var query string
	var args []interface{}
	if cursor.IsZero() {
		query = base + postGroupSQL
		args = []interface{}{currentUserID, currentUserID, currentUserID, limit}
	} else {
		query = base + " AND pd.created_at < ?" + postGroupSQL
		args = []interface{}{currentUserID, currentUserID, currentUserID, cursor, limit}
	}

	var rows []PostRow
	if err := conf.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PostRow{}
	}
	return rows, nil
}

// GetPostFeedWeighted 获取帖子 Feed（社区加权排序，OFFSET 分页，含可见性过滤）。
// 使用 HackerNews 衰减算法：score = (likes*2 + comments*3) / (age_hours+2)^1.5
func GetPostFeedWeighted(currentUserID uuid.UUID, offset int, limit int) ([]PostRow, error) {
	query := postSelectSQL + "WHERE " + visibilityCondSQL + postGroupWeightedSQL
	args := []interface{}{currentUserID, currentUserID, currentUserID, limit, offset}

	var rows []PostRow
	if err := conf.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PostRow{}
	}
	return rows, nil
}

// GetPostsByUserID 获取指定用户发布的帖子（用于用户主页，游标分页，含可见性过滤）。
func GetPostsByUserID(authorID, currentUserID uuid.UUID, cursor time.Time, limit int) ([]PostRow, error) {
	base := postSelectSQL + "WHERE " + visibilityCondSQL + " AND pd.user_id = ?"
	var query string
	var args []interface{}
	if cursor.IsZero() {
		query = base + postGroupSQL
		args = []interface{}{currentUserID, currentUserID, currentUserID, authorID, limit}
	} else {
		query = base + " AND pd.created_at < ?" + postGroupSQL
		args = []interface{}{currentUserID, currentUserID, currentUserID, authorID, cursor, limit}
	}

	var rows []PostRow
	if err := conf.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PostRow{}
	}
	return rows, nil
}

// GetPostsByTagName 按标签名获取帖子（游标分页，含可见性过滤）。
func GetPostsByTagName(tagName string, currentUserID uuid.UUID, cursor time.Time, limit int) ([]PostRow, error) {
	tagJoin := `
JOIN post_tags pt2 ON pd.post_id = pt2.post_id
JOIN tags t2 ON pt2.tag_id = t2.tag_id AND t2.tag_name = ?
`
	base := postSelectSQL + tagJoin + "WHERE " + visibilityCondSQL
	var query string
	var args []interface{}
	if cursor.IsZero() {
		query = base + postGroupSQL
		args = []interface{}{currentUserID, tagName, currentUserID, currentUserID, limit}
	} else {
		query = base + " AND pd.created_at < ?" + postGroupSQL
		args = []interface{}{currentUserID, tagName, currentUserID, currentUserID, cursor, limit}
	}

	var rows []PostRow
	if err := conf.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PostRow{}
	}
	return rows, nil
}

// SearchPostsByFullText 全文搜索帖子（游标分页，含可见性过滤）。
func SearchPostsByFullText(q string, currentUserID uuid.UUID, cursor time.Time, limit int) ([]PostRow, error) {
	base := postSelectSQL + "WHERE pd.content_tsv @@ plainto_tsquery('simple', ?) AND " + visibilityCondSQL
	var query string
	var args []interface{}
	if cursor.IsZero() {
		query = base + postGroupSQL
		args = []interface{}{currentUserID, q, currentUserID, currentUserID, limit}
	} else {
		query = base + " AND pd.created_at < ?" + postGroupSQL
		args = []interface{}{currentUserID, q, currentUserID, currentUserID, cursor, limit}
	}

	var rows []PostRow
	if err := conf.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []PostRow{}
	}
	return rows, nil
}

// GetPostTagNames 获取帖子的标签名列表，供删除时同步清理 Redis 热门标签计数。
func GetPostTagNames(postID uuid.UUID) ([]string, error) {
	var rows []struct {
		TagName string `gorm:"column:tag_name"`
	}
	err := conf.DB.Raw(`
SELECT t.tag_name
FROM tags t
JOIN post_tags pt ON t.tag_id = pt.tag_id
WHERE pt.post_id = ?`, postID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.TagName
	}
	return names, nil
}

// GetPostByIDRaw 根据帖子 ID 从 posts 表查询（仅未软删除记录），用于权限校验。
// 未找到或已删除返回 (nil, nil)。
func GetPostByIDRaw(postID uuid.UUID) (*model.Post, error) {
	var post model.Post
	err := conf.DB.Where("post_id = ? AND deleted_at IS NULL", postID).First(&post).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &post, err
}

// CreatePost 在事务中创建帖子并关联标签（find-or-create）。
func CreatePost(post *model.Post, tagNames []string) error {
	return conf.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(post).Error; err != nil {
			return fmt.Errorf("创建帖子失败: %w", err)
		}
		for _, name := range tagNames {
			if name == "" {
				continue
			}
			tag := model.Tag{TagName: name}
			if err := tx.Where("tag_name = ?", name).FirstOrCreate(&tag).Error; err != nil {
				return fmt.Errorf("创建标签失败: %w", err)
			}
			postTag := model.PostTag{PostID: post.PostID, TagID: tag.TagID}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&postTag).Error; err != nil {
				return fmt.Errorf("关联标签失败: %w", err)
			}
		}
		return nil
	})
}

// UpdatePostFull 在事务中更新帖子内容、图片与可见性；若 updateTags=true 同时替换标签关联。
// 返回本次新增的标签名（added）和删除的标签名（removed），供上层增量更新 Redis 热门标签。
func UpdatePostFull(postID uuid.UUID, content string, imageURLs pq.StringArray, visibility string, updateVisibility bool, newTagNames []string, updateTags bool) (added, removed []string, err error) {
	err = conf.DB.Transaction(func(tx *gorm.DB) error {
		// 更新 posts 表基本字段
		updates := map[string]interface{}{
			"content":    content,
			"image_urls": imageURLs,
		}
		if updateVisibility {
			updates["visibility"] = visibility
		}
		if e := tx.Model(&model.Post{}).
			Where("post_id = ?", postID).
			Updates(updates).Error; e != nil {
			return fmt.Errorf("更新帖子内容失败: %w", e)
		}

		if !updateTags {
			return nil
		}

		// 查询当前标签集合
		var currentRows []struct {
			TagName string `gorm:"column:tag_name"`
		}
		if e := tx.Raw(`
SELECT t.tag_name
FROM tags t
JOIN post_tags pt ON t.tag_id = pt.tag_id
WHERE pt.post_id = ?`, postID).Scan(&currentRows).Error; e != nil {
			return fmt.Errorf("查询现有标签失败: %w", e)
		}
		currentSet := make(map[string]bool, len(currentRows))
		for _, r := range currentRows {
			currentSet[r.TagName] = true
		}

		// 构建新标签集合（去重、过滤空字符串）
		newSet := make(map[string]bool, len(newTagNames))
		for _, name := range newTagNames {
			if name != "" {
				newSet[name] = true
			}
		}

		// 计算 diff
		for name := range newSet {
			if !currentSet[name] {
				added = append(added, name)
			}
		}
		for name := range currentSet {
			if !newSet[name] {
				removed = append(removed, name)
			}
		}

		// 删除旧关联
		if e := tx.Where("post_id = ?", postID).Delete(&model.PostTag{}).Error; e != nil {
			return fmt.Errorf("删除旧标签关联失败: %w", e)
		}

		// 插入新关联（find-or-create 标签）
		for name := range newSet {
			tag := model.Tag{TagName: name}
			if e := tx.Where("tag_name = ?", name).FirstOrCreate(&tag).Error; e != nil {
				return fmt.Errorf("创建标签失败: %w", e)
			}
			postTag := model.PostTag{PostID: postID, TagID: tag.TagID}
			if e := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&postTag).Error; e != nil {
				return fmt.Errorf("关联标签失败: %w", e)
			}
		}
		return nil
	})
	return
}

// SoftDeletePost 软删除帖子（写入 deleted_at）。
func SoftDeletePost(postID uuid.UUID) error {
	now := time.Now()
	return conf.DB.Model(&model.Post{}).
		Where("post_id = ?", postID).
		Update("deleted_at", now).Error
}

// LikePost 点赞帖子。若已点赞（ON CONFLICT DO NOTHING 影响行数为 0）返回 ErrLikeExists。
func LikePost(userID, postID uuid.UUID) error {
	like := model.Like{UserID: userID, PostID: postID}
	result := conf.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&like)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrLikeExists
	}
	return nil
}

// UnlikePost 取消点赞。若未点赞（影响行数为 0）返回 ErrLikeNotFound。
func UnlikePost(userID, postID uuid.UUID) error {
	result := conf.DB.
		Where("user_id = ? AND post_id = ?", userID, postID).
		Delete(&model.Like{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrLikeNotFound
	}
	return nil
}

// GetCommentsByPostID 获取帖子的评论列表（正序，已软删除不返回，最多 limit 条）。
func GetCommentsByPostID(postID uuid.UUID, limit int) ([]CommentRow, error) {
	var rows []CommentRow
	query := `
SELECT c.comment_id, c.parent_id, c.content, c.created_at, c.user_id, u.username, u.profile_picture
FROM comments c
JOIN users u ON c.user_id = u.user_id
WHERE c.post_id = ? AND c.deleted_at IS NULL
ORDER BY c.created_at ASC
LIMIT ?
`
	if err := conf.DB.Raw(query, postID, limit).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []CommentRow{}
	}
	return rows, nil
}

// GetCommentByID 根据 ID 查询评论（仅未软删除），未找到返回 (nil, nil)。
func GetCommentByID(commentID uuid.UUID) (*model.Comment, error) {
	var comment model.Comment
	err := conf.DB.Where("comment_id = ? AND deleted_at IS NULL", commentID).First(&comment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &comment, err
}

// CreateComment 创建评论，并返回含用户信息的 CommentRow。
func CreateComment(comment *model.Comment) (*CommentRow, error) {
	if err := conf.DB.Create(comment).Error; err != nil {
		return nil, fmt.Errorf("创建评论失败: %w", err)
	}
	var row CommentRow
	query := `
SELECT c.comment_id, c.parent_id, c.content, c.created_at, c.user_id, u.username, u.profile_picture
FROM comments c
JOIN users u ON c.user_id = u.user_id
WHERE c.comment_id = ?
`
	if err := conf.DB.Raw(query, comment.CommentID).Scan(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// SoftDeleteComment 软删除评论（写入 deleted_at）。
func SoftDeleteComment(commentID uuid.UUID) error {
	now := time.Now()
	return conf.DB.Model(&model.Comment{}).
		Where("comment_id = ?", commentID).
		Update("deleted_at", now).Error
}
