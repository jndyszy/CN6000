# CN6000 — Full-Stack Social Media Platform

A full-stack social networking platform built with Go (backend) and React (frontend), deployed on AWS EC2 using Docker Compose.

**Live Demo:** http://18.143.133.8

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Features

- **User Authentication** — Register, login, logout with JWT; password reset via email OTP
- **Posts** — Create, update, delete posts with text, images, and tags; visibility control (public / followers / private)
- **Social Graph** — Follow / unfollow users; follower and following lists
- **Feed** — Two modes: timeline (cursor-based chronological) and community (HackerNews decay ranking)
- **Comments** — Nested threaded comments with soft delete
- **Likes** — Like / unlike posts (deduplication enforced at DB level)
- **Tags** — Hashtag system with hot-tags leaderboard (Redis ZSet)
- **Search** — Full-text search on posts (PostgreSQL GIN index + tsvector); user search
- **Image Upload** — Upload up to 10 MB (jpg / png / gif / webp), validated via magic bytes
- **Notifications** — In-app notifications for likes, comments, and replies
- **Content Reporting** — Report posts or comments
- **Rate Limiting** — IP-based Redis counter (60 req/min global; 10 req/min upload)
- **Recommended Users** — Cached user recommendations (Redis, 10-minute TTL)
- **i18n** — Language context with translation support

---

## Tech Stack

### Backend

| Component      | Technology                   |
|----------------|------------------------------|
| Language       | Go 1.25                      |
| Web Framework  | Gin v1.11                    |
| ORM            | GORM v1.31                   |
| Database       | PostgreSQL 15                |
| Cache          | Redis 7 (go-redis v9)        |
| Auth           | JWT HS256 (golang-jwt v5)    |
| UUID           | google/uuid v1.6             |
| Email          | Gmail SMTP                   |

### Frontend

| Component      | Technology                   |
|----------------|------------------------------|
| Framework      | React 19                     |
| Language       | TypeScript 5.9               |
| Routing        | React Router v7              |
| Build Tool     | Vite 7                       |
| Styling        | Vanilla CSS (no UI framework)|

### Infrastructure

| Component         | Technology                        |
|-------------------|-----------------------------------|
| Reverse Proxy     | Nginx (alpine)                    |
| Containerization  | Docker Compose                    |
| Platform          | AWS EC2 (Amazon Linux 2023)       |

---

## Architecture

```
Client (Browser)
      │
      ▼
  Nginx :80 ──── /assets/*  ──► Static files (built React SPA)
               ── /api/*     ──► Go backend :8080
               ── /uploads/* ──► Go backend :8080 (file serving)
               ── /*         ──► index.html (SPA fallback)

  Go Backend :8080
      │
      ├── Router (Gin)
      ├── Middleware (JWT Auth + Rate Limit)
      ├── Controllers → Services → DAOs
      │
      ├── PostgreSQL 15  (persistent data)
      └── Redis 7        (JWT blacklist, rate limit, cache, OTP)
```

### Backend Layered Architecture

```
HTTP Request
    ↓
router/router.go         ← Gin route registration
    ↓
middleware/auth.go       ← JWT validation + Redis blacklist check
middleware/ratelimit.go  ← IP-based rate limiting via Redis
    ↓
controller/              ← Request parsing, response formatting
    ↓
service/                 ← Business logic, error handling
    ↓
dao/                     ← SQL queries via GORM
    ↓
PostgreSQL / Redis
```

---

## Project Structure

```
/
├── docker-compose.yml          # 4 services: frontend, app, postgres, redis
├── .env                        # Secrets: JWT_SECRET, Gmail, BASE_URL
├── init.sql                    # DB schema, indexes, views, triggers
│
├── backend/
│   ├── Dockerfile              # Multi-stage: golang:1.25-alpine → alpine:3.21
│   └── my-backend/
│       ├── main.go
│       ├── go.mod / go.sum
│       ├── router/router.go    # All route definitions
│       ├── controller/         # HTTP handlers
│       ├── service/            # Business logic
│       ├── dao/                # Data access layer
│       ├── model/              # GORM structs
│       ├── middleware/         # Auth + rate limit
│       ├── utils/              # JWT, email helpers
│       └── conf/               # DB and Redis initialization
│
└── frontend/
    ├── Dockerfile              # Multi-stage: node:22-alpine → nginx:alpine
    ├── nginx.conf              # SPA fallback + /api proxy
    └── my-app/
        └── src/
            ├── router/         # React Router routes
            ├── pages/          # Page components (9 pages)
            ├── components/     # Shared components (PostCard)
            ├── api/            # API client layer
            ├── context/        # LanguageContext (i18n)
            ├── types/          # TypeScript interfaces
            └── i18n/           # Translation strings
```

---

## Database Schema

### Tables

