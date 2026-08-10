package conf

import (
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB 全局数据库实例，供各 dao 层调用
var DB *gorm.DB

// InitDB 连接 PostgreSQL，配置连接池，重建视图与触发器
//
// 表结构、索引均由 init.sql 管理，Go 代码不执行 AutoMigrate，
// 避免 GORM 因 varchar / character varying 类型字符串不一致触发无效 ALTER TABLE。
func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=127.0.0.1 user=admin password=admin dbname=postgres port=5432 sslmode=disable TimeZone=UTC"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
		Logger:                                   logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("[DB] 连接 PostgreSQL 失败: %v", err)
	}

	// 连接池配置
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[DB] 获取 sql.DB 失败: %v", err)
	}
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	DB = db

	// 每次启动重建视图与触发器，确保定义始终与代码一致
	// 表结构和索引已由 init.sql 建好，此处不再重建
	migrateSchema(db)
	rebuildViews(db)
	rebuildTrigger(db)
	promoteConfiguredAdmin(db)

	log.Println("[DB] PostgreSQL 初始化成功")
}

// promoteConfiguredAdmin 每次启动时，把 ADMIN_EMAIL 环境变量指定邮箱的用户提升为 super_admin。
// 未设置该环境变量，或该邮箱尚未注册时静默跳过；已注册后重启一次即可生效。
func promoteConfiguredAdmin(db *gorm.DB) {
	email := os.Getenv("ADMIN_EMAIL")
	if email == "" {
		return
	}
	result := db.Exec(`UPDATE users SET role = 'super_admin' WHERE email = ? AND role <> 'super_admin'`, email)
	if result.Error != nil {
		log.Fatalf("[DB] 提升超级管理员失败: %v", result.Error)
	}
	if result.RowsAffected > 0 {
		log.Printf("[DB] 已将 %s 提升为超级管理员\n", email)
	}
}

// migrateSchema 在 init.sql 之外增量添加新字段/新表（幂等，使用 IF NOT EXISTS）
func migrateSchema(db *gorm.DB) {
	sqls := []string{
		// posts 表：新增可见性字段
		`ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'public'`,

		// comments 表：新增楼中楼父评论 ID（NULL = 顶层评论，现有数据自动为顶层）
		`ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID`,
		`CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id) WHERE parent_id IS NOT NULL`,

		// notifications 表：点赞/评论/回复消息通知
		`CREATE TABLE IF NOT EXISTS notifications (
			notification_id UUID        PRIMARY KEY,
			recipient_id    UUID        NOT NULL,
			actor_id        UUID        NOT NULL,
			type            VARCHAR(20) NOT NULL,
			post_id         UUID,
			is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (recipient_id, is_read) WHERE is_read = FALSE`,

		// reports 表：内容举报
		`CREATE TABLE IF NOT EXISTS reports (
			report_id   UUID PRIMARY KEY,
			reporter_id UUID NOT NULL,
			target_type VARCHAR(10) NOT NULL,
			target_id   UUID NOT NULL,
			reason      VARCHAR(50) NOT NULL,
			created_at  TIMESTAMPTZ DEFAULT NOW(),
			CONSTRAINT uq_reports_unique UNIQUE (reporter_id, target_id, target_type)
		)`,

		// reports 表：管理员处理状态（举报审核后台用）
		`ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
		`ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID`,
		`ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC)`,

		// users 表：管理后台需要的角色与封禁/限制发帖字段
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_post_restricted BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS restricted_reason TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE role <> 'user'`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			log.Fatalf("[DB] Schema 迁移失败: %v\nSQL: %s", err, sql)
		}
	}
	log.Println("[DB] Schema 迁移成功")
}

// rebuildViews 删除并重建两个核心视图（DROP + CREATE，保证定义始终最新）
func rebuildViews(db *gorm.DB) {
	sqls := []string{
		`DROP VIEW IF EXISTS post_details`,
		`DROP VIEW IF EXISTS user_stats`,

		// user_stats：用户统计（帖子数、评论数、关注数、粉丝数），软删除内容不计入
		`CREATE VIEW user_stats AS
SELECT
    u.user_id,
    u.username,
    u.email,
    u.profile_picture,
    u.bio,
    COUNT(DISTINCT p.post_id)      AS post_count,
    COUNT(DISTINCT c.comment_id)   AS comment_count,
    COUNT(DISTINCT f1.followee_id) AS following_count,
    COUNT(DISTINCT f2.follower_id) AS follower_count
FROM users u
LEFT JOIN posts    p  ON u.user_id = p.user_id    AND p.deleted_at IS NULL
LEFT JOIN comments c  ON u.user_id = c.user_id    AND c.deleted_at IS NULL
LEFT JOIN follows  f1 ON u.user_id = f1.follower_id
LEFT JOIN follows  f2 ON u.user_id = f2.followee_id
GROUP BY u.user_id, u.username, u.email, u.profile_picture, u.bio`,

		// post_details：帖子详情（点赞数、评论数、作者信息），已软删除帖子不返回
		`CREATE VIEW post_details AS
SELECT
    p.post_id,
    p.user_id,
    u.username,
    u.profile_picture,
    p.content,
    p.content_tsv,
    p.image_urls,
    p.created_at,
    p.deleted_at,
    p.visibility,
    COUNT(DISTINCT l.user_id)    AS like_count,
    COUNT(DISTINCT c.comment_id) AS comment_count
FROM posts p
LEFT JOIN users    u ON p.user_id = u.user_id
LEFT JOIN likes    l ON p.post_id = l.post_id
LEFT JOIN comments c ON p.post_id = c.post_id AND c.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.post_id, p.user_id, u.username, u.profile_picture,
         p.content, p.content_tsv, p.image_urls, p.created_at, p.deleted_at, p.visibility`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			log.Fatalf("[DB] 重建视图失败: %v\nSQL: %s", err, sql)
		}
	}
	log.Println("[DB] 视图重建成功")
}

// rebuildTrigger 重建全文搜索触发器（OR REPLACE / DROP IF EXISTS，幂等）
func rebuildTrigger(db *gorm.DB) {
	sqls := []string{
		`CREATE OR REPLACE FUNCTION posts_tsv_update() RETURNS trigger AS $$
BEGIN
    NEW.content_tsv := to_tsvector('simple', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql`,

		`DROP TRIGGER IF EXISTS posts_tsv_trigger ON posts`,

		`CREATE TRIGGER posts_tsv_trigger
    BEFORE INSERT OR UPDATE OF content ON posts
    FOR EACH ROW EXECUTE FUNCTION posts_tsv_update()`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			log.Fatalf("[DB] 重建触发器失败: %v\nSQL: %s", err, sql)
		}
	}
	log.Println("[DB] 触发器重建成功")
}
