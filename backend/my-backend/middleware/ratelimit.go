package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"my-backend/conf"
)

// RateLimitMiddleware 基于客户端 IP 的 Redis 计数器限流中间件
//
//   - keyPrefix: Redis key 前缀，如 "ratelimit:" 或 "ratelimit:upload:"
//   - limit:     时间窗口内允许的最大请求数
//   - window:    时间窗口长度（第一次计数时设置 TTL）
//
// 计数器逻辑：INCR key → 首次时 EXPIRE → 超出 limit 返回 429
// Redis 故障时放行，避免误伤正常用户（fail-open）
func RateLimitMiddleware(keyPrefix string, limit int64, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := keyPrefix + ip
		ctx := context.Background()

		count, err := conf.RDB.Incr(ctx, key).Result()
		if err != nil {
			// Redis 故障放行
			c.Next()
			return
		}

		// 首次计数，设置过期时间（保证窗口时间后自动重置）
		if count == 1 {
			conf.RDB.Expire(ctx, key, window)
		}

		if count > limit {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "请求过于频繁，请稍后再试"})
			return
		}

		c.Next()
	}
}
