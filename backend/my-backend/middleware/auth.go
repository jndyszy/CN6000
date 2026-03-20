package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"my-backend/conf"
	"my-backend/utils"
)

// AuthMiddleware JWT 鉴权中间件
// 校验流程：提取 Bearer Token → 解析验证签名与过期 → 检查 Redis 黑名单 → 注入用户信息至 Context
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未提供认证 Token"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := utils.ParseToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token 无效或已过期"})
			return
		}

		// 检查 Redis 黑名单：登出的 Token 即使未过期也不可用
		blacklistKey := "token:blacklist:" + claims.JTI
		exists, err := conf.RDB.Exists(context.Background(), blacklistKey).Result()
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "服务器内部错误"})
			return
		}
		if exists > 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token 已失效，请重新登录"})
			return
		}

		// 将完整 Claims 注入 Context，供后续 Handler 使用
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("claims", claims)
		c.Next()
	}
}
