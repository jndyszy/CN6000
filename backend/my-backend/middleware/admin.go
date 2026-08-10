package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RequireAdmin 要求当前用户角色为 admin 或 super_admin，须放在 AuthMiddleware 之后使用
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		if role != "admin" && role != "super_admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "需要管理员权限"})
			return
		}
		c.Next()
	}
}

// RequireSuperAdmin 要求当前用户角色为 super_admin，用于管理员账号的任免
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("role") != "super_admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "需要超级管理员权限"})
			return
		}
		c.Next()
	}
}
