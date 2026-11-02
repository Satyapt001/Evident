const nf = new Intl.NumberFormat('en-US')

export const formatNumber = (n: number): string => nf.format(n)

export const formatPercent = (n: number, digits = 1): string => `${n.toFixed(digits)}%`

export const formatChange = (n: number): string => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`

export function formatUtcClock(d: Date): string {
  return d.toISOString().slice(11, 19) + ' UTC'
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const m = Math.floor(diffSec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19) + 'Z'
}
