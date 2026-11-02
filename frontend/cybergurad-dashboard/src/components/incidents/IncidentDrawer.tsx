import { useEffect } from 'react'
import { X } from 'lucide-react'
import SeverityBadge from '@/components/common/SeverityBadge'
import StatusBadge from '@/components/common/StatusBadge'
import { CATEGORY_LABELS } from '@/lib/constants'
import { formatRelativeTime, formatTimestamp } from '@/lib/formatters'
import type { Incident } from '@/types/incident'

export default function IncidentDrawer({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Incident ${incident.id}`}>
        <div className="drawer__head">
          <div>
            <span className="inc-id">{incident.id}</span>
            <h2>{incident.title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close incident detail">
            <X />
          </button>
        </div>
        <div className="drawer__body">
          <dl className="kv">
            <dt>RISK</dt>
            <dd><SeverityBadge level={incident.risk} /></dd>
            <dt>STATUS</dt>
            <dd><StatusBadge status={incident.status} /></dd>
            <dt>CATEGORY</dt>
            <dd>{CATEGORY_LABELS[incident.category]}</dd>
            <dt>SOURCE</dt>
            <dd>{incident.source}</dd>
            <dt>ASSIGNEE</dt>
            <dd>{incident.assignee}</dd>
            <dt>DETECTED</dt>
            <dd className="mono">{formatTimestamp(incident.detectedAt)} ({formatRelativeTime(incident.detectedAt)})</dd>
          </dl>
          <div>
            <div className="drawer__label">SUMMARY</div>
            <p className="drawer__summary">{incident.summary}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
