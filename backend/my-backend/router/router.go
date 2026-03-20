package router

import (
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"my-backend/controller"
	"my-backend/middleware"
)

// SetupRouter 注册所有路由与中间件，返回配置好的 *gin.Engine
func SetupRouter() *gin.Engine {
	r := gin.Default()

	// CORS 中间件：允许前端跨域请求
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 静态文件：上传图片访问（路径与 UPLOAD_DIR 环境变量保持一致，默认 ./uploads）
	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	r.Static("/uploads", uploadDir)

	api := r.Group("/api")

	// 全局通用限流：每 IP 每分钟最多 60 次
	api.Use(middleware.RateLimitMiddleware("ratelimit:", 60, time.Minute))

	// ===== 公开接口（无需鉴权）=====
	api.POST("/register", controller.Register)
	api.POST("/login", controller.Login)

	// 密码重置
	passwordReset := api.Group("/auth/password-reset")
	{
		passwordReset.POST("/send-code", controller.SendPasswordResetCode)
		passwordReset.POST("/confirm", controller.ConfirmPasswordReset)
	}

	// ===== 需要登录的接口 =====
	authorized := api.Group("")
	authorized.Use(middleware.AuthMiddleware())
	{
		authorized.POST("/logout", controller.Logout)

		// Feed（支持 ?sort=timeline|community）
		authorized.GET("/feed/home", controller.GetHomeFeed)
		authorized.GET("/feed/posts", controller.GetMorePosts)

		// 帖子 CRUD
		authorized.POST("/posts", controller.CreatePost)
		authorized.PUT("/posts/:id", controller.UpdatePost)
		authorized.DELETE("/posts/:id", controller.DeletePost)

		// 点赞
		authorized.POST("/posts/:id/like", controller.LikePost)
		authorized.DELETE("/posts/:id/like", controller.UnlikePost)

		// 评论
		authorized.GET("/posts/:id/comments", controller.GetComments)
		authorized.POST("/posts/:id/comments", controller.CreateComment)
		authorized.DELETE("/posts/:id/comments/:comment_id", controller.DeleteComment)

		// 举报
		authorized.POST("/posts/:id/report", controller.ReportPost)
		authorized.POST("/posts/:id/comments/:comment_id/report", controller.ReportComment)

		// 用户主页与社交
		authorized.GET("/users/:id", controller.GetUserProfile)
		authorized.GET("/users/:id/following", controller.GetFollowing)
		authorized.GET("/users/:id/followers", controller.GetFollowers)
		authorized.POST("/users/:id/follow", controller.FollowUser)
		authorized.DELETE("/users/:id/follow", controller.UnfollowUser)
		authorized.PUT("/users/me", controller.UpdateProfile)
		authorized.DELETE("/users/me", controller.DeleteAccount)
		authorized.POST("/users/me/password/send-code", controller.SendChangePasswordCode)
		authorized.POST("/users/me/password/confirm", controller.ConfirmChangePassword)

		// 通知
		authorized.GET("/notifications", controller.GetNotifications)
		authorized.GET("/notifications/unread-count", controller.GetUnreadCount)
		authorized.POST("/notifications/read-all", controller.MarkAllRead)

		// 搜索
		authorized.GET("/search/users", controller.SearchUsers)
		authorized.GET("/search/posts", controller.SearchPosts)

		// 按标签查帖子
		authorized.GET("/tags/:name/posts", controller.GetTagPosts)

		// 图片上传（独立限流：每 IP 每分钟最多 10 次）
		upload := authorized.Group("")
		upload.Use(middleware.RateLimitMiddleware("ratelimit:upload:", 10, time.Minute))
		upload.POST("/upload/image", controller.UploadImage)
	}

	return r
}
