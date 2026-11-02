import { API_BASE_URL } from '@/lib/constants'

export const API_ROOT = API_BASE_URL.replace(/\/+$/, '')

/* ---------- session token ---------- */
const TOKEN_KEY = 'cyberguard.auth.token'

export const tokenStore = {
  get(): string | null {
    try { return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  /** remember=true keeps the session across browser restarts; otherwise it ends with the tab. */
  set(token: string, remember: boolean) {
    this.clear()
    try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token) } catch { /* ignore */ }
  },
  clear() {
    try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  },
}

let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(handler: (() => void) | null) { unauthorizedHandler = handler }

const PUBLIC_PATHS = /^\/(health|auth\/(status|login|setup))(\?|$)/

/**
 * Adds the signed-in user's bearer token to every request aimed at the CYBERGUARD API,
 * so the existing api/* modules stay unchanged. A 401 on a protected call ends the session.
 */
export function installAuthFetch() {
  const w = window as Window & { __cgAuthFetch?: boolean }
  if (w.__cgAuthFetch) return
  w.__cgAuthFetch = true
  const original = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(API_ROOT)) return original(input, init)

    const request = new Request(input, init)
    const token = tokenStore.get()
    if (token && !request.headers.has('Authorization')) request.headers.set('Authorization', `Bearer ${token}`)

    const response = await original(request)
    if (response.status === 401 && token && !PUBLIC_PATHS.test(url.slice(API_ROOT.length))) {
      tokenStore.clear()
      unauthorizedHandler?.()
    }
    return response
  }
}

/* ---------- small JSON helper for new modules ---------- */
export class ApiError extends Error {
  status: number
  retryAfter?: number
  constructor(message: string, status: number, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

function describeDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ msg: 'Value error, Password must ...' }]
    const first = detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg.replace(/^Value error, /, '')
  }
  return `Request failed (HTTP ${status})`
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_ROOT}. Check that it is running.`, 0)
  }
  let body: unknown = null
  try { body = await response.json() } catch { /* non-JSON body */ }
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? (body as { detail: unknown }).detail : null
    const retry = Number(response.headers.get('Retry-After')) || undefined
    throw new ApiError(describeDetail(detail, response.status), response.status, retry)
  }
  return body as T
}
