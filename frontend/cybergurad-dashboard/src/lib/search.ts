import type { SearchDoc, SearchKind } from '@/api/search'
import { NAV_GROUPS } from '@/lib/navigation'

export type ResultKind = SearchKind | 'page' | 'action'

export interface Result {
  id: string
  kind: ResultKind
  title: string
  subtitle: string
  to?: string
  command?: 'theme' | 'signout'
  severity?: string
}

export const GROUP_LABEL: Record<ResultKind, string> = {
  action: 'Actions',
  page: 'Pages',
  incident: 'Detections',
  indicator: 'Indicators',
  blocked: 'Blocked IPs',
  socket: 'Live connections',
}
const GROUP_ORDER: ResultKind[] = ['action', 'page', 'incident', 'indicator', 'blocked', 'socket']

const PAGE_KEYWORDS: Record<string, string> = {
  '/': 'dashboard overview home stats timeline telemetry',
  '/incidents': 'incidents events detections queue triage cases',
  '/analysis/phishing': 'phishing url email social engineering scam link analyze',
  '/analysis/deepfake': 'deepfake impersonation image face media authenticity upload',
  '/analysis/network': 'network technical firewall block ip lockdown traffic flow monitoring sockets',
  '/analysis/malware': 'malware file hash sha256 triage upload sample virus',
  '/live-threats': 'live feed realtime',
  '/intelligence': 'threat intelligence ioc openphish phishtank otx urlhaus',
  '/evidence': 'evidence artefacts chain of custody',
  '/settings': 'settings account profile theme appearance team users organization backend connection',
}

const pages: Result[] = NAV_GROUPS.flatMap((g) => g.items).map((item) => ({
  id: `page:${item.path}`,
  kind: 'page' as const,
  title: item.label,
  subtitle: PAGE_KEYWORDS[item.path]?.split(' ').slice(0, 4).join(' · ') ?? '',
  to: item.path,
}))

const pageHay = new Map(pages.map((p) => [p.id, `${p.title} ${PAGE_KEYWORDS[p.to!] ?? ''}`.toLowerCase()]))

const URLISH = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i

function score(hay: string, tokens: string[], title: string): number {
  let total = 0
  const t = title.toLowerCase()
  for (const token of tokens) {
    const at = hay.indexOf(token)
    if (at < 0) return -1
    total += t.startsWith(token) ? 0 : t.includes(token) ? 2 : 5
    total += at / 1000
  }
  return total
}

export function search(query: string, docs: SearchDoc[], theme: 'dark' | 'light', limitPerGroup = 5): Result[] {
  const q = query.trim()
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  const out: Result[] = []

  const commands: Array<Result & { hay: string }> = [
    { id: 'cmd:theme', kind: 'action', title: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, subtitle: 'Appearance', command: 'theme', hay: 'theme appearance dark light mode switch toggle' },
    { id: 'cmd:signout', kind: 'action', title: 'Sign out', subtitle: 'End this session', command: 'signout', hay: 'sign out log out logout session' },
  ]

  // Empty query: offer every page plus the two commands, so the box is useful on focus.
  if (!tokens.length) {
    return [...pages, ...commands.map(({ hay: _hay, ...rest }) => (void _hay, rest))]
  }

  if (URLISH.test(q)) {
    const url = /^https?:\/\//i.test(q) ? q : `https://${q}`
    out.push({ id: `act:phish:${q}`, kind: 'action', title: `Analyze ${q} for phishing`, subtitle: 'Opens Phishing analysis and runs the URL check', to: `/analysis/phishing?url=${encodeURIComponent(url)}` })
  }
  for (const c of commands) if (score(c.hay, tokens, c.title) >= 0) { const { hay: _hay, ...rest } = c; void _hay; out.push(rest) }

  const rankedPages = pages
    .map((p) => ({ p, s: score(pageHay.get(p.id) ?? '', tokens, p.title) }))
    .filter((x) => x.s >= 0).sort((a, b) => a.s - b.s).slice(0, limitPerGroup).map((x) => x.p)
  out.push(...rankedPages)

  const byKind = new Map<SearchKind, Array<{ d: SearchDoc; s: number }>>()
  for (const d of docs) {
    const s = score(d.haystack, tokens, d.title)
    if (s < 0) continue
    if (!byKind.has(d.kind)) byKind.set(d.kind, [])
    byKind.get(d.kind)!.push({ d, s })
  }
  for (const [, list] of byKind) {
    list.sort((a, b) => a.s - b.s)
    for (const { d } of list.slice(0, limitPerGroup)) out.push({ id: d.id, kind: d.kind, title: d.title, subtitle: d.subtitle, to: d.to, severity: d.severity })
  }

  return out.sort((a, b) => GROUP_ORDER.indexOf(a.kind) - GROUP_ORDER.indexOf(b.kind))
}
