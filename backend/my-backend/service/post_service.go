package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"my-backend/conf"
	"my-backend/dao"
	"my-backend/model"
)

// ========== 哨兵错误 ==========

var (
	ErrPostNotFound    = errors.New("帖子不存在或已删除")
	ErrPostForbidden   = errors.New("无权操作该帖子")
	ErrCommentNotFound = errors.New("评论不存在或已删除")
	ErrCommentForbidden = errors.New("无权操作该评论")
	ErrAlreadyLiked    = errors.New("已经点赞过了")
	ErrNotLiked        = errors.New("尚未点赞")
)

// ========== 请求结构体 ==========

type CreatePostRequest struct {
	Content    string   `json:"content"     binding:"required,min=1"`
	ImageURLs  []string `json:"image_urls"`
	Tags       []string `json:"tags"`
	Visibility string   `json:"visibility"` // public | followers | private，默认 public
}

type UpdatePostRequest struct {
	Content   string    `json:"content"    binding:"required,min=1"`
	ImageURLs []string  `json:"image_urls"`
	// Tags 为 nil 时表示不修改标签；传空数组 [] 表示清空所有标签。
	Tags       *[]string `json:"tags"`
	// Visibility 为 nil 时不修改可见性。
	Visibility *string   `json:"visibility"`
}

type CreateCommentRequest struct {
	Content  string  `json:"content"   binding:"required,min=1"`
	ParentID *string `json:"parent_id"`
}

// ========== 响应结构体 ==========

// HotTag 热门标签响应
type HotTag struct {
	TagName   string `json:"tag_name"`
	PostCount int64  `json:"post_count"`
}

// RecommendedUser 推荐用户响应
type RecommendedUser struct {
	UserID         string `json:"user_id"`
	Username       string `json:"username"`
	Bio            string `json:"bio,omitempty"`
	ProfilePicture string `json:"profile_picture,omitempty"`
}

// HomeFeedResult GetHomeFeed 返回结果
type HomeFeedResult struct {
	UserCard         *dao.UserStatsRow
	Posts            []dao.PostRow
	NextCursor       string
	HotTags          []HotTag
	RecommendedUsers []RecommendedUser
}

// PostFeedResult GetMorePosts 返回结果
type PostFeedResult struct {
	Posts      []dao.PostRow
	NextCursor string
	HasMore    bool
}

// ========== GetHomeFeed：获取首页全量数据 ==========

func GetHomeFeed(currentUserID uuid.UUID, sort string) (*HomeFeedResult, error) {
	ctx := context.Background()

	// 1. 用户卡片（含统计）
	userCard, err := dao.GetUserStats(currentUserID)
	if err != nil {
		return nil, fmt.Errorf("查询用户信息失败: %w", err)
	}

	// 2. 最新 20 条帖子（无游标）
	var posts []dao.PostRow
	if sort == "community" {
		posts, err = dao.GetPostFeedWeighted(currentUserID, 0, 20)
	} else {
		posts, err = dao.GetPostFeed(currentUserID, time.Time{}, 20)
	}
	if err != nil {
		return nil, fmt.Errorf("查询帖子失败: %w", err)
	}

	nextCursor := ""
	if len(posts) == 20 {
		if sort == "community" {
			nextCursor = "20"
		} else {
			nextCursor = posts[len(posts)-1].CreatedAt.UTC().Format(time.RFC3339Nano)
		}
	}

	// 3. 热门标签（Cache-Aside）
	hotTags, err := getHotTags(ctx)
	if err != nil {
		hotTags = []HotTag{} // 降级处理
	}

	// 4. 推荐用户（Cache-Aside）
	recommendedUsers, err := getRecommendedUsers(ctx, currentUserID)
	if err != nil {
		recommendedUsers = []RecommendedUser{}
	}

	return &HomeFeedResult{
		UserCard:         userCard,
		Posts:            posts,
		NextCursor:       nextCursor,
		HotTags:          hotTags,
		RecommendedUsers: recommendedUsers,
	}, nil
}

// ========== GetMorePosts：无限滚动加载更多帖子 ==========

