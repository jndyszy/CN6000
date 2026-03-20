package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"

	"my-backend/dao"
	"my-backend/service"
)

// ========== 辅助函数 ==========

// ensureStrSlice 将 pq.StringArray 转为 []string，nil 时返回空切片。
func ensureStrSlice(s pq.StringArray) []string {
	if s == nil {
		return []string{}
	}
	return []string(s)
}

// postRowToJSON 将 PostRow 转换为符合 API 文档的 JSON map。
// profile_picture 为空时不返回该字段（omitempty 语义）。
func postRowToJSON(row dao.PostRow) gin.H {
	resp := gin.H{
		"post_id":       row.PostID,
		"user_id":       row.UserID,
		"username":      row.Username,
		"content":       row.Content,
		"image_urls":    ensureStrSlice(row.ImageURLs),
		"created_at":    row.CreatedAt,
		"like_count":    row.LikeCount,
		"comment_count": row.CommentCount,
		"is_liked":      row.IsLiked,
		"tags":          ensureStrSlice(row.Tags),
		"visibility":    row.Visibility,
	}
	if row.ProfilePicture != "" {
		resp["profile_picture"] = row.ProfilePicture
	}
	return resp
}

// commentRowToJSON 将 CommentRow 转换为符合 API 文档的 JSON map。
func commentRowToJSON(row dao.CommentRow) gin.H {
	resp := gin.H{
		"comment_id": row.CommentID,
		"parent_id":  row.ParentID,
		"content":    row.Content,
		"created_at": row.CreatedAt,
		"user_id":    row.UserID,
		"username":   row.Username,
	}
	if row.ProfilePicture != "" {
		resp["profile_picture"] = row.ProfilePicture
	}
	return resp
}

// parseUUID 解析路径参数中的 UUID，失败时写 400 响应并返回 false。
func parseUUID(c *gin.Context, param string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(param))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 ID 格式"})
		return uuid.Nil, false
	}
	return id, true
}

// currentUserID 从 Context 中获取当前登录用户 ID（已由 AuthMiddleware 注入）。
func currentUserID(c *gin.Context) uuid.UUID {
	id, _ := uuid.Parse(c.GetString("user_id"))
	return id
}

// ========== API 6：GET /api/feed/home ==========

func GetHomeFeed(c *gin.Context) {
	userID := currentUserID(c)

	sort := c.Query("sort")
	if sort != "community" {
		sort = "timeline"
	}

	result, err := service.GetHomeFeed(userID, sort)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}

	// 构造 posts 列表
	postList := make([]gin.H, len(result.Posts))
	for i, p := range result.Posts {
		postList[i] = postRowToJSON(p)
	}

	// 构造 user_card
	uc := result.UserCard
	userCard := gin.H{
		"user_id":         uc.UserID,
		"username":        uc.Username,
		"email":           uc.Email,
		"profile_picture": uc.ProfilePicture,
		"post_count":      uc.PostCount,
		"following_count": uc.FollowingCount,
		"follower_count":  uc.FollowerCount,
	}

	c.JSON(http.StatusOK, gin.H{
		"user_card":         userCard,
		"posts":             postList,
		"next_cursor":       result.NextCursor,
		"hot_tags":          result.HotTags,
		"recommended_users": result.RecommendedUsers,
	})
}

// ========== API 7：GET /api/feed/posts ==========

func GetMorePosts(c *gin.Context) {
	userID := currentUserID(c)

	cursorStr := c.Query("cursor")
	limit := 20
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}
	sort := c.Query("sort")
	if sort != "community" {
		sort = "timeline"
	}

	result, err := service.GetMorePosts(userID, cursorStr, limit, sort)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postList := make([]gin.H, len(result.Posts))
	for i, p := range result.Posts {
		postList[i] = postRowToJSON(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":       postList,
		"next_cursor": result.NextCursor,
		"has_more":    result.HasMore,
	})
}

// ========== API 8：POST /api/posts ==========

