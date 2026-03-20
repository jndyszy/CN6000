# CN6000 Social Platform — Frontend

## Overview

This is the frontend for a Xiaohongshu-inspired lifestyle content sharing platform, built with React and TypeScript. It consumes the Go/Gin REST API and provides a fully interactive single-page application experience.

## Key Features

- **Authentication**: JWT stored in localStorage with automatic 401 detection; OTP-based password reset via email
- **Dual-mode Feed**: Toggle between chronological timeline and community-weighted hot ranking, with preference persisted across sessions
- **Post Management**: Full CRUD with image upload, hashtag tagging, and three-tier visibility control (`public` / `followers` / `private`)
- **Social Interactions**: Follow/unfollow, likes with optimistic updates, lazy-loaded comments, and clickable user/tag navigation
- **Content Moderation**: Report posts and comments with categorised reasons
- **GDPR Compliance**: Account deletion flow with username confirmation, clears all local state on success
- **Discovery**: Full-text post search, user search, hot tags sidebar, recommended users sidebar, and tag browsing pages

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 7 |
| Routing | React Router v6 |
| HTTP | Native Fetch API |
| Styling | React inline CSSProperties |
| Auth | JWT Bearer Token (localStorage) |

## Implementation Highlights

**JWT Handling**: The shared `request.ts` wrapper only redirects to `/` on 401 if a token already exists in localStorage. This prevents login failure responses from triggering an unwanted redirect loop.

**Optimistic Updates**: Like/unlike interactions update the UI immediately and roll back silently on API failure, keeping interactions feel instant without requiring a refetch.

**Infinite Scroll**: Uses `IntersectionObserver` on a sentinel element at the bottom of the feed. Supports both RFC3339Nano timestamp cursors (timeline mode) and integer OFFSET cursors (community mode).

**Dual Cursor Strategy**: The community-weighted feed uses integer offset cursors rather than timestamp cursors, since HackerNews-style scores change over time and a time-based cursor would produce inconsistent pages.

**Image Upload**: Uses raw `fetch` with `FormData` rather than the shared JSON wrapper, allowing the browser to set the `multipart/form-data` boundary automatically.

**Post Creation Fix**: The `POST /api/posts` response omits display fields (`username`, `profile_picture`, `like_count`, etc.). On success, the new post is constructed by merging the API response with the current user's cached data before prepending it to the feed.

## Project Structure

```
src/
├── api/            # One file per domain (auth, feed, posts, users, search, upload)
├── components/     # PostCard — the core interactive unit of the app
├── pages/          # One file per route
├── router/         # BrowserRouter + Routes config
└── types/          # Shared TypeScript interfaces
```

## Routes

| Path | Page |
|------|------|
| `/` | Login |
| `/register` | Register |
| `/forgot-password` | Forgot Password |
| `/reset-password` | Reset Password |
| `/home` | Home Feed |
| `/users/:id` | User Profile |
| `/profile/edit` | Edit Profile |
| `/search` | Search |
| `/tags/:name` | Tag Posts |

## Getting Started

Requires Node.js 18+ and the backend API running at `http://localhost:8080`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```
