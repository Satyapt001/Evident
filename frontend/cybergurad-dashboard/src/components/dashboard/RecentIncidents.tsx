import { Siren } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import Panel from '@/components/common/Panel'
import SeverityBadge from '@/components/common/SeverityBadge'
import StatusBadge from '@/components/common/StatusBadge'
import { CATEGORY_LABELS } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Incident } from '@/types/incident'

interface RecentIncidentsProps {
  incidents: Incident[]
  selectedId?: string | null
  onSelect: (incident: Incident) => void
}

export default function RecentIncidents({ incidents, selectedId, onSelect }: RecentIncidentsProps) {
  return (
    <Panel title="RECENT INCIDENTS" subtitle={`${incidents.length} MOST RECENT / SELECT A ROW FOR DETAIL`} flush>
      {incidents.length === 0 ? (
        <EmptyState icon={Siren} title="NO RECENT INCIDENTS" message="New incidents appear here as soon as a detection is escalated." />
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>INCIDENT</th>
                <th>CATEGORY</th>
                <th>SOURCE</th>
                <th>RISK</th>
                <th>STATUS</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc.id}
                  tabIndex={0}
                  className={cn(selectedId === inc.id && 'is-selected')}
                  onClick={() => onSelect(inc)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(inc)
                    }
                  }}
                >
                  <td>
                    <div className="inc-id">{inc.id}</div>
                    <div className="inc-title">{inc.title}</div>
                  </td>
                  <td className="cell-dim">{CATEGORY_LABELS[inc.category]}</td>
                  <td className="cell-dim">{inc.source}</td>
                  <td>
                    <SeverityBadge level={inc.risk} />
                  </td>
                  <td>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="cell-time">{formatRelativeTime(inc.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