| Table          | Primary Key                    | Description                                      |
|----------------|--------------------------------|--------------------------------------------------|
| `users`        | `user_id` (UUID)               | User accounts                                    |
| `posts`        | `post_id` (UUID)               | Posts with soft delete & visibility control      |
| `comments`     | `comment_id` (UUID)            | Nested comments with soft delete                 |
| `follows`      | `(follower_id, followee_id)`   | Follow relationships                             |
| `likes`        | `(user_id, post_id)`           | Post likes (deduplication via composite PK)      |
| `tags`         | `tag_id` (UUID)                | Hashtags                                         |
| `post_tags`    | `(post_id, tag_id)`            | Many-to-many post ↔ tag                          |
| `reports`      | `report_id` (UUID)             | Content reports (unique per reporter + target)   |
| `notifications`| `notification_id` (UUID)       | Like / comment / reply notifications             |

### Views

| View           | Description                                              |
|----------------|----------------------------------------------------------|
| `user_stats`   | Per-user counts: posts, comments, following, followers   |
| `post_details` | Per-post aggregates: like count, comment count, author   |

### Key Design Decisions

- **Soft delete** on `posts` and `comments` via `deleted_at` timestamp (NULL = active)
- **Full-text search** on `posts.content_tsv` (TSVECTOR, GIN index, auto-updated by trigger using `to_tsvector('simple', content)`)
- **Composite PKs** on `follows`, `likes`, `post_tags` prevent duplicates at the DB level
- **Partial indexes** on `deleted_at IS NULL` for efficient queries on active records
- **Nested comments** via `parent_id` self-reference in the `comments` table
- **Visibility control**: `'public'` | `'followers'` | `'private'` enforced in DAO queries

---

## API Reference

### Public Endpoints

| Method | Path                                  | Description                          |
|--------|---------------------------------------|--------------------------------------|
| `POST` | `/api/register`                       | Create new account                   |
| `POST` | `/api/login`                          | Login, returns JWT                   |
| `POST` | `/api/auth/password-reset/send-code`  | Send password reset OTP to email     |
| `POST` | `/api/auth/password-reset/confirm`    | Reset password with OTP              |

### Authenticated Endpoints (Bearer JWT required)

#### Auth
| Method   | Path          | Description                                        |
|----------|---------------|----------------------------------------------------|
| `POST`   | `/api/logout` | Invalidate token (add JTI to Redis blacklist)      |

#### Feed
| Method | Path              | Description                                                              |
|--------|-------------------|--------------------------------------------------------------------------|
| `GET`  | `/api/feed/home`  | Home feed with user card, posts, hot tags, recommended users             |
| `GET`  | `/api/feed/posts` | Paginated posts (`?sort=timeline\|community&cursor=...&limit=...`)       |

#### Posts
| Method   | Path                                              | Description                        |
|----------|---------------------------------------------------|------------------------------------|
| `POST`   | `/api/posts`                                      | Create post (content, images, tags, visibility) |
| `PUT`    | `/api/posts/:id`                                  | Update post                        |
| `DELETE` | `/api/posts/:id`                                  | Soft-delete post                   |
| `POST`   | `/api/posts/:id/like`                             | Like a post                        |
| `DELETE` | `/api/posts/:id/like`                             | Unlike a post                      |
| `GET`    | `/api/posts/:id/comments`                         | Get comments (nested)              |
| `POST`   | `/api/posts/:id/comments`                         | Create comment (optional `parent_id`) |
| `DELETE` | `/api/posts/:id/comments/:comment_id`             | Delete comment                     |
| `POST`   | `/api/posts/:id/report`                           | Report a post                      |
| `POST`   | `/api/posts/:id/comments/:comment_id/report`      | Report a comment                   |

#### Users & Social
| Method   | Path                                  | Description                           |
|----------|---------------------------------------|---------------------------------------|
| `GET`    | `/api/users/:id`                      | Get user profile + posts              |
| `GET`    | `/api/users/:id/following`            | Get users this user follows           |
| `GET`    | `/api/users/:id/followers`            | Get this user's followers             |
| `POST`   | `/api/users/:id/follow`               | Follow a user                         |
| `DELETE` | `/api/users/:id/follow`               | Unfollow a user                       |
| `PUT`    | `/api/users/me`                       | Update own profile                    |
| `DELETE` | `/api/users/me`                       | Delete account                        |
| `POST`   | `/api/users/me/password/send-code`    | Send password change OTP              |
| `POST`   | `/api/users/me/password/confirm`      | Confirm password change with OTP      |

#### Search, Tags & Upload
| Method | Path                     | Description                            |
|--------|--------------------------|----------------------------------------|
| `GET`  | `/api/search/users`      | Search users by name                   |
| `GET`  | `/api/search/posts`      | Full-text search posts                 |
| `GET`  | `/api/tags/:name/posts`  | Posts with a specific tag              |
| `POST` | `/api/upload/image`      | Upload image (max 10 MB, 10 req/min/IP)|

