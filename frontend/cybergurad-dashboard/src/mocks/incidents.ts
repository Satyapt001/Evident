import type { Incident } from '@/types/incident'

// Anchor timestamps to "now" so relative times always look fresh in a demo.
const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString()

export const mockIncidents: Incident[] = [
  { id: 'INC-2026-00421', title: 'Credential Harvesting Attempt', category: 'PHISHING', source: 'Email Gateway', risk: 'HIGH', status: 'INVESTIGATING', detectedAt: minutesAgo(4), assignee: 'A. Rao', summary: 'Look-alike login page collecting corporate SSO credentials, linked from 14 inbound emails.' },
  { id: 'INC-2026-00420', title: 'Synthetic Identity Media', category: 'DEEPFAKE', source: 'Media Scanner', risk: 'HIGH', status: 'OPEN', detectedAt: minutesAgo(11), assignee: 'Unassigned', summary: 'Video submitted for KYC shows face-swap artifacts and mismatched audio cadence.' },
  { id: 'INC-2026-00419', title: 'Port Scan Detected', category: 'NETWORK ATTACK', source: 'Perimeter IDS', risk: 'MEDIUM', status: 'CONTAINED', detectedAt: minutesAgo(23), assignee: 'S. Mishra', summary: 'Sequential SYN scan across 1,024 ports from one external IP; source blocked at the edge.' },
  { id: 'INC-2026-00418', title: 'Suspicious API Burst', category: 'API ABUSE', source: 'API Gateway', risk: 'CRITICAL', status: 'INVESTIGATING', detectedAt: minutesAgo(31), assignee: 'P. Das', summary: '4,800 requests in 60 seconds against /v1/accounts using rotating tokens.' },
  { id: 'INC-2026-00417', title: 'Impossible Travel Login', category: 'ACCOUNT TAKEOVER', source: 'Identity Provider', risk: 'HIGH', status: 'OPEN', detectedAt: minutesAgo(47), assignee: 'Unassigned', summary: 'Same account signed in from two countries within 9 minutes.' },
  { id: 'INC-2026-00416', title: 'Malicious Link Blocked', category: 'MALICIOUS URL', source: 'Web Proxy', risk: 'MEDIUM', status: 'CONTAINED', detectedAt: minutesAgo(62), assignee: 'A. Rao', summary: 'Newly registered domain serving a drive-by download; 6 clients redirected to a block page.' },
  { id: 'INC-2026-00415', title: 'Large Outbound Transfer', category: 'DATA EXFILTRATION', source: 'Endpoint Agent', risk: 'CRITICAL', status: 'OPEN', detectedAt: minutesAgo(78), assignee: 'Unassigned', summary: '2.3 GB uploaded to an unsanctioned file host from a finance workstation.' },
  { id: 'INC-2026-00414', title: 'Voice Clone Call Attempt', category: 'DEEPFAKE', source: 'Media Scanner', risk: 'MEDIUM', status: 'RESOLVED', detectedAt: minutesAgo(115), assignee: 'S. Mishra', summary: 'Cloned executive voice requested an urgent payment; call verified as synthetic.' },
]
