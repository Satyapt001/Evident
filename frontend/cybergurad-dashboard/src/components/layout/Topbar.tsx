import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, LogOut, Menu, Moon, Settings, Sun } from 'lucide-react'
import { request } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import type { BackendHealth } from '@/hooks/useBackendHealth'
import { useClock } from '@/hooks/useClock'
import { useTheme } from '@/theme/ThemeProvider'
import SearchBox from './SearchBox'

const zulu = (d: Date) => `${d.toISOString().slice(11, 19)}Z`
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

/** Open incident count straight from the backend dashboard summary. */
function useOpenIncidents(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = () => request<{ active_incidents: number }>('/incidents/dashboard').then((d) => live && setCount(d.active_incidents)).catch(() => live && setCount(null))
    void load()
    const id = window.setInterval(load, 20000)
    return () => { live = false; window.clearInterval(id) }
  }, [enabled])
  return count
}

export default function Topbar({ onMenu, health }: { onMenu: () => void; health: BackendHealth }) {
  const now = useClock()
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const open = useOpenIncidents(health.state === 'online')

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [menu])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className="shell__topbar topbar">
      <button type="button" className="icon-btn topbar__menu" onClick={onMenu} aria-label="Open navigation"><Menu /></button>

      <div className="topbar__title">
        <strong>{user?.organization ?? 'CYBERGUARD'}</strong>
        <span>Security operations</span>
      </div>

      <SearchBox inputRef={searchRef} />

      <div className="topbar__right">
        <span className={`sys-status sys-status--${health.state}`} role="status">
          <span className="led" aria-hidden="true" />
          {health.state === 'online' ? 'Online' : health.state === 'offline' ? 'Offline' : 'Checking'}
        </span>
        <span className="clock" title="Coordinated Universal Time">{zulu(now)}</span>

        <Link to="/incidents" className="icon-btn" aria-label={open ? `${open} open incidents` : 'Incidents'} title={open ? `${open} open incidents` : 'Incidents'}>
          <Bell />
          {!!open && <span className="icon-btn__count">{open > 99 ? '99+' : open}</span>}
        </Link>

        <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>

        <div className="profile" ref={menuRef}>
          <button type="button" className="profile__btn" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu}>
            <span className="profile__avatar">{initials(user?.name ?? '')}</span>
            <span className="profile__meta"><strong>{user?.name ?? 'Signed in'}</strong><span>{user?.role === 'admin' ? 'Administrator' : 'Analyst'}</span></span>
          </button>
          {menu && (
            <div className="menu" role="menu">
              <div className="menu__who"><b>{user?.name}</b><span>{user?.email}</span><span>{user?.organization}</span></div>
              <Link role="menuitem" to="/settings" onClick={() => setMenu(false)}><Settings />Settings</Link>
              <button role="menuitem" type="button" onClick={() => { setMenu(false); toggleTheme() }}>{theme === 'dark' ? <Sun /> : <Moon />}{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
              <button role="menuitem" type="button" className="menu__danger" onClick={() => void signOut()}><LogOut />Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
