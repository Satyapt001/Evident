import { ShieldAlert, RefreshCw } from 'lucide-react'
import Panel from '@/components/common/Panel'
import type { Incident } from '@/types/incident'
import SeverityBadge from '@/components/common/SeverityBadge'

export default function IncidentLedger({ incidents, onRefresh, onSelect }: { incidents: Incident[]; onRefresh: () => void; onSelect?: (incident: Incident) => void }) {
  return <Panel title="LIVE INCIDENT LEDGER" subtitle="BACKEND-SOURCED / ACTIONABLE EVENTS" right={<button className="icon-btn panel-refresh" onClick={onRefresh} aria-label="Refresh incidents"><RefreshCw size={14} /></button>} flush>
    {incidents.length === 0 ? <div className="ledger-empty"><ShieldAlert size={24} /><b>NO ACTIVE EVENTS</b><span>Detections raised by the models will appear here.</span></div> : <div className="ledger">{incidents.slice(0, 6).map((inc) => <button className="ledger-item" key={inc.id} onClick={() => onSelect?.(inc)}><div className="ledger-icon"><ShieldAlert size={15} /></div><div><strong>{inc.title}</strong><span>{inc.summary}</span><small>{inc.source} · {inc.status}</small></div><SeverityBadge level={inc.risk} /></button>)}</div>}
  </Panel>
}
