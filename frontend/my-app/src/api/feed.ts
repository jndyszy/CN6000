import request from './request'
import type { HomeFeedResponse, FeedPostsResponse } from '../types'

export const getHomeFeed = (sort: 'timeline' | 'community' = 'timeline') =>
  request<HomeFeedResponse>(`/api/feed/home?sort=${sort}`)

export const getMorePosts = (cursor: string, limit = 20, sort: 'timeline' | 'community' = 'timeline') =>
  request<FeedPostsResponse>(
    `/api/feed/posts?sort=${sort}&cursor=${encodeURIComponent(cursor)}&limit=${limit}`
  )