func CreatePost(c *gin.Context) {
	userID := currentUserID(c)

	var req service.CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	post, tags, err := service.CreatePost(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}

	imageURLs := []string(post.ImageURLs)
	if imageURLs == nil {
		imageURLs = []string{}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "发布成功",
		"post": gin.H{
			"post_id":    post.PostID,
			"user_id":    post.UserID,
			"content":    post.Content,
			"image_urls": imageURLs,
			"created_at": post.CreatedAt,
			"tags":       tags,
			"visibility": post.Visibility,
		},
	})
}

// ========== API 9：PUT /api/posts/:id ==========

func UpdatePost(c *gin.Context) {
	userID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req service.UpdatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := service.UpdatePost(userID, postID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrPostForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	imageURLs := req.ImageURLs
	if imageURLs == nil {
		imageURLs = []string{}
	}

	postResp := gin.H{
		"post_id":    postID,
		"content":    req.Content,
		"image_urls": imageURLs,
	}
	if result.Tags != nil {
		postResp["tags"] = result.Tags
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "更新成功",
		"post":    postResp,
	})
}

// ========== API 10：DELETE /api/posts/:id ==========

func DeletePost(c *gin.Context) {
	userID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.DeletePost(userID, postID); err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrPostForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// ========== API 11：POST /api/posts/:id/like ==========

func LikePost(c *gin.Context) {
	userID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.LikePost(userID, postID); err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrAlreadyLiked):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "点赞成功"})
}

// ========== API 12：DELETE /api/posts/:id/like ==========

func UnlikePost(c *gin.Context) {
	userID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	if err := service.UnlikePost(userID, postID); err != nil {
		switch {
		case errors.Is(err, service.ErrNotLiked):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "取消点赞成功"})
}

// ========== API 13：GET /api/posts/:id/comments ==========

func GetComments(c *gin.Context) {
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	comments, err := service.GetComments(postID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	commentList := make([]gin.H, len(comments))
	for i, cm := range comments {
		commentList[i] = commentRowToJSON(cm)
	}

	c.JSON(http.StatusOK, gin.H{"comments": commentList})
}

// ========== API 14：POST /api/posts/:id/comments ==========

func CreateComment(c *gin.Context) {
	userID := currentUserID(c)
	postID, ok := parseUUID(c, "id")
	if !ok {
		return
	}

	var req service.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	row, err := service.CreateComment(userID, postID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrPostNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "评论成功",
		"comment": commentRowToJSON(*row),
	})
}

// ========== API 23：GET /api/search/posts ==========

func SearchPosts(c *gin.Context) {
	userID := currentUserID(c)

	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供搜索关键词 q"})
		return
	}

	limit := 20
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	result, err := service.SearchPosts(userID, q, c.Query("cursor"), limit)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postList := make([]gin.H, len(result.Posts))
	for i, p := range result.Posts {
		postList[i] = postRowToJSON(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":       postList,
		"next_cursor": result.NextCursor,
		"has_more":    result.HasMore,
	})
}

// ========== API 24：GET /api/tags/:name/posts ==========

func GetTagPosts(c *gin.Context) {
	userID := currentUserID(c)
	tagName := c.Param("name")

	limit := 20
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	result, err := service.GetTagPosts(userID, tagName, c.Query("cursor"), limit)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	postList := make([]gin.H, len(result.Posts))
	for i, p := range result.Posts {
		postList[i] = postRowToJSON(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"tag_name":    result.TagName,
		"posts":       postList,
		"next_cursor": result.NextCursor,
		"has_more":    result.HasMore,
	})
}

// ========== API 15：DELETE /api/posts/:id/comments/:comment_id ==========

func DeleteComment(c *gin.Context) {
	userID := currentUserID(c)
	commentID, ok := parseUUID(c, "comment_id")
	if !ok {
		return
	}

	if err := service.DeleteComment(userID, commentID); err != nil {
		switch {
		case errors.Is(err, service.ErrCommentNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrCommentForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}
