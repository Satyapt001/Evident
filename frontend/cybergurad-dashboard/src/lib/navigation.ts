import {
  LayoutDashboard, Radar, Siren, Mail, ScanFace, Network, Bug, Telescope, FileSearch, Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
}

export interface NavGroup {
  heading: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Monitor',
    items: [
      { label: 'Overview', path: '/', icon: LayoutDashboard, end: true },
      { label: 'Live threats', path: '/live-threats', icon: Radar },
      { label: 'Incidents', path: '/incidents', icon: Siren },
    ],
  },
  {
    heading: 'Analyze',
    items: [
      { label: 'Phishing', path: '/analysis/phishing', icon: Mail },
      { label: 'Deepfake', path: '/analysis/deepfake', icon: ScanFace },
      { label: 'Network', path: '/analysis/network', icon: Network },
      { label: 'Malware triage', path: '/analysis/malware', icon: Bug },
    ],
  },
  {
    heading: 'Investigate',
    items: [
      { label: 'Threat intelligence', path: '/intelligence', icon: Telescope },
      { label: 'Evidence', path: '/evidence', icon: FileSearch },
    ],
  },
  {
    heading: 'Console',
    items: [{ label: 'Settings', path: '/settings', icon: Settings }],
  },
]
