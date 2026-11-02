import type { Severity, ThreatCategory } from './threat'

export type StatKey = 'events' | 'threats' | 'critical' | 'incidents'

export interface StatSummary {
  key: StatKey
  label: string
  value: number
  /** Percent change vs previous period; positive = increase */
  change: number
  /** Whether an increase is bad for the operator */
  upIsBad: boolean
  caption: string
}

export interface TimelinePoint {
  time: string
  benign: number
  suspicious: number
  confirmed: number
}

export interface RiskSlice {
  level: Severity
  count: number
}

export interface CategoryStat {
  category: ThreatCategory
  count: number
}
