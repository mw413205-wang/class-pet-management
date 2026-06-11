import type { BadgeRecord, Class, Group, ScoreAction, ScoreRule, Student } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api'
const TOKEN_KEY = 'class-pet-token'
const REFRESH_TOKEN_KEY = 'class-pet-refresh-token'
const USER_KEY = 'class-pet-user'
let refreshPromise: Promise<boolean> | null = null

export interface AuthUser {
  id: number
  tenantId: number
  username: string
  displayName: string
  role: 'owner' | 'teacher'
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: AuthUser
}

export interface BootstrapData {
  classes: Class[]
  groups: Group[]
  students: Student[]
  scoreRules: ScoreRule[]
  recentActions: ScoreAction[]
  badgeRecords: BadgeRecord[]
  levelThresholds: number[]
  allowPetChange: boolean
  systemName: string
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const value = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
  if (!value) return null
  try {
    return JSON.parse(value) as AuthUser
  } catch {
    return null
  }
}

export function storeAuth(response: AuthResponse, remember = true) {
  clearAuth()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, response.token)
  storage.setItem(REFRESH_TOKEN_KEY, response.refreshToken)
  storage.setItem(USER_KEY, JSON.stringify(response.user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

function redirectToLogin() {
  if (window.location.pathname.startsWith('/dashboard')) {
    const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.assign(`/?redirect=${redirect}`)
  }
}

async function refreshAuth() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false
    const remember = Boolean(localStorage.getItem(REFRESH_TOKEN_KEY))
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!response.ok) return false
      storeAuth(await response.json() as AuthResponse, remember)
      return true
    } catch {
      return false
    }
  })()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const send = () => {
    const token = getAuthToken()
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  }
  let response = await send()
  if (response.status === 401 && authenticated && await refreshAuth()) {
    response = await send()
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 401 && authenticated) {
      clearAuth()
      redirectToLogin()
    }
    throw new Error(body.message || `请求失败：${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function api<T = void>(path: string, options: RequestInit = {}) {
  return request<T>(path, options, true)
}

export function authApi<T = void>(path: string, options: RequestInit = {}) {
  return request<T>(path, options, false)
}

export async function logout() {
  const refreshToken = getRefreshToken()
  try {
    if (refreshToken) {
      await authApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    }
  } catch {
    // 本地退出不应被网络故障阻断；服务端令牌仍会按有效期自然失效。
  } finally {
    clearAuth()
  }
}
