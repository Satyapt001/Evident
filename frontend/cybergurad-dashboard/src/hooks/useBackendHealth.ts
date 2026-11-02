import { useCallback, useEffect, useState } from 'react'
import { getHealth } from '@/api/system'

export type BackendState = 'checking' | 'online' | 'offline'

export interface BackendHealth {
  state: BackendState
  version: string | null
  checkedAt: Date | null
  refresh: () => void
}

/** Polls GET /health so the console shows whether the backend is actually reachable. */
export function useBackendHealth(intervalMs = 15000): BackendHealth {
  const [state, setState] = useState<BackendState>('checking')
  const [version, setVersion] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const check = useCallback(async () => {
    try {
      const h = await getHealth()
      setState('online')
      setVersion(typeof h.version === 'string' ? h.version : null)
    } catch {
      setState('offline')
    }
    setCheckedAt(new Date())
  }, [])

  useEffect(() => {
    void check()
    const id = window.setInterval(() => void check(), intervalMs)
    return () => window.clearInterval(id)
  }, [check, intervalMs])

  return { state, version, checkedAt, refresh: () => void check() }
}
