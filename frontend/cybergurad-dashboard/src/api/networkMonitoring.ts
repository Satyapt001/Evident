import { API_BASE_URL } from '@/lib/constants'

const ROOT = API_BASE_URL.replace(/\/+$/, '')

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${ROOT}${path}`, {
    headers: { Accept: 'application/json' },
  })

  let body: any = null
  try {
    body = await response.json()
  } catch {
    // Some error responses may not contain JSON.
  }

  if (!response.ok) {
    throw new Error(
      typeof body?.detail === 'string'
        ? body.detail
        : `API request failed (${response.status})`,
    )
  }

  return body as T
}

export type BackendIncident = {
  request_id?: string
  event_id?: string
  timestamp?: string
  source?: string
  threat_type?: string
  prediction?: string
  risk_score?: number | null
  risk_level?: string
  confidence?: number
  explanation?: string
  indicators?: unknown[]
  status?: string
  metadata?: Record<string, unknown>
  action_history?: Array<Record<string, unknown>>
  last_action?: Record<string, unknown>
  [key: string]: unknown
}

export type HostTelemetry = Record<string, unknown>

export type AdminStatus = {
  lockdown?: boolean
  enforcement_mode?: string
  blocked_ips?: unknown[]
  updated_at?: string
}

export type SysmonObservation = {
  event_id?: number | string
  record_id?: number | string
  timestamp?: string
  source?: string
  status?: string
  classification_status?: string
  prediction?: string
  risk_level?: string
  risk_score?: number | null
  metadata?: Record<string, unknown>
  event_data?: Record<string, unknown>
  [key: string]: unknown
}

export type SysmonEventsResponse = {
  count: number
  events: SysmonObservation[]
  source: string
  persistent: boolean
}

export const getNetworkEvents = (limit = 250) =>
  getJson<BackendIncident[]>(`/incidents?limit=${Math.min(1000, Math.max(1, limit))}`)

export const getHostTelemetry = () => getJson<HostTelemetry>('/admin/telemetry')

export const getAdminStatus = () => getJson<AdminStatus>('/admin/status')

export const getNetworkHealth = () => getJson<Record<string, unknown>>('/analyze/network/health')

export const getSysmonEvents = (limit = 100) =>
  getJson<SysmonEventsResponse>(
    `/telemetry/sysmon/events?limit=${Math.min(1000, Math.max(1, limit))}`,
  )
