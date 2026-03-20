import request from './request'
import type { SimpleUser, FeedPostsResponse } from '../types'

export const searchUsers = (q: string, limit = 20) =>
  request<{ users: SimpleUser[]; total: number }>(
    `/api/search/users?q=${encodeURIComponent(q)}&limit=${limit}`
  )

export const searchPosts = (q: string, cursor = '', limit = 20) =>
  request<FeedPostsResponse>(
    `/api/search/posts?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}&limit=${limit}`
  )
