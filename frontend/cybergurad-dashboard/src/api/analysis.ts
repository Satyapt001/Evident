import { API_BASE_URL } from '@/lib/constants'

const API_ROOT = API_BASE_URL.replace(/\/$/, '')

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `API request failed (${response.status})`
    try {
      const body = await response.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {}
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export async function analyzeUrl(url: string) {
  const response = await fetch(`${API_ROOT}/analyze/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url, fetch_page: true, timeout: 8 }),
  })
  return parse<any>(response)
}

export async function analyzeImage(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(`${API_ROOT}/analyze/image`, {
    method: 'POST',
    body,
  })
  return parse<any>(response)
}

export async function analyzeNetwork(
  flow: Record<string, unknown>,
  context?: { source_ip?: string | null; destination_ip?: string | null; source_port?: number | null; destination_port?: number | null },
) {
  const response = await fetch(`${API_ROOT}/analyze/network`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ flow, ...(context ?? {}) }),
  })
  return parse<any>(response)
}
