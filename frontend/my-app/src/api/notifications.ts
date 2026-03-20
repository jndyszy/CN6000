import request from './request'
import type { Notification } from '../types'

export const getNotifications = () =>
  request<{ notifications: Notification[]; unread_count: number }>('/api/notifications')

export const getUnreadCount = () =>
  request<{ unread_count: number }>('/api/notifications/unread-count')

export const markAllRead = () =>
  request<{ message: string }>('/api/notifications/read-all', { method: 'POST' })
