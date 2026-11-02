import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'cyberguard-theme'
const META_COLOR: Record<Theme, string> = { dark: '#03050a', light: '#eef2f7' }

interface ThemeContextValue { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage unavailable */ }
  return 'dark' // dark is the default console theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme])
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((v) => (v === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
