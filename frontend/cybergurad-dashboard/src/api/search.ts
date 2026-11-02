import { request } from './client'

/** One searchable record. Everything here comes from a backend endpoint; nothing is invented. */
export type SearchKind = 'incident' | 'indicator' | 'blocked' | 'socket'

export interface SearchDoc {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  to: string
  haystack: string
  severity?: string
}

export interface SearchIndex {
  docs: SearchDoc[]
  loadedAt: number
  /** which backend sources answered, so the UI can say what it searched */
  sources: { events: number | null; blocked: number | null; sockets: number | null }
}

interface BackendEvent {
  request_id: string
  event_id?: string | null
  threat_type: string
  risk_level: string
  risk_score?: number
  explanation?: string
  source?: string
  status?: string
  timestamp?: string | null
  indicators?: unknown[]
  metadata?: Record<string, unknown>
}

interface BlockedItem { ip_address?: string; ip?: string; severity?: string; reason?: string; source?: string }
interface SocketItem { remote_ip?: string; remote_address?: string; raddr?: string; local_port?: number; remote_port?: number; status?: string; process?: string; pid?: number; [k: string]: unknown }

const URL_RE = /https?:\/\/[^\s"'<>\\)]+/gi
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
const HASH_RE = /\b(?:[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})\b/gi
const RANK: Record<string, number> = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }

const eventRef = (e: BackendEvent) => `EVT-${(e.event_id ?? e.request_id).slice(0, 12)}`

function extractIndicators(e: BackendEvent): string[] {
  // Only the fields that carry observables; skips model feature vectors in metadata.
  const meta = e.metadata ?? {}
  const parts = [JSON.stringify(e.indicators ?? []), e.explanation ?? '']
  for (const key of ['url', 'urls', 'sender', 'source_ip', 'src_ip', 'dst_ip', 'ip', 'ip_address', 'sha256', 'md5', 'sha1', 'hash', 'filename', 'file_name', 'domain']) {
    if (meta[key] !== undefined) parts.push(JSON.stringify(meta[key]))
  }
  const text = parts.join(' ')
  const found = new Set<string>()
  for (const m of text.match(URL_RE) ?? []) found.add(m.replace(/[.,;]+$/, ''))
  for (const m of text.match(IPV4_RE) ?? []) found.add(m)
  for (const m of text.match(HASH_RE) ?? []) found.add(m.toLowerCase())
  return [...found].slice(0, 12)
}

function buildEventDocs(events: BackendEvent[]): SearchDoc[] {
  const docs: SearchDoc[] = []
  const indicators = new Map<string, { count: number; worst: string; first: string }>()

  for (const e of events) {
    const id = eventRef(e)
    const level = (e.risk_level || 'LOW').toUpperCase()
    const when = e.timestamp ? new Date(e.timestamp).toLocaleString() : ''
    docs.push({
      id: `incident:${id}`,
      kind: 'incident',
      title: `${e.threat_type.replace(/_/g, ' ')}`,
      subtitle: [id, e.source, e.status, when].filter(Boolean).join(' · '),
      to: `/incidents?focus=${encodeURIComponent(id)}`,
      haystack: [id, e.event_id, e.request_id, e.threat_type, e.risk_level, e.source, e.status, e.explanation].join(' ').toLowerCase(),
      severity: level,
    })
    for (const value of extractIndicators(e)) {
      const prev = indicators.get(value)
      if (!prev) indicators.set(value, { count: 1, worst: level, first: id })
      else {
        prev.count += 1
        if ((RANK[level] ?? 0) > (RANK[prev.worst] ?? 0)) prev.worst = level
      }
    }
  }

  for (const [value, info] of indicators) {
    docs.push({
      id: `indicator:${value}`,
      kind: 'indicator',
      title: value,
      subtitle: `Seen in ${info.count} detection${info.count === 1 ? '' : 's'}`,
      to: `/incidents?q=${encodeURIComponent(value)}`,
      haystack: value.toLowerCase(),
      severity: info.worst,
    })
  }
  return docs
}

export async function loadSearchIndex(): Promise<SearchIndex> {
  const [events, blocked, sockets] = await Promise.allSettled([
    request<BackendEvent[]>('/incidents?limit=1000'),
    request<{ items: BlockedItem[] }>('/network/blocked-ips'),
    request<{ items: SocketItem[] }>('/network/sockets'),
  ])

  const docs: SearchDoc[] = []
  if (events.status === 'fulfilled') docs.push(...buildEventDocs(events.value))

  if (blocked.status === 'fulfilled') {
    for (const b of blocked.value.items ?? []) {
      const ip = b.ip_address ?? b.ip
      if (!ip) continue
      docs.push({
        id: `blocked:${ip}`, kind: 'blocked', title: ip,
        subtitle: ['Blocked', b.severity, b.reason].filter(Boolean).join(' · '),
        to: '/analysis/network', haystack: [ip, b.severity, b.reason, b.source, 'blocked firewall'].join(' ').toLowerCase(),
        severity: b.severity?.toUpperCase(),
      })
    }
  }

  if (sockets.status === 'fulfilled') {
    for (const s of sockets.value.items ?? []) {
      const remote = s.remote_ip ?? s.remote_address ?? s.raddr
      if (!remote) continue
      const label = `${remote}${s.remote_port ? `:${s.remote_port}` : ''}`
      docs.push({
        id: `socket:${label}:${s.pid ?? ''}:${s.local_port ?? ''}`, kind: 'socket', title: label,
        subtitle: ['Live connection', s.status, s.process, s.pid ? `pid ${s.pid}` : ''].filter(Boolean).join(' · '),
        to: '/analysis/network', haystack: [label, s.status, s.process, 'connection socket'].join(' ').toLowerCase(),
      })
    }
  }

  return {
    docs,
    loadedAt: Date.now(),
    sources: {
      events: events.status === 'fulfilled' ? events.value.length : null,
      blocked: blocked.status === 'fulfilled' ? (blocked.value.items ?? []).length : null,
      sockets: sockets.status === 'fulfilled' ? (sockets.value.items ?? []).length : null,
    },
  }
}
