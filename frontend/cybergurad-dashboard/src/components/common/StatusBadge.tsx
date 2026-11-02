import type { CSSProperties } from 'react'
import { STATUS_COLORS } from '@/lib/constants'
import type { IncidentStatus } from '@/types/incident'

export default function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className="badge" style={{ '--c': STATUS_COLORS[status] } as CSSProperties}>
      {status}
    </span>
  )
}
