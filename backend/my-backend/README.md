# CN6000 Social Platform — Backend

> RESTful API backend for a social media platform (Xiaohongshu-inspired), built with Go, Gin, PostgreSQL, and Redis.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat&logo=go)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)
![Gin](https://img.shields.io/badge/Gin-Framework-00ADD8?style=flat)

---

## Features

- **Authentication** — JWT HS256 with Redis blacklist logout; OTP email password reset (Gmail SMTP)
- **Feed** — Dual-mode sorting: chronological timeline and community weighted ranking (HackerNews decay algorithm)
- **Posts** — Full CRUD with image upload, hashtag tagging, and three-tier visibility control (`public` / `followers` / `private`)
- **Social** — Follow / unfollow, user profiles, like, comment, full-text post search
- **Reporting** — Deduplicated content reports for posts and comments
- **Account Deletion** — GDPR-compliant right-to-be-forgotten with cascaded soft-delete
- **Caching** — Redis Cache-Aside for hot tags (Sorted Set) and recommended users (JSON String)
- **Rate Limiting** — Per-IP Redis counter middleware (60 req/min globally; 10 req/min for uploads)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Go 1.25 |
| Web Framework | Gin |
| ORM | GORM v2 |
| Database | PostgreSQL 15 |
| Cache / Blacklist | Redis 7 (go-redis v9) |
| Auth | JWT HS256 (golang-jwt/jwt v5) |
| Password Hashing | bcrypt (golang.org/x/crypto) |
| UUID | google/uuid |
| PostgreSQL Arrays | lib/pq (pq.StringArray) |

---

## Project Structure

```
my-backend/
├── conf/
│   ├── database.go        # PostgreSQL connection, view & trigger rebuild, schema migration
│   └── redis.go           # Redis connection pool
├── controller/            # HTTP handlers (bind request → call service → write response)
│   ├── auth_controller.go
│   ├── post_controller.go
│   ├── user_controller.go
│   ├── report_controller.go
│   └── upload_controller.go
├── dao/                   # Data access layer (raw SQL / GORM queries)
│   ├── post_dao.go        # Feed queries with visibility filter & weighted sort
│   ├── feed_dao.go        # User stats, hot tags, recommended users
│   ├── user_dao.go        # User CRUD, search, follow lists, account deletion
│   ├── follow_dao.go      # Follow / unfollow
│   └── report_dao.go      # Content reports
├── middleware/
│   ├── auth.go            # JWT validation + Redis blacklist check
│   └── ratelimit.go       # Redis-based per-IP rate limiting
├── model/                 # GORM model structs
│   ├── user.go
│   ├── post.go            # Includes visibility field
│   ├── comment.go
│   ├── follow.go
│   ├── like.go
│   ├── tag.go / post_tag.go
│   └── report.go
├── router/
│   └── router.go          # Route registration (public + JWT-protected groups)
├── service/               # Business logic layer
│   ├── auth_service.go
│   ├── post_service.go    # Feed, sort modes, Redis cache-aside
│   ├── user_service.go    # Profile, follow, account deletion
│   └── report_service.go
├── utils/
│   ├── jwt.go             # Token generation / parsing
│   └── email.go           # Gmail SMTP OTP sender
├── main.go
├── go.mod / go.sum
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Go 1.21+
- PostgreSQL 15
- Redis 7
- A Gmail account (for OTP password reset)

### Database Setup

Run the provided `init.sql` to create all tables, indexes, views, and triggers.
The application does **not** use GORM AutoMigrate — schema is managed entirely by SQL. On startup, the app automatically:

1. Runs incremental migrations (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`)
2. Rebuilds the `post_details` and `user_stats` views
3. Rebuilds the full-text search trigger on `posts.content`

### Environment Variables

Create a `.env` file (or export in your shell). **Never commit this file.**

```env
# JWT signing key (required in production)
JWT_SECRET=your-secret-key-here

# Gmail SMTP for OTP emails
GMAIL_FROM=your-address@gmail.com
GMAIL_PASSWORD=your-app-password

# Image upload directory (default: ./uploads)
UPLOAD_DIR=./uploads

# Base URL for generating image URLs in responses (default: http://localhost:8080)
BASE_URL=http://localhost:8080
```

