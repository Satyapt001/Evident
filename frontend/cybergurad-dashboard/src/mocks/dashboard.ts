import type { CategoryStat, RiskSlice, StatSummary, TimelinePoint } from '@/types/dashboard'

export const mockStats: StatSummary[] = [
  { key: 'events', label: 'TOTAL EVENTS', value: 12847, change: 8.4, upIsBad: false, caption: 'last 24h, all sensors' },
  { key: 'threats', label: 'THREATS DETECTED', value: 342, change: 12.1, upIsBad: true, caption: 'suspicious + confirmed' },
  { key: 'critical', label: 'CRITICAL THREATS', value: 18, change: -5.3, upIsBad: true, caption: 'needs action now' },
  { key: 'incidents', label: 'ACTIVE INCIDENTS', value: 27, change: 3.8, upIsBad: true, caption: '9 unassigned' },
]

// 24 hourly buckets, deterministic so the chart looks the same on every load.
const benign = [412, 388, 361, 340, 329, 351, 427, 518, 634, 702, 741, 768, 752, 739, 721, 698, 674, 633, 584, 531, 489, 462, 441, 428]
const suspicious = [21, 18, 17, 15, 16, 19, 24, 31, 38, 44, 47, 51, 49, 46, 45, 42, 40, 37, 34, 30, 27, 25, 23, 22]
const confirmed = [2, 1, 1, 1, 2, 2, 3, 4, 6, 7, 9, 12, 14, 11, 9, 8, 7, 6, 5, 4, 3, 3, 2, 2]

export const mockTimeline: TimelinePoint[] = benign.map((b, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  benign: b,
  suspicious: suspicious[i],
  confirmed: confirmed[i],
}))

export const mockRisk: RiskSlice[] = [
  { level: 'SAFE', count: 11205 },
  { level: 'LOW', count: 1300 },
  { level: 'MEDIUM', count: 214 },
  { level: 'HIGH', count: 110 },
  { level: 'CRITICAL', count: 18 },
]

export const mockCategories: CategoryStat[] = [
  { category: 'PHISHING', count: 96 },
  { category: 'NETWORK ATTACK', count: 71 },
  { category: 'MALICIOUS URL', count: 58 },
  { category: 'ACCOUNT TAKEOVER', count: 44 },
  { category: 'API ABUSE', count: 36 },
  { category: 'DEEPFAKE', count: 22 },
  { category: 'DATA EXFILTRATION', count: 15 },
]
