import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const COLLAPSE_KEY = 'cyberguard.sidebar.collapsed'

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true' } catch { return false }
  })
  const health = useBackendHealth()
  const { pathname } = useLocation()

  useEffect(() => setNavOpen(false), [pathname])
  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, String(collapsed)) } catch { /* ignore */ } }, [collapsed])
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`}>
      <Sidebar open={navOpen} collapsed={collapsed} health={health} onToggleCollapse={() => setCollapsed((v) => !v)} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="shell__scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <Topbar onMenu={() => setNavOpen(true)} health={health} />
      <main className="shell__main" id="main"><Outlet /></main>
    </div>
  )
}
