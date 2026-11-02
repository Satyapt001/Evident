import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Siren, X } from 'lucide-react'
import { getIncidents } from '@/api/dashboard'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import SeverityBadge from '@/components/common/SeverityBadge'
import StatusBadge from '@/components/common/StatusBadge'
import IncidentDrawer from '@/components/incidents/IncidentDrawer'
import { CATEGORY_LABELS, SEVERITY_ORDER } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Incident } from '@/types/incident'

const LEVELS = SEVERITY_ORDER.filter((s) => s !== 'SAFE')

export default function Incidents() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<string>('ALL')
  const [selected, setSelected] = useState<Incident | null>(null)

  const query = params.get('q') ?? ''
  const focus = params.get('focus')

  const load = useCallback(async () => {
    try { setItems(await getIncidents(500)); setError(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load incidents.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 5000); return () => window.clearInterval(id) }, [load])

  // Arriving from search with ?focus=<id> opens that detection once it has loaded.
  useEffect(() => {
    if (!focus || !items.length) return
    const hit = items.find((i) => i.id === focus)
    if (hit) { setSelected(hit); const next = new URLSearchParams(params); next.delete('focus'); setParams(next, { replace: true }) }
  }, [focus, items, params, setParams])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => (level === 'ALL' || i.risk === level) && (!q || `${i.id} ${i.title} ${i.source} ${i.summary} ${i.status} ${i.category}`.toLowerCase().includes(q)))
  }, [items, level, query])

  const setQuery = (value: string) => { const next = new URLSearchParams(params); if (value) next.set('q', value); else next.delete('q'); setParams(next, { replace: true }) }

  if (loading && !items.length) return <LoadingState />

  return (
    <>
      <PageHeader title="INCIDENTS" telemetry={[`${shown.length} of ${items.length} shown`, 'Refreshes every 5s']} />
      {error && <ErrorState message={error} onRetry={load} />}

      <div className="filters">
        <label className="filters__search"><Search aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by ID, indicator, source or status" aria-label="Filter incidents" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear filter"><X /></button>}
        </label>
        <div className="seg" role="group" aria-label="Risk level">
          {['ALL', ...LEVELS].map((l) => <button key={l} type="button" className={cn('seg__opt', level === l && 'is-on')} aria-pressed={level === l} onClick={() => setLevel(l)}>{l === 'ALL' ? 'All' : l[0] + l.slice(1).toLowerCase()}</button>)}
        </div>
      </div>

      <Panel title="Detections" subtitle="Select a row for detail" flush>
        {!shown.length ? (
          <EmptyState icon={Siren} title={items.length ? 'NO MATCHES' : 'NO DETECTIONS YET'} message={items.length ? 'Nothing matches this filter. Clear it to see every detection.' : 'Run an analysis from Phishing, Deepfake, Network or Malware triage and the result is recorded here.'} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Detection</th><th>Category</th><th>Source</th><th>Risk</th><th>Status</th><th>Time</th></tr></thead>
              <tbody>
                {shown.map((inc) => (
                  <tr key={inc.id} tabIndex={0} className={cn(selected?.id === inc.id && 'is-selected')} onClick={() => setSelected(inc)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(inc) } }}>
                    <td><div className="inc-id">{inc.id}</div><div className="inc-title">{inc.title}</div></td>
                    <td className="cell-dim">{CATEGORY_LABELS[inc.category]}</td>
                    <td className="cell-dim">{inc.source}</td>
                    <td><SeverityBadge level={inc.risk} /></td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td className="cell-time">{formatRelativeTime(inc.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
