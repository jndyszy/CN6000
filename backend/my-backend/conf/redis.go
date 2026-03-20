package conf

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// RDB 全局 Redis 客户端实例，供各 service/dao 层调用
var RDB *redis.Client

// InitRedis 初始化 Redis 连接并验证连通性
func InitRedis() {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	RDB = redis.NewClient(&redis.Options{
		Addr:         addr,
		DB:           0,           // 使用默认 DB 0
		PoolSize:     20,          // 连接池大小
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// 验证连通性
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := RDB.Ping(ctx).Result(); err != nil {
		log.Fatalf("[Redis] 连接 Redis 失败: %v", err)
	}

	log.Println("[Redis] Redis 连接成功")
}
