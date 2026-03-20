package main

import (
	"my-backend/conf"
	"my-backend/router"
)

func main() {
	// 初始化 PostgreSQL（AutoMigrate + 触发器 + 视图）
	conf.InitDB()

	// 初始化 Redis
	conf.InitRedis()

	// 注册路由并启动 HTTP 服务
	r := router.SetupRouter()
	r.Run(":8080")
}