### Run

```bash
go mod download
go run main.go
```

The server starts on `:8080`.

---

## API Overview

All protected endpoints require `Authorization: Bearer <token>`.

### Public

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Register (username, email, password) |
| POST | `/api/login` | Login → returns JWT |
| POST | `/api/auth/password-reset/send-code` | Send OTP to email |
| POST | `/api/auth/password-reset/confirm` | Verify OTP + set new password |

### Protected (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/logout` | Invalidate token (Redis blacklist) |
| GET | `/api/feed/home` | Home feed with user card, hot tags, recommended users |
| GET | `/api/feed/posts` | Paginated posts (`?sort=timeline\|community`) |
| POST | `/api/posts` | Create post (content, images, tags, visibility) |
| PUT | `/api/posts/:id` | Edit post |
| DELETE | `/api/posts/:id` | Soft-delete post |
| POST | `/api/posts/:id/like` | Like |
| DELETE | `/api/posts/:id/like` | Unlike |
| GET | `/api/posts/:id/comments` | List comments |
| POST | `/api/posts/:id/comments` | Add comment |
| DELETE | `/api/posts/:id/comments/:comment_id` | Soft-delete comment |
| POST | `/api/posts/:id/report` | Report post |
| POST | `/api/posts/:id/comments/:comment_id/report` | Report comment |
| GET | `/api/users/:id` | User profile + posts |
| GET | `/api/users/:id/following` | Following list |
| GET | `/api/users/:id/followers` | Follower list |
| POST | `/api/users/:id/follow` | Follow user |
| DELETE | `/api/users/:id/follow` | Unfollow user |
| PUT | `/api/users/me` | Update profile |
| DELETE | `/api/users/me` | Delete account (GDPR) |
| GET | `/api/search/users` | Search users by username |
| GET | `/api/search/posts` | Full-text search posts |
| GET | `/api/tags/:name/posts` | Posts by hashtag |
| POST | `/api/upload/image` | Upload image (10 MB max, JPEG/PNG/GIF/WebP) |

---

## Key Design Decisions

### No AutoMigrate
GORM's AutoMigrate conflicts with named PostgreSQL constraints (e.g. `uq_users_username`). All DDL lives in `init.sql`; the app only applies safe incremental additions at startup.

### Cursor Pagination
Feed uses cursor-based pagination instead of OFFSET for stable performance at scale.
- **Timeline mode**: cursor = `created_at` RFC3339Nano timestamp
- **Community mode**: cursor = integer offset string (OFFSET-based, since weighted scores change over time)

### Community Weighted Sort
Implements a HackerNews-style decay formula:

```
score = (like_count × 2 + comment_count × 3) / (age_hours + 2) ^ 1.5
```

Comments are weighted higher than likes to encourage discussion. The `+2` floor prevents brand-new posts from scoring infinitely high.

### Visibility Control
Every post has a `visibility` field (`public` / `followers` / `private`). All feed, profile, search, and tag queries apply the same visibility filter:

```sql
WHERE (
  pd.user_id = $currentUser          -- always see own posts
  OR pd.visibility = 'public'
  OR (pd.visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = $currentUser AND followee_id = pd.user_id
      ))
)
```

### Soft Delete
Posts and comments use a `deleted_at *time.Time` field (not `gorm.DeletedAt`) so that GORM does not auto-inject `WHERE deleted_at IS NULL` into queries — the view layer handles filtering explicitly.

### Redis Caching
- **Hot tags** (`hot:tags`): Sorted Set, updated incrementally with `ZINCRBY ±1` on post create/edit. TTL 5 min.
- **Recommended users** (`recommend:users:{id}`): JSON string, TTL 10 min, evicted on follow/unfollow.
- **Token blacklist** (`token:blacklist:{jti}`): TTL = remaining token lifetime.

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| All API endpoints | 60 requests / IP / minute |
| `POST /api/upload/image` | 10 requests / IP / minute |

Exceeding the limit returns `429 Too Many Requests`.