// GetMorePosts 根据排序模式获取更多帖子。
// sort="timeline"：cursorStr 为 RFC3339Nano 时间戳；sort="community"：cursorStr 为 OFFSET 整数字符串。
func GetMorePosts(currentUserID uuid.UUID, cursorStr string, limit int, sort string) (*PostFeedResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	var posts []dao.PostRow
	var err error
	nextCursor := ""

	if sort == "community" {
		offset := 0
		if cursorStr != "" {
			if v, e := strconv.Atoi(cursorStr); e == nil && v >= 0 {
				offset = v
			}
		}
		posts, err = dao.GetPostFeedWeighted(currentUserID, offset, limit)
		if err != nil {
			return nil, fmt.Errorf("查询帖子失败: %w", err)
		}
		if len(posts) == limit {
			nextCursor = strconv.Itoa(offset + limit)
		}
	} else {
		var cursor time.Time
		if cursorStr != "" {
			cursor, err = time.Parse(time.RFC3339Nano, cursorStr)
			if err != nil {
				return nil, fmt.Errorf("游标格式错误: %w", err)
			}
		}
		posts, err = dao.GetPostFeed(currentUserID, cursor, limit)
		if err != nil {
			return nil, fmt.Errorf("查询帖子失败: %w", err)
		}
		if len(posts) == limit {
			nextCursor = posts[len(posts)-1].CreatedAt.UTC().Format(time.RFC3339Nano)
		}
	}

	hasMore := len(posts) == limit
	return &PostFeedResult{
		Posts:      posts,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// ========== CreatePost：创建帖子 ==========

func CreatePost(currentUserID uuid.UUID, req CreatePostRequest) (*model.Post, []string, error) {
	ctx := context.Background()

	imageURLs := pq.StringArray(req.ImageURLs)
	if imageURLs == nil {
		imageURLs = pq.StringArray{}
	}

	visibility := req.Visibility
	if visibility == "" {
		visibility = "public"
	}

	post := &model.Post{
		UserID:     currentUserID,
		Content:    req.Content,
		ImageURLs:  imageURLs,
		Visibility: visibility,
	}

	tags := dedupStrings(req.Tags)
	if err := dao.CreatePost(post, tags); err != nil {
		return nil, nil, fmt.Errorf("创建帖子失败: %w", err)
	}

	// 更新 Redis 热门标签（ZINCRBY，不删除整个 Key）
	for _, tag := range tags {
		if tag != "" {
			conf.RDB.ZIncrBy(ctx, "hot:tags", 1, tag)
		}
	}

	return post, tags, nil
}

// ========== UpdatePost：编辑帖子（仅作者） ==========

// UpdatePostResult 编辑帖子返回结果（Tags 仅在请求中提供 Tags 字段时非 nil）
type UpdatePostResult struct {
	Tags []string // 更新后的最终标签列表；req.Tags 为 nil 时此字段为 nil
}

func UpdatePost(currentUserID uuid.UUID, postID uuid.UUID, req UpdatePostRequest) (*UpdatePostResult, error) {
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return nil, fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return nil, ErrPostNotFound
	}
	if post.UserID != currentUserID {
		return nil, ErrPostForbidden
	}

	imageURLs := pq.StringArray(req.ImageURLs)
	if imageURLs == nil {
		imageURLs = pq.StringArray{}
	}

	updateTags := req.Tags != nil
	var newTagNames []string
	if updateTags {
		newTagNames = dedupStrings(*req.Tags)
	}

	updateVisibility := req.Visibility != nil
	visibility := ""
	if updateVisibility {
		visibility = *req.Visibility
	}

	added, removed, err := dao.UpdatePostFull(postID, req.Content, imageURLs, visibility, updateVisibility, newTagNames, updateTags)
	if err != nil {
		return nil, fmt.Errorf("更新帖子失败: %w", err)
	}

	// 增量更新 Redis 热门标签
	if updateTags {
		ctx := context.Background()
		for _, tag := range added {
			conf.RDB.ZIncrBy(ctx, "hot:tags", 1, tag)
		}
		for _, tag := range removed {
			conf.RDB.ZIncrBy(ctx, "hot:tags", -1, tag)
		}
	}

	result := &UpdatePostResult{}
	if updateTags {
		result.Tags = newTagNames
	}
	return result, nil
}

// ========== DeletePost：软删除帖子（仅作者） ==========

func DeletePost(currentUserID uuid.UUID, postID uuid.UUID) error {
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return ErrPostNotFound
	}
	if post.UserID != currentUserID {
		return ErrPostForbidden
	}

	// 删除前先取出标签，用于后续同步 Redis 热门标签计数
	tagNames, err := dao.GetPostTagNames(postID)
	if err != nil {
		return fmt.Errorf("查询帖子标签失败: %w", err)
	}

	if err := dao.SoftDeletePost(postID); err != nil {
		return fmt.Errorf("删除帖子失败: %w", err)
	}

	// 每个标签计数 -1
	ctx := context.Background()
	for _, tag := range tagNames {
		conf.RDB.ZIncrBy(ctx, "hot:tags", -1, tag)
	}
	return nil
}

