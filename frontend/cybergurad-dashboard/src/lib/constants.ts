import type { Severity, ThreatCategory } from '@/types/threat'
import type { IncidentStatus } from '@/types/incident'

export const SEVERITY_COLORS: Record<Severity, string> = {
  SAFE: 'var(--sev-safe)',
  LOW: 'var(--sev-low)',
  MEDIUM: 'var(--sev-medium)',
  HIGH: 'var(--sev-high)',
  CRITICAL: 'var(--sev-critical)',
}

export const SEVERITY_ORDER: Severity[] = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export const STATUS_COLORS: Record<IncidentStatus, string> = {
  OPEN: 'var(--red)',
  INVESTIGATING: 'var(--cyan)',
  CONTAINED: 'var(--yellow)',
  RESOLVED: 'var(--green)',
}

/** Chart colours are CSS variables so both themes restyle charts without a re-render. */
export const CHART_COLORS = {
  benign: 'var(--cyan)',
  suspicious: 'var(--yellow)',
  confirmed: 'var(--red)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  cursor: 'var(--chart-cursor)',
}

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false'
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const CATEGORY_LABELS: Record<ThreatCategory, string> = {
  PHISHING: 'Phishing',
  DEEPFAKE: 'Deepfake',
  'ACCOUNT TAKEOVER': 'Account Takeover',
  'NETWORK ATTACK': 'Network',
  'MALICIOUS URL': 'Malicious URL',
  'API ABUSE': 'API Abuse',
  'DATA EXFILTRATION': 'Data Exfiltration',
}
