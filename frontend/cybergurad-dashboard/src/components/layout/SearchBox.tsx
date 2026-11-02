import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Ban, CornerDownLeft, FileText, Fingerprint, Loader2, Palette, Plug, Search, ShieldAlert, Siren, X,
  LogOut, ScanSearch, type LucideIcon,
} from 'lucide-react'
import { loadSearchIndex, type SearchIndex } from '@/api/search'
import { useAuth } from '@/auth/AuthProvider'
import { GROUP_LABEL, search, type Result, type ResultKind } from '@/lib/search'
import { useTheme } from '@/theme/ThemeProvider'

const ICONS: Record<ResultKind, LucideIcon> = {
  action: ScanSearch, page: FileText, incident: Siren, indicator: Fingerprint, blocked: Ban, socket: Plug,
}
const STALE_MS = 20_000

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const token = query.trim().split(/\s+/)[0]
  if (!token) return text
  const at = text.toLowerCase().indexOf(token.toLowerCase())
  if (at < 0) return text
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + token.length)}</mark>{text.slice(at + token.length)}</>
}

export default function SearchBox({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setIndex(await loadSearchIndex()) } finally { setLoading(false) }
  }, [])

  const openBox = () => {
    setOpen(true)
    if (!index || Date.now() - index.loadedAt > STALE_MS) void refresh()
  }

  const results = useMemo(() => search(query, index?.docs ?? [], theme), [query, index, theme])
  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // "/" or Ctrl/Cmd+K focuses the box from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inputRef])

  const choose = (r: Result | undefined) => {
    if (!r) return
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
    if (r.command === 'theme') toggleTheme()
    else if (r.command === 'signout') void signOut()
    else if (r.to) navigate(r.to)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { if (query) setQuery(''); else { setOpen(false); inputRef.current?.blur() } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
  }

  useEffect(() => { document.getElementById(`sr-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const s = index?.sources
  const sourceNote = !index ? '' : s && s.events === null && s.blocked === null && s.sockets === null
    ? 'Backend unreachable. Showing pages only.'
    : `Searched ${s?.events ?? 0} detections${s?.blocked != null ? `, ${s.blocked} blocked IPs` : ''}${s?.sockets != null ? `, ${s.sockets} connections` : ''}`

  let lastKind: ResultKind | null = null

  return (
    <div className="search" role="search" ref={rootRef}>
      <Search aria-hidden="true" className="search__icon" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        aria-activedescendant={open && results.length ? `sr-${active}` : undefined}
        aria-label="Search detections, IPs, domains, hashes and pages"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search detections, IPs, domains, hashes"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={openBox}
        onKeyDown={onKeyDown}
      />
      {query
        ? <button type="button" className="search__clear" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }}><X /></button>
        : <kbd>/</kbd>}

      {open && (
        <div className="search__panel" id="search-results" role="listbox">
          {results.length === 0 && (
            <div className="search__empty">
              {loading ? <><Loader2 className="spin" />Searching…</> : <>No match for “{query.trim()}”. Try an IP, a domain, a file hash, or a detection ID.</>}
            </div>
          )}
          <div className="search__list">
            {results.map((r, i) => {
              const Icon = r.command === 'theme' ? Palette : r.command === 'signout' ? LogOut : r.severity && r.kind !== 'page' && r.kind !== 'action' ? ShieldAlert : ICONS[r.kind]
              const heading = r.kind !== lastKind ? GROUP_LABEL[r.kind] : null
              lastKind = r.kind
              return (
                <div key={r.id}>
                  {heading && <div className="search__group">{heading}</div>}
                  <div
                    id={`sr-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`search__item${i === active ? ' is-active' : ''}`}
                    onMouseMove={() => setActive(i)}
                    onMouseDown={(e) => { e.preventDefault(); choose(r) }}
                  >
                    <Icon aria-hidden="true" className={r.severity ? `sev sev--${r.severity.toLowerCase()}` : undefined} />
                    <span className="search__text">
                      <b><Highlight text={r.title} query={query} /></b>
                      {r.subtitle && <small>{r.subtitle}</small>}
                    </span>
                    {r.severity && <span className={`search__sev sev--${r.severity.toLowerCase()}`}>{r.severity}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="search__foot">
            <span>{loading ? 'Refreshing…' : sourceNote}</span>
            <span className="search__hints"><kbd>↑</kbd><kbd>↓</kbd> move <kbd><CornerDownLeft /></kbd> open <kbd>esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  )
}
