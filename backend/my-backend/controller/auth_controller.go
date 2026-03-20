package controller

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"my-backend/service"
	"my-backend/utils"
)

// Register POST /api/register
func Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := service.Register(req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUsernameExists), errors.Is(err, service.ErrEmailExists):
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "注册成功",
		"user": gin.H{
			"user_id":    user.UserID,
			"username":   user.Username,
			"email":      user.Email,
			"created_at": user.CreatedAt,
		},
	})
}

// Login POST /api/login
func Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := service.Login(req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCredentials):
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "登录成功",
		"token":   result.Token,
		"user": gin.H{
			"user_id":         result.User.UserID,
			"username":        result.User.Username,
			"email":           result.User.Email,
			"profile_picture": result.User.ProfilePicture,
		},
	})
}

// Logout POST /api/logout（需要登录）
// 将当前 Token 的 jti 写入 Redis 黑名单，TTL = Token 剩余有效期
func Logout(c *gin.Context) {
	raw, _ := c.Get("claims")
	claims, ok := raw.(*utils.JWTClaims)
	if !ok || claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token 无效"})
		return
	}

	expireAt := claims.ExpiresAt.Time
	if err := service.Logout(claims.JTI, expireAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "退出成功"})
}

// SendPasswordResetCode POST /api/auth/password-reset/send-code
func SendPasswordResetCode(c *gin.Context) {
	var req service.SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.SendPasswordResetCode(req.Email); err != nil {
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

// ConfirmPasswordReset POST /api/auth/password-reset/confirm
func ConfirmPasswordReset(c *gin.Context) {
	var req service.ConfirmPasswordResetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ConfirmPasswordReset(req); err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case errors.Is(err, service.ErrInvalidOTP):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码重置成功，请重新登录"})
}
