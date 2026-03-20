import request from './request'

export interface User {
  user_id: string
  username: string
  email: string
  profile_picture: string
}

export interface LoginResponse {
  message: string
  token: string
  user: User
}

export interface RegisterResponse {
  message: string
  user: {
    user_id: string
    username: string
    email: string
    created_at: string
  }
}

export const login = (email: string, password: string) =>
  request<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const register = (username: string, email: string, password: string) =>
  request<RegisterResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })

export const sendPasswordResetCode = (email: string) =>
  request<{ message: string }>('/api/auth/password-reset/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const confirmPasswordReset = (email: string, otp_code: string, new_password: string) =>
  request<{ message: string }>('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, otp_code, new_password }),
  })
