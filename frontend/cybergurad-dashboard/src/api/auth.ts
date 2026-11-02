import { request } from './client'

export type Role = 'admin' | 'analyst'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  organization: string
  created_at: string
  last_login: string | null
}

export interface AuthStatus { initialized: boolean; organization: string | null; auth_enforced: boolean }
export interface TokenResponse { access_token: string; token_type: 'bearer'; expires_in: number; user: User }

export const getAuthStatus = () => request<AuthStatus>('/auth/status')

export const login = (email: string, password: string) =>
  request<TokenResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const setupConsole = (payload: { organization: string; name: string; email: string; password: string }) =>
  request<TokenResponse>('/auth/setup', { method: 'POST', body: JSON.stringify(payload) })

export const getMe = () => request<User>('/auth/me')
export const logoutRequest = () => request<{ status: string }>('/auth/logout', { method: 'POST' })

export const listUsers = () => request<User[]>('/auth/users')
export const createUser = (payload: { name: string; email: string; password: string; role: Role }) =>
  request<User>('/auth/users', { method: 'POST', body: JSON.stringify(payload) })
