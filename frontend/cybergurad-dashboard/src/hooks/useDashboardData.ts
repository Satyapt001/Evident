import { useCallback, useEffect, useState } from 'react'
import { getDashboardSnapshot, type DashboardSnapshot } from '@/api/dashboard'

export type DataStatus = 'ready' | 'loading' | 'error'

export interface DashboardState {
  status: DataStatus
  data: DashboardSnapshot | null
  error: string | null
  retry: () => void
}

const REFRESH_MS = 5000

export function useDashboardData(): DashboardState {
  const [status, setStatus] = useState<DataStatus>('loading')
  const [data, setData] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const snapshot = await getDashboardSnapshot()
      setData(snapshot)
      setError(null)
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [load])

  return {
    status,
    data,
    error,
    retry: () => {
      setStatus('loading')
      void load()
    },
  }
}
