import request from './request'
import type { Post, Comment } from '../types'

export const createPost = (content: string, imageUrls: string[] = [], tags: string[] = [], visibility = 'public') =>
  request<{ message: string; post: Post }>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ content, image_urls: imageUrls, tags, visibility }),
  })

export const updatePost = (postId: string, content: string, imageUrls?: string[], tags?: string[] | null, visibility?: string | null) =>
  request<{ message: string; post: Partial<Post> }>(`/api/posts/${postId}`, {
    method: 'PUT',
    body: JSON.stringify({
      content,
      ...(imageUrls !== undefined ? { image_urls: imageUrls } : {}),
      tags: tags ?? null,
      visibility: visibility ?? null,
    }),
  })

export const deletePost = (postId: string) =>
  request<{ message: string }>(`/api/posts/${postId}`, { method: 'DELETE' })

export const likePost = (postId: string) =>
  request<{ message: string }>(`/api/posts/${postId}/like`, { method: 'POST' })

export const unlikePost = (postId: string) =>
  request<{ message: string }>(`/api/posts/${postId}/like`, { method: 'DELETE' })

export const getComments = (postId: string) =>
  request<{ comments: Comment[] }>(`/api/posts/${postId}/comments`)

export const createComment = (postId: string, content: string, parentId?: string) =>
  request<{ message: string; comment: Comment }>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, ...(parentId ? { parent_id: parentId } : {}) }),
  })

export const deleteComment = (postId: string, commentId: string) =>
  request<{ message: string }>(`/api/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
  })

export const reportPost = (postId: string, reason: string) =>
  request<{ message: string }>(`/api/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const reportComment = (postId: string, commentId: string, reason: string) =>
  request<{ message: string }>(`/api/posts/${postId}/comments/${commentId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
