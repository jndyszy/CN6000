import request from './request'
import type { UserProfile, SimpleUser, Post } from '../types'

export const getUserProfile = (userId: string) =>
  request<{ user: UserProfile; posts: Post[] }>(`/api/users/${userId}`)

export const getFollowing = (userId: string) =>
  request<{ users: SimpleUser[] }>(`/api/users/${userId}/following`)

export const getFollowers = (userId: string) =>
  request<{ users: SimpleUser[] }>(`/api/users/${userId}/followers`)

export const followUser = (userId: string) =>
  request<{ message: string }>(`/api/users/${userId}/follow`, { method: 'POST' })

export const unfollowUser = (userId: string) =>
  request<{ message: string }>(`/api/users/${userId}/follow`, { method: 'DELETE' })

export const updateProfile = (data: {
  username?: string
  bio?: string
  profile_picture?: string
  email?: string
}) =>
  request<{ message: string; user: Partial<UserProfile> }>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteAccount = () =>
  request<{ message: string }>('/api/users/me', { method: 'DELETE' })

export const sendChangePasswordCode = () =>
  request<{ message: string }>('/api/users/me/password/send-code', { method: 'POST' })

export const confirmChangePassword = (otp_code: string, new_password: string) =>
  request<{ message: string }>('/api/users/me/password/confirm', {
    method: 'POST',
    body: JSON.stringify({ otp_code, new_password }),
  })
