import { API_BASE_URL } from '@/lib/constants'

const API_ROOT = API_BASE_URL.replace(/\/+$/, '')

async function parse<T>(response: Response): Promise<T> {
  let body: unknown = null
  try { body = await response.json() } catch {}

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `API request failed (HTTP ${response.status})`
    throw new Error(detail)
  }

  return body as T
}

export interface EmailAnalysisResult {
  request_id: string
  incident_id: string
  risk_score: number
  risk_level: string
  verdict: string
  confidence: number | null
  social_engineering_score: number
  explanation: string
  indicators: Array<{
    name: string
    category: string
    reason: string
    points: number
    evidence?: string
  }>
  entities: {
    urls: string[]
    domains: string[]
    ip_addresses: string[]
    email_addresses: string[]
  }
  url_results: Array<{
    url: string
    prediction: string
    phishing_probability: number | null
    risk_score: number | null
    risk_level: string
    threat_intelligence_matches: number
    error?: string
  }>
  recommendations: Array<{
    priority: string
    action: string
    reason: string
  }>
}

export async function analyzeEmail(payload: {
  sender: string
  subject: string
  body: string
}) {
  const response = await fetch(`${API_ROOT}/analyze/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      ...payload,
      analyze_urls: true,
    }),
  })
  return parse<EmailAnalysisResult>(response)
}

