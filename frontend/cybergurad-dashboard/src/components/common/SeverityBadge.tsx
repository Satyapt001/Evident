import type { CSSProperties } from 'react'
import { SEVERITY_COLORS } from '@/lib/constants'
import type { Severity } from '@/types/threat'

export default function SeverityBadge({ level }: { level: Severity }) {
  return (
    <span className="badge badge--solid-dot" style={{ '--c': SEVERITY_COLORS[level] } as CSSProperties}>
      {level}
    </span>
  )
}
