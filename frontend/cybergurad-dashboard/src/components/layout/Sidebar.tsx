import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import BrandMark from '@/components/common/BrandMark'
import type { BackendHealth } from '@/hooks/useBackendHealth'
import { NAV_GROUPS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  open: boolean
  collapsed: boolean
  health: BackendHealth
  onToggleCollapse: () => void
  onNavigate: () => void
}

const HEALTH_LABEL = { online: 'Backend online', offline: 'Backend offline', checking: 'Checking backend' } as const

export default function Sidebar({ open, collapsed, health, onToggleCollapse, onNavigate }: SidebarProps) {
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <aside className={cn('shell__sidebar sidebar', open && 'is-open', collapsed && 'is-collapsed')} aria-label="Primary">
      <div className="sidebar__brand">
        <BrandMark />
        <span className="brand-word">CYBERGUARD</span>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.heading}>
            <div className="nav-heading">{group.heading}</div>
            {group.items.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) => cn('nav-item', isActive && 'is-active')}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className={cn('sidebar__status', `sidebar__status--${health.state}`)} role="status" title={collapsed ? HEALTH_LABEL[health.state] : undefined}>
          <span className="led" aria-hidden="true" />
          <span className="sidebar__status-text">
            <b>{HEALTH_LABEL[health.state]}</b>
            <small>{health.version ? `API v${health.version}` : health.state === 'offline' ? 'Retrying every 15s' : 'Waiting for response'}</small>
          </span>
        </div>
        <button
          type="button"
          className="nav-item sidebar__collapse"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          <CollapseIcon aria-hidden="true" />
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  )
}
