-- ============================================================
-- 社交平台数据库初始化脚本
-- 数据库：PostgreSQL 15+
-- 版本：v2.1
-- 最后更新：2026-03-02
-- 执行方式：psql -U admin -d postgres -f init.sql
-- ============================================================


-- ============================================================
-- 扩展
-- ============================================================

-- 启用 UUID 生成函数支持（Go 端生成 UUID，此处备用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 建表
-- ============================================================

-- ------------------------------------------------------------
-- 1. users（用户）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id         UUID            PRIMARY KEY,
    username        VARCHAR(50)     NOT NULL,
    email           VARCHAR(100)    NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    profile_picture VARCHAR(500)    DEFAULT '',
    bio             TEXT            DEFAULT '',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email    UNIQUE (email)
);

COMMENT ON TABLE  users                 IS '用户表';
COMMENT ON COLUMN users.user_id         IS '用户 UUID，由 Go 端 uuid.New() 生成';
COMMENT ON COLUMN users.username        IS '用户名，唯一，3~50 字符';
COMMENT ON COLUMN users.email           IS '邮箱，唯一';
COMMENT ON COLUMN users.password_hash   IS 'bcrypt cost=10 加密后的密码，不对外返回';
COMMENT ON COLUMN users.profile_picture IS '头像文件访问 URL，空字符串表示未设置';
COMMENT ON COLUMN users.bio             IS '个人简介';


-- ------------------------------------------------------------
-- 2. posts（帖子）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    post_id     UUID            PRIMARY KEY,
    user_id     UUID            NOT NULL,
    content     TEXT            NOT NULL,
    content_tsv TSVECTOR,                          -- 由触发器自动维护
    image_urls  TEXT[]          NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    visibility  VARCHAR(10)     NOT NULL DEFAULT 'public',  -- 'public' | 'followers' | 'private'
    deleted_at  TIMESTAMPTZ     DEFAULT NULL                -- NULL = 正常；非 NULL = 软删除
);

COMMENT ON TABLE  posts              IS '帖子表';
COMMENT ON COLUMN posts.post_id      IS '帖子 UUID，由 Go 端生成';
COMMENT ON COLUMN posts.user_id      IS '发布者 UUID，逻辑外键 → users';
COMMENT ON COLUMN posts.content      IS '帖子正文';
COMMENT ON COLUMN posts.content_tsv  IS '全文搜索向量，由触发器自动维护';
COMMENT ON COLUMN posts.image_urls   IS '图片访问 URL 数组，无图片时为空数组';
COMMENT ON COLUMN posts.visibility   IS '可见范围：public（所有人）| followers（仅关注者）| private（仅自己）';
COMMENT ON COLUMN posts.deleted_at   IS '软删除时间戳，NULL 表示正常';

-- 兼容已存在的表：若 visibility 列不存在则追加（幂等）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'posts' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE posts
            ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'public';
    END IF;
END$$;


-- ------------------------------------------------------------
-- 3. comments（评论）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    comment_id  UUID            PRIMARY KEY,
    post_id     UUID            NOT NULL,
    user_id     UUID            NOT NULL,
    content     TEXT            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ     DEFAULT NULL       -- NULL = 正常；非 NULL = 软删除
);

COMMENT ON TABLE  comments              IS '评论表';
COMMENT ON COLUMN comments.comment_id  IS '评论 UUID，由 Go 端生成';
COMMENT ON COLUMN comments.post_id     IS '所属帖子 UUID，逻辑外键 → posts';
COMMENT ON COLUMN comments.user_id     IS '评论者 UUID，逻辑外键 → users';
COMMENT ON COLUMN comments.deleted_at  IS '软删除时间戳，NULL 表示正常';


-- ------------------------------------------------------------
-- 4. follows（关注关系）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID        NOT NULL,   -- 主动关注方
    followee_id UUID        NOT NULL,   -- 被关注方
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_follows PRIMARY KEY (follower_id, followee_id)
);

COMMENT ON TABLE  follows             IS '关注关系表';
COMMENT ON COLUMN follows.follower_id IS '主动关注方 UUID；following_count = WHERE follower_id = ?';
COMMENT ON COLUMN follows.followee_id IS '被关注方 UUID；follower_count = WHERE followee_id = ?';


-- ------------------------------------------------------------
-- 5. likes（点赞记录）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
    user_id     UUID        NOT NULL,
    post_id     UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_likes PRIMARY KEY (user_id, post_id)
);