// ========== LikePost：点赞帖子 ==========

func LikePost(currentUserID uuid.UUID, postID uuid.UUID) error {
	// 检查帖子是否存在（通过 post_details 视图，已过滤软删除）
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return ErrPostNotFound
	}

	if err := dao.LikePost(currentUserID, postID); err != nil {
		if errors.Is(err, dao.ErrLikeExists) {
			return ErrAlreadyLiked
		}
		return fmt.Errorf("点赞失败: %w", err)
	}

	// 异步通知帖子作者
	go func() {
		postID := postID
		_ = dao.CreateNotification(&model.Notification{
			RecipientID: post.UserID,
			ActorID:     currentUserID,
			Type:        "like",
			PostID:      &postID,
		})
	}()
	return nil
}

// ========== UnlikePost：取消点赞 ==========

func UnlikePost(currentUserID uuid.UUID, postID uuid.UUID) error {
	if err := dao.UnlikePost(currentUserID, postID); err != nil {
		if errors.Is(err, dao.ErrLikeNotFound) {
			return ErrNotLiked
		}
		return fmt.Errorf("取消点赞失败: %w", err)
	}
	return nil
}

// ========== GetComments：获取评论列表 ==========

func GetComments(postID uuid.UUID) ([]dao.CommentRow, error) {
	// 检查帖子是否存在
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return nil, fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	comments, err := dao.GetCommentsByPostID(postID, 50)
	if err != nil {
		return nil, fmt.Errorf("查询评论失败: %w", err)
	}
	return comments, nil
}

// ========== CreateComment：发表评论 ==========

func CreateComment(currentUserID uuid.UUID, postID uuid.UUID, req CreateCommentRequest) (*dao.CommentRow, error) {
	// 检查帖子是否存在
	post, err := dao.GetPostByIDRaw(postID)
	if err != nil {
		return nil, fmt.Errorf("查询帖子失败: %w", err)
	}
	if post == nil {
		return nil, ErrPostNotFound
	}

	var parentID *uuid.UUID
	if req.ParentID != nil && *req.ParentID != "" {
		pid, err := uuid.Parse(*req.ParentID)
		if err == nil {
			parentID = &pid
		}
	}

	comment := &model.Comment{
		PostID:   postID,
		UserID:   currentUserID,
		ParentID: parentID,
		Content:  req.Content,
	}
	row, err := dao.CreateComment(comment)
	if err != nil {
		return nil, fmt.Errorf("创建评论失败: %w", err)
	}

	// 异步通知：评论帖子作者（comment）；回复时通知父评论作者（reply）
	go func() {
		postID := postID
		// 通知帖子作者
		_ = dao.CreateNotification(&model.Notification{
			RecipientID: post.UserID,
			ActorID:     currentUserID,
			Type:        "comment",
			PostID:      &postID,
		})
		// 若是回复，额外通知父评论作者
		if parentID != nil {
			parent, err := dao.GetCommentByID(*parentID)
			if err == nil && parent != nil {
				_ = dao.CreateNotification(&model.Notification{
					RecipientID: parent.UserID,
					ActorID:     currentUserID,
					Type:        "reply",
					PostID:      &postID,
				})
			}
		}
	}()
	return row, nil
}

// ========== DeleteComment：软删除评论（仅作者） ==========

func DeleteComment(currentUserID uuid.UUID, commentID uuid.UUID) error {
	comment, err := dao.GetCommentByID(commentID)
	if err != nil {
		return fmt.Errorf("查询评论失败: %w", err)
	}
	if comment == nil {
		return ErrCommentNotFound
	}
	if comment.UserID != currentUserID {
		return ErrCommentForbidden
	}

	if err := dao.SoftDeleteComment(commentID); err != nil {
		return fmt.Errorf("删除评论失败: %w", err)
	}
	return nil
}

// ========== 内部辅助：Redis Cache-Aside ==========

