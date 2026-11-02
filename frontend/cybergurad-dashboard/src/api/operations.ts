import { API_BASE_URL } from '@/lib/constants'
import type { ControlStatus, FirewallRule, MalwareResult, SimulationResult, TelemetrySnapshot } from '@/types/operations'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  const text = await response.text()
  let payload: unknown = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = null }
  if (!response.ok) {
    const detail = typeof payload === 'object' && payload && 'detail' in payload ? String((payload as { detail: unknown }).detail) : text || `HTTP ${response.status}`
    throw new Error(detail)
  }
  return payload as T
}

export const getTelemetry = () => request<TelemetrySnapshot>('/admin/telemetry')
export const getControlStatus = () => request<ControlStatus>('/admin/status')
export const lockdown = () => request<ControlStatus>('/admin/lockdown', { method: 'POST' })
export const unlock = () => request<ControlStatus>('/admin/unlock', { method: 'POST' })
export const getFirewall = () => request<FirewallRule[]>('/admin/firewall')
export const blockIp = (ip: string, severity: string, reason: string) => request<FirewallRule>('/admin/firewall/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip, severity, reason }) })
export const unblockIp = (ip: string) => request<{ removed: boolean }>('/admin/firewall/unblock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip }) })
export const simulateNetwork = (vector: string) => request<SimulationResult>('/admin/network/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vector }) })

export async function analyzeUrl(url: string) {
  return request<Record<string, unknown>>('/analyze/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
}

export async function analyzeImage(file: File) {
  const form = new FormData(); form.append('file', file)
  return request<Record<string, unknown>>('/analyze/image', { method: 'POST', body: form })
}

export async function analyzeMalware(file: File) {
  const form = new FormData(); form.append('file', file)
  return request<MalwareResult>('/analyze/malware', { method: 'POST', body: form })
}