#### Notifications
| Method | Path                               | Description               |
|--------|------------------------------------|---------------------------|
| `GET`  | `/api/notifications`               | Get all notifications     |
| `GET`  | `/api/notifications/unread-count`  | Get unread count          |
| `POST` | `/api/notifications/read-all`      | Mark all as read          |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) enabled

### 1. Clone the Repository

```bash
git clone https://github.com/jndyszy/CN6000.git
cd CN6000
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
JWT_SECRET=your-secret-key-here
GMAIL_FROM=your-email@gmail.com
GMAIL_PASSWORD=your-app-specific-password
BASE_URL=http://your-server-ip-or-domain
```

> **Note:** `DATABASE_URL` and `REDIS_ADDR` are injected automatically by `docker-compose.yml`.

### 3. Start the Services

```bash
docker compose up --build -d
```

This starts 4 containers:

| Container  | Description                                     | Port       |
|------------|-------------------------------------------------|------------|
| `frontend` | Nginx serving React SPA                         | `80` (public) |
| `app`      | Go backend                                      | `8080` (internal) |
| `postgres` | PostgreSQL 15 (data persisted in `pgdata`)      | internal   |
| `redis`    | Redis 7 (data persisted in `redisdata`)         | internal   |

### 4. Open the App

Navigate to `http://localhost` (or your server's IP/domain).

### Useful Commands

```bash
# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f app

# Stop all services
docker compose down

# Stop and remove volumes (resets all data)
docker compose down -v

# Rebuild a single service after code changes
docker compose up --build app -d
```

---

## Environment Variables

| Variable          | Required | Description                                                             |
|-------------------|----------|-------------------------------------------------------------------------|
| `JWT_SECRET`      | Yes      | Secret key for HS256 JWT signing                                        |
| `GMAIL_FROM`      | Yes      | Gmail address used to send OTP emails                                   |
| `GMAIL_PASSWORD`  | Yes      | Gmail App Password (not your regular password)                          |
| `BASE_URL`        | Yes      | Public URL prefix for uploaded images (e.g. `http://18.143.133.8`)     |
| `DATABASE_URL`    | Auto     | Set by docker-compose; PostgreSQL connection string                     |
| `REDIS_ADDR`      | Auto     | Set by docker-compose; Redis address (`redis:6379`)                     |
| `UPLOAD_DIR`      | Optional | Upload directory path (defaults to `./uploads`)                         |

---

## Redis Key Reference

| Key Pattern                      | Purpose                           | TTL                      |
|----------------------------------|-----------------------------------|--------------------------|
| `token:blacklist:{jti}`          | Logout JWT blacklist              | Remaining token lifetime |
| `ratelimit:{ip}`                 | Global API rate limit counter     | 1 minute                 |
| `ratelimit:upload:{ip}`          | Upload rate limit counter         | 1 minute                 |
| `ratelimit:otp:{email}`          | OTP send rate limit               | Configurable             |
| `otp:password-reset:{email}`     | Password reset OTP                | 10 minutes               |
| `hot:tags`                       | Hot tags sorted set (ZSet)        | Persistent               |
| `recommend:users:{user_id}`      | Recommended users cache           | 10 minutes               |

---

## Deployment

### Docker Image Details

**Backend** (`backend/Dockerfile`)
- Build stage: `golang:1.25-alpine` — compiles with `CGO_ENABLED=0` for a fully static binary
- Runtime stage: `alpine:3.21` with `ca-certificates` and `tzdata`
- Binary size minimized with `-ldflags="-s -w"`

**Frontend** (`frontend/Dockerfile`)
- Build stage: `node:22-alpine` — runs `npm ci` then `npm run build`
- Runtime stage: `nginx:alpine` — serves static assets, proxies `/api/*` and `/uploads/*` to the backend

### Production Checklist

- [ ] Set a strong, random `JWT_SECRET`
- [ ] Tighten CORS origins in the backend (currently allows `*`)
- [ ] Point `BASE_URL` to your domain or IP
- [ ] Configure DNS and add SSL/TLS (e.g., Certbot + Nginx)
- [ ] Back up the `uploads` Docker volume regularly

---

## Frontend Pages

| Route             | Page             | Auth Required |
|-------------------|------------------|:---:|
| `/`               | Login            | No  |
| `/register`       | Register         | No  |
| `/forgot-password`| Forgot Password  | No  |
| `/reset-password` | Reset Password   | No  |
| `/home`           | Home Feed        | Yes |
| `/users/:id`      | User Profile     | Yes |
| `/profile/edit`   | Edit Profile     | Yes |
| `/search`         | Search           | Yes |
| `/tags/:name`     | Posts by Tag     | Yes |

---

## License

This project is for personal / educational use.
