import request from './request'

export interface ReportRow {
  report_id: string
  reporter_id: string
  reporter_username: string
  target_type: 'post' | 'comment'
  target_id: string
  reason: string
  status: 'pending' | 'removed' | 'dismissed'
  created_at: string
  content_preview: string
  target_author_id: string
  target_author_username: string
  target_removed: boolean
}

export interface AdminUserRow {
  user_id: string
  username: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  is_banned: boolean
  ban_reason?: string
  is_post_restricted: boolean
  restricted_reason?: string
  post_count: number
  created_at: string
}

export const listReports = (status: string, offset = 0, limit = 20) =>
  request<{ reports: ReportRow[]; total: number }>(
    `/api/admin/reports?status=${status}&offset=${offset}&limit=${limit}`
  )

export const resolveReport = (reportId: string, action: 'remove' | 'dismiss') =>
  request<{ message: string }>(`/api/admin/reports/${reportId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  })

export const listUsersAdmin = (query: string, role: string, offset = 0, limit = 20) =>
  request<{ users: AdminUserRow[]; total: number }>(
    `/api/admin/users?query=${encodeURIComponent(query)}&role=${role}&offset=${offset}&limit=${limit}`
  )

export const banUser = (userId: string, reason: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/ban`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const unbanUser = (userId: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/unban`, { method: 'POST' })

export const restrictUser = (userId: string, reason: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/restrict`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const unrestrictUser = (userId: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/unrestrict`, { method: 'POST' })

export const adminDeleteUser = (userId: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}`, { method: 'DELETE' })

export const promoteToAdmin = (userId: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/promote`, { method: 'POST' })

export const demoteAdmin = (userId: string) =>
  request<{ message: string }>(`/api/admin/users/${userId}/demote`, { method: 'POST' })

export const adminDeletePost = (postId: string) =>
  request<{ message: string }>(`/api/admin/posts/${postId}`, { method: 'DELETE' })

export const adminDeleteComment = (commentId: string) =>
  request<{ message: string }>(`/api/admin/comments/${commentId}`, { method: 'DELETE' })
