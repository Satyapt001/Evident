import { API_BASE_URL } from '@/lib/constants'

const BASE_URL = API_BASE_URL.replace(/\/+$/, '')

const API_ROOT = BASE_URL.endsWith('/api/v1')
  ? BASE_URL
  : `${BASE_URL}/api/v1`

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_ROOT}/telemetry${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    let message = `Telemetry request failed (${response.status})`
    try {
      const payload = await response.json()
      message = payload.detail || payload.message || message
    } catch { /* retain HTTP status */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export interface TelemetrySummary {
  collected_at: string; host: string; platform: string; uptime_seconds: number
  cpu: { percent: number; logical_cores: number; physical_cores: number | null; per_core_percent: number[]; frequency_mhz: number | null }
  memory: { total_bytes: number; available_bytes: number; used_bytes: number; percent: number; swap_total_bytes: number; swap_used_bytes: number; swap_percent: number }
  disk: { mount: string; total_bytes: number; used_bytes: number; free_bytes: number; percent: number }
  network: { bytes_received_total: number | null; bytes_sent_total: number | null; packets_received_total: number | null; packets_sent_total: number | null; receive_bytes_per_sec: number | null; send_bytes_per_sec: number | null }
}
export interface TelemetryConnection {
  family: string; type: string; local_address: string | null; local_port: number | null
  remote_address: string | null; remote_port: number | null; status: string
  pid: number | null; process: string | null; is_listening: boolean
}
export interface TelemetryProcess {
  pid: number; name: string | null; username: string | null; status: string | null
  memory_rss_bytes: number | null; cpu_percent: number | null; created_at: string | null
}
export interface TelemetryListResponse<T> {
  collected_at: string; count: number; returned: number; note: string
  connections?: T[]; processes?: T[]
}
export const getTelemetrySummary = () => request<TelemetrySummary>('/summary')
export const getTelemetryConnections = () => request<TelemetryListResponse<TelemetryConnection>>('/connections?limit=100')
export const getTelemetryProcesses = () => request<TelemetryListResponse<TelemetryProcess>>('/processes?limit=50')