COMMENT ON TABLE  likes         IS '点赞记录表，复合主键防止重复点赞';
COMMENT ON COLUMN likes.user_id IS '点赞用户 UUID，逻辑外键 → users';
COMMENT ON COLUMN likes.post_id IS '被点赞帖子 UUID，逻辑外键 → posts';


-- ------------------------------------------------------------
-- 6. tags（标签）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    tag_id      UUID            PRIMARY KEY,
    tag_name    VARCHAR(50)     NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_tags_tag_name UNIQUE (tag_name)
);

COMMENT ON TABLE  tags          IS '标签表';
COMMENT ON COLUMN tags.tag_id   IS '标签 UUID，由 Go 端生成';
COMMENT ON COLUMN tags.tag_name IS '标签名，唯一，如 travel';


-- ------------------------------------------------------------
-- 7. post_tags（帖子-标签关联）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_tags (
    post_id UUID NOT NULL,
    tag_id  UUID NOT NULL,

    CONSTRAINT pk_post_tags PRIMARY KEY (post_id, tag_id)
);

COMMENT ON TABLE  post_tags         IS '帖子与标签的多对多关联表';
COMMENT ON COLUMN post_tags.post_id IS '帖子 UUID，逻辑外键 → posts';
COMMENT ON COLUMN post_tags.tag_id  IS '标签 UUID，逻辑外键 → tags';


-- ============================================================
-- 索引
-- ============================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);

-- posts
CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_gin_tsv    ON posts USING GIN (content_tsv);
-- 部分索引：仅索引未软删除的帖子，过滤效率更高
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts (deleted_at)
    WHERE deleted_at IS NULL;

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id    ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id    ON comments (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments (created_at DESC);
-- 部分索引：仅索引未软删除的评论
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments (deleted_at)
    WHERE deleted_at IS NULL;

-- follows
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee_id ON follows (followee_id);

-- likes
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes (post_id);

-- post_tags
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags (tag_id);


-- ============================================================
-- 触发器：自动维护 posts.content_tsv 全文搜索向量
-- ============================================================

CREATE OR REPLACE FUNCTION posts_tsv_update()
RETURNS trigger AS $$
BEGIN
    NEW.content_tsv := to_tsvector('simple', NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_tsv_trigger ON posts;

CREATE TRIGGER posts_tsv_trigger
    BEFORE INSERT OR UPDATE OF content ON posts
    FOR EACH ROW
    EXECUTE FUNCTION posts_tsv_update();

COMMENT ON FUNCTION posts_tsv_update IS '自动将 posts.content 转换为 tsvector 写入 content_tsv，供全文搜索使用';


-- ============================================================
-- 视图
-- ============================================================

-- ------------------------------------------------------------
-- user_stats：用户统计视图
-- 用途：GET /api/feed/home 用户卡片、GET /api/users/:id 用户主页
-- ------------------------------------------------------------
DROP VIEW IF EXISTS user_stats;

CREATE VIEW user_stats AS
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
GROUP BY u.user_id, u.username, u.email, u.profile_picture, u.bio;

COMMENT ON VIEW user_stats IS '用户统计视图，post_count / comment_count 仅统计未软删除内容';


-- ------------------------------------------------------------
-- post_details：帖子详情视图
-- 用途：所有帖子列表接口（Feed、用户主页、搜索、标签筛选）
-- ------------------------------------------------------------
DROP VIEW IF EXISTS post_details;

CREATE VIEW post_details AS
SELECT
    p.post_id,
    p.user_id,
    u.username,
    u.profile_picture,
    p.content,
    p.content_tsv,
    p.image_urls,
    p.visibility,
    p.created_at,
    p.deleted_at,
    COUNT(DISTINCT l.user_id)    AS like_count,
    COUNT(DISTINCT c.comment_id) AS comment_count
FROM posts p
LEFT JOIN users    u ON p.user_id = u.user_id
LEFT JOIN likes    l ON p.post_id = l.post_id
LEFT JOIN comments c ON p.post_id = c.post_id AND c.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY
    p.post_id,
    p.user_id,
    u.username,
    u.profile_picture,
    p.content,
    p.content_tsv,
    p.image_urls,
    p.visibility,
    p.created_at,
    p.deleted_at;

COMMENT ON VIEW post_details IS '帖子详情视图，like_count / comment_count 实时聚合，已软删除帖子不返回';


-- ============================================================
-- 完成
-- ============================================================
-- 执行完毕后可验证：
--   \dt         查看所有表
--   \di         查看所有索引
--   \dv         查看所有视图
--   \df         查看所有函数
-- ============================================================
