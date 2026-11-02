import { API_BASE_URL } from '@/lib/constants'

const API_ROOT = API_BASE_URL.replace(/\/+$/, '')

async function parse<T>(response: Response): Promise<T> {
  let body: unknown = null
  try { body = await response.json() } catch {}
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body
      ? String((body as { detail: unknown }).detail)
      : `API request failed (HTTP ${response.status})`
    throw new Error(detail)
  }
  return body as T
}

export interface AdminAction {
  action_id: string
  name: string
  description: string
  category: string
  priority: string
  requires_approval: boolean
  available: boolean
  recommended: boolean
  reason: string
  status: string
}

export interface ActionExecution {
  action_id: string
  name: string
  status: string
  message: string
  actor: string
  timestamp: string
  request_id: string
  incident_id?: string | null
  metadata?: Record<string, unknown>
}

export interface ActionListResponse {
  request_id: string
  incident_id?: string | null
  actions: AdminAction[]
  executions: ActionExecution[]
  case?: Record<string, unknown> | null
}

export async function getAdminActions(requestId: string) {
  const response = await fetch(`${API_ROOT}/actions?request_id=${encodeURIComponent(requestId)}`, {
    headers: { Accept: 'application/json' },
  })
  return parse<ActionListResponse>(response)
}

export async function executeAdminAction(payload: {
  request_id: string
  action_id: string
  approved: boolean
  note?: string
  actor?: string
}) {
  const response = await fetch(`${API_ROOT}/actions/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  return parse<ActionExecution>(response)
}