// getHotTags 从 Redis 获取热门标签，Miss 时从 DB 加载并写缓存。
func getHotTags(ctx context.Context) ([]HotTag, error) {
	// 尝试从 Redis 读取
	result, err := conf.RDB.ZRevRangeWithScores(ctx, "hot:tags", 0, 9).Result()
	if err == nil && len(result) > 0 {
		tags := make([]HotTag, len(result))
		for i, z := range result {
			tags[i] = HotTag{
				TagName:   fmt.Sprintf("%v", z.Member),
				PostCount: int64(z.Score),
			}
		}
		return tags, nil
	}

	// Cache Miss：从数据库查询
	rows, err := dao.GetHotTagsFromDB()
	if err != nil {
		return nil, err
	}

	// 写入 Redis（SET NX 不适用，直接 ZADD + EXPIRE）
	if len(rows) > 0 {
		members := make([]redis.Z, len(rows))
		for i, r := range rows {
			members[i] = redis.Z{Score: float64(r.PostCount), Member: r.TagName}
		}
		conf.RDB.ZAdd(ctx, "hot:tags", members...)
		conf.RDB.Expire(ctx, "hot:tags", 5*time.Minute)
	}

	tags := make([]HotTag, len(rows))
	for i, r := range rows {
		tags[i] = HotTag{TagName: r.TagName, PostCount: r.PostCount}
	}
	return tags, nil
}

// getRecommendedUsers 从 Redis 获取推荐用户，Miss 时从 DB 加载并写缓存。
func getRecommendedUsers(ctx context.Context, currentUserID uuid.UUID) ([]RecommendedUser, error) {
	key := "recommend:users:" + currentUserID.String()

	// 尝试从 Redis 读取
	cached, err := conf.RDB.Get(ctx, key).Result()
	if err == nil {
		var users []RecommendedUser
		if json.Unmarshal([]byte(cached), &users) == nil {
			return users, nil
		}
	}

	// Cache Miss：从数据库查询
	rows, err := dao.GetRecommendedUsers(currentUserID, 5)
	if err != nil {
		return nil, err
	}

	users := make([]RecommendedUser, 0, len(rows))
	for _, r := range rows {
		u := RecommendedUser{
			UserID:   r.UserID,
			Username: r.Username,
		}
		if r.Bio != "" {
			u.Bio = r.Bio
		}
		if r.ProfilePicture != "" {
			u.ProfilePicture = r.ProfilePicture
		}
		users = append(users, u)
	}

	// 写入 Redis
	if data, err := json.Marshal(users); err == nil {
		conf.RDB.Set(ctx, key, data, 10*time.Minute)
	}

	return users, nil
}

// ========== SearchPosts：全文搜索帖子 ==========

func SearchPosts(currentUserID uuid.UUID, q string, cursorStr string, limit int) (*PostFeedResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	var cursor time.Time
	if cursorStr != "" {
		var err error
		cursor, err = time.Parse(time.RFC3339Nano, cursorStr)
		if err != nil {
			return nil, fmt.Errorf("游标格式错误: %w", err)
		}
	}

	posts, err := dao.SearchPostsByFullText(q, currentUserID, cursor, limit)
	if err != nil {
		return nil, fmt.Errorf("搜索帖子失败: %w", err)
	}

	nextCursor := ""
	hasMore := len(posts) == limit
	if hasMore {
		nextCursor = posts[len(posts)-1].CreatedAt.UTC().Format(time.RFC3339Nano)
	}

	return &PostFeedResult{Posts: posts, NextCursor: nextCursor, HasMore: hasMore}, nil
}

// ========== GetTagPosts：按标签获取帖子 ==========

// TagPostsResult 按标签查帖子返回结果
type TagPostsResult struct {
	TagName    string
	Posts      []dao.PostRow
	NextCursor string
	HasMore    bool
}

func GetTagPosts(currentUserID uuid.UUID, tagName string, cursorStr string, limit int) (*TagPostsResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	var cursor time.Time
	if cursorStr != "" {
		var err error
		cursor, err = time.Parse(time.RFC3339Nano, cursorStr)
		if err != nil {
			return nil, fmt.Errorf("游标格式错误: %w", err)
		}
	}

	posts, err := dao.GetPostsByTagName(tagName, currentUserID, cursor, limit)
	if err != nil {
		return nil, fmt.Errorf("查询标签帖子失败: %w", err)
	}

	nextCursor := ""
	hasMore := len(posts) == limit
	if hasMore {
		nextCursor = posts[len(posts)-1].CreatedAt.UTC().Format(time.RFC3339Nano)
	}

	return &TagPostsResult{
		TagName:    tagName,
		Posts:      posts,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	}, nil
}

// dedupStrings 去重字符串切片（保持顺序，过滤空字符串）
func dedupStrings(ss []string) []string {
	seen := make(map[string]struct{})
	result := make([]string, 0, len(ss))
	for _, s := range ss {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			result = append(result, s)
		}
	}
	return result
}
