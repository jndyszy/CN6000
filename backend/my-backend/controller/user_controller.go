package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"my-backend/dao"
	"my-backend/service"
	"my-backend/utils"
)

// userRowToJSON 将 UserRow 转换为 JSON map（bio/profile_picture 为空时不返回）
func userRowToJSON(row dao.UserRow) gin.H {
	resp := gin.H{
		"user_id":  row.UserID,
		"username": row.Username,
	}
	if row.Bio != "" {
		resp["bio"] = row.Bio
	}
	if row.ProfilePicture != "" {
		resp["profile_picture"] = row.ProfilePicture
	}
	return resp
}

// ========== DELETE /api/users/me：账号注销 ==========

func DeleteAccount(c *gin.Context) {
	userID := currentUserID(c)

	// 从 AuthMiddleware 注入的 Claims 中获取 JTI 和过期时间
	claimsVal, _ := c.Get("claims")
	claims, ok := claimsVal.(*utils.JWTClaims)
	if !ok || claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证信息"})
		return
	}

	if err := service.DeleteAccount(userID, claims.JTI, claims.ExpiresAt.Time); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "账号已注销"})
}

// ========== API 16：POST /api/users/:id/follow ==========

func FollowUser(c *gin.Context) {
	currentID := currentUserID(c)
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	if err := service.FollowUser(currentID, targetID); err != nil {
		switch {
		case errors.Is(err, service.ErrSelfFollow):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrAlreadyFollowing):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "关注成功"})
}

// ========== API 17：DELETE /api/users/:id/follow ==========

func UnfollowUser(c *gin.Context) {
	currentID := currentUserID(c)
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	if err := service.UnfollowUser(currentID, targetID); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFollowing):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "取消关注成功"})
}

// ========== API 18：GET /api/users/:id ==========

func GetUserProfile(c *gin.Context) {
	currentID := currentUserID(c)
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	result, err := service.GetUserProfile(targetID, currentID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	s := result.Stats
	postList := make([]gin.H, len(result.Posts))
	for i, p := range result.Posts {
		postList[i] = postRowToJSON(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"user_id":         s.UserID,
			"username":        s.Username,
			"email":           s.Email,
			"bio":             s.Bio,
			"profile_picture": s.ProfilePicture,
			"post_count":      s.PostCount,
			"following_count": s.FollowingCount,
			"follower_count":  s.FollowerCount,
		},
		"posts": postList,
	})
}

// ========== API 19：GET /api/users/:id/following ==========

func GetFollowing(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	users, err := service.GetFollowing(targetID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	list := make([]gin.H, len(users))
	for i, u := range users {
		list[i] = userRowToJSON(u)
	}
	c.JSON(http.StatusOK, gin.H{"users": list})
}

// ========== API 20：GET /api/users/:id/followers ==========

func GetFollowers(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	users, err := service.GetFollowers(targetID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	list := make([]gin.H, len(users))
	for i, u := range users {
		list[i] = userRowToJSON(u)
	}
	c.JSON(http.StatusOK, gin.H{"users": list})
}

// ========== API 21：PUT /api/users/me ==========

func UpdateProfile(c *gin.Context) {
	currentID := currentUserID(c)

	var req service.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := service.UpdateProfile(currentID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidUsername):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrUsernameExists):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrEmailExists):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "更新成功",
		"user": gin.H{
			"user_id":         user.UserID,
			"username":        user.Username,
			"email":           user.Email,
			"bio":             user.Bio,
			"profile_picture": user.ProfilePicture,
		},
	})
}

// ========== API 22：GET /api/search/users ==========

func SearchUsers(c *gin.Context) {
	q := c.Query("q")
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供搜索关键词 q"})
		return
	}

	limit := 20
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		limit = l
	}

	result, err := service.SearchUsers(q, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}

	list := make([]gin.H, len(result.Users))
	for i, u := range result.Users {
		list[i] = userRowToJSON(u)
	}
	c.JSON(http.StatusOK, gin.H{
		"users": list,
		"total": result.Total,
	})
}

// ========== POST /api/users/me/password/send-code：发送修改密码验证码 ==========

func SendChangePasswordCode(c *gin.Context) {
	userID := currentUserID(c)

	if err := service.SendChangePasswordCode(userID); err != nil {
		switch {
		case errors.Is(err, service.ErrOTPRateLimit):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送，请在 10 分钟内完成验证"})
}

// ========== POST /api/users/me/password/confirm：验证 OTP 并修改密码 ==========

func ConfirmChangePassword(c *gin.Context) {
	userID := currentUserID(c)

	var req service.ConfirmChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ConfirmChangePassword(userID, req); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidOTP):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}
