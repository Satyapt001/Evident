import { API_BASE_URL } from '@/lib/constants'

const ROOT = API_BASE_URL.replace(/\/+$/, '')

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  let body: any = null
  try { body = await response.json() } catch {}
  if (!response.ok) {
    throw new Error(typeof body?.detail === 'string' ? body.detail : `API request failed (${response.status})`)
  }
  return body as T
}

export const getNetworkPreset = (id: string) => req<any>(`${ROOT}/network/preset/${id}`)
export const getBlockedIPs = () => req<{items:any[]}>(`${ROOT}/network/blocked-ips`)
export const blockIP = (payload: {ip_address:string; severity:string; reason:string}) =>
  req<any>(`${ROOT}/network/blocked-ips`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
export const unblockIP = (ip: string) =>
  req<any>(`${ROOT}/network/blocked-ips/${encodeURIComponent(ip)}`, {method:'DELETE'})
export const getLockdown = () => req<any>(`${ROOT}/network/lockdown`)
export const setLockdown = (enabled: boolean) =>
  req<any>(`${ROOT}/network/lockdown`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({enabled})})
export const getSockets = () => req<{items:any[]}>(`${ROOT}/network/sockets`)
