import type { Severity, ThreatCategory } from './threat'

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED'

export interface Incident {
  id: string
  title: string
  category: ThreatCategory
  /** Sensor or system that raised the detection */
  source: string
  risk: Exclude<Severity, 'SAFE'>
  status: IncidentStatus
  /** ISO timestamp */
  detectedAt: string
  assignee: string
  summary: string
}
