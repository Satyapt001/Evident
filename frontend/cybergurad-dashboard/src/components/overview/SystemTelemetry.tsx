import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getTelemetryConnections, getTelemetryProcesses, getTelemetrySummary,
  type TelemetryConnection, type TelemetryProcess, type TelemetrySummary,
} from '@/api/telemetry'
import './SystemTelemetry.css'

import { ChevronDown, ChevronUp } from 'lucide-react'

type LoadState = 'loading' | 'live' | 'partial' | 'error'
const bytes = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; let n = value; let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`
}
const rate = (v: number | null | undefined) => v == null ? 'Warming up…' : `${bytes(v)}/s`
const pct = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(1)}%`
const stamp = (v?: string) => v && !Number.isNaN(new Date(v).getTime()) ? new Date(v).toLocaleString() : 'Not yet collected'
const message = (e: unknown) => e instanceof Error ? e.message : 'Unable to load host telemetry.'

export default function SystemTelemetry() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null)
  const [connections, setConnections] = useState<TelemetryConnection[]>([])
  const [processes, setProcesses] = useState<TelemetryProcess[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const refresh = useCallback(async (inventory = true) => {
    setBusy(true)
    try {
      const next = await getTelemetrySummary()
      setSummary(next); setError(null); setState('live')
    } catch (e) { setError(message(e)); setState(previous => previous === 'loading' ? 'error' : 'partial') }
    if (inventory) {
      try {
        const [c, p] = await Promise.all([getTelemetryConnections(), getTelemetryProcesses()])
        setConnections(c.connections ?? []); setProcesses(p.processes ?? []); setInventoryError(null)
      } catch (e) { setInventoryError(message(e)) }
    }
    setBusy(false)
  }, [])

  useEffect(() => {
    let active = true
    const run = (inventory: boolean) => { if (active) void refresh(inventory) }
    run(true)
    const metricsTimer = setInterval(() => run(false), 2000)
    const inventoryTimer = setInterval(() => run(true), 10000)
    return () => { active = false; clearInterval(metricsTimer); clearInterval(inventoryTimer) }
  }, [refresh])

  const listening = useMemo(() => connections.filter(c => c.is_listening), [connections])
  const metric = (title: string, value: string, detail: string, progress?: number) => (
    <article className="st-metric" key={title}>
      <div className="st-metric-title">{title}</div><div className="st-metric-value">{value}</div>
      <div className="st-metric-detail">{detail}</div>
      {progress !== undefined && <div className="st-progress"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
    </article>
  )

  return <section className="system-telemetry" aria-labelledby="st-title">
    <div className="st-header">
      <div>
        <div className="st-eyebrow">HOST OBSERVABILITY</div><h2 id="st-title">Real-Time System Telemetry</h2>
        <p>Live host resources, network connections, listening ports and process inventory.</p>
      </div>
      <div className="st-header-actions">
        <span className={`st-status st-status-${state}`}>
          <span className="st-status-dot" />
          {state === 'live' ? 'LIVE' : state === 'partial' ? 'PARTIAL' : state === 'error' ? 'UNAVAILABLE' : 'CONNECTING'}
        </span>

        <button
          type="button"
          className="st-button"
          disabled={busy}
          onClick={() => void refresh(true)}
        >
          {busy ? 'REFRESHING…' : 'REFRESH'}
        </button>

        <button
          type="button"
          className="st-button"
          onClick={() => setCollapsed(previous => !previous)}
          aria-expanded={!collapsed}
          aria-controls="system-telemetry-content"
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {collapsed ? 'EXPAND' : 'COLLAPSE'}
        </button>
      </div>
    </div>

    {!collapsed && (
      <div id="system-telemetry-content">
        {error && <div className="st-error" role="alert"><strong>Host metrics unavailable</strong><span>{error}</span></div>}
        {summary && <>
          <div className="st-hostline"><span>Host: <strong>{summary.host}</strong></span><span>{summary.platform}</span><span>Last sample: {stamp(summary.collected_at)}</span><span>Uptime: {Math.floor(summary.uptime_seconds / 86400)}d {Math.floor(summary.uptime_seconds % 86400 / 3600)}h</span></div>
          <div className="st-metrics-grid">
            {metric('CPU UTILIZATION', pct(summary.cpu.percent), `${summary.cpu.logical_cores} logical cores · ${summary.cpu.frequency_mhz == null ? 'Frequency unavailable' : `${summary.cpu.frequency_mhz} MHz`}`, summary.cpu.percent)}
            {metric('RAM USAGE', pct(summary.memory.percent), `${bytes(summary.memory.used_bytes)} / ${bytes(summary.memory.total_bytes)}`, summary.memory.percent)}
            {metric('ROOT DISK', pct(summary.disk.percent), `${bytes(summary.disk.used_bytes)} / ${bytes(summary.disk.total_bytes)} · ${bytes(summary.disk.free_bytes)} free`, summary.disk.percent)}
            {metric('NETWORK RECEIVE', rate(summary.network.receive_bytes_per_sec), `${bytes(summary.network.bytes_received_total)} received total`)}
            {metric('NETWORK SEND', rate(summary.network.send_bytes_per_sec), `${bytes(summary.network.bytes_sent_total)} sent total`)}
            {metric('SWAP USAGE', pct(summary.memory.swap_percent), `${bytes(summary.memory.swap_used_bytes)} / ${bytes(summary.memory.swap_total_bytes)}`, summary.memory.swap_percent)}
          </div>
          <div className="st-core-panel"><div className="st-section-title">CPU CORE UTILIZATION <span>{summary.cpu.per_core_percent.length} cores</span></div>
            <div className="st-core-grid">{summary.cpu.per_core_percent.map((v, i) => <div className="st-core" key={i}><span>CORE {i}</span><strong>{pct(v)}</strong><div className="st-progress"><span style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div></div>)}</div>
          </div>
        </>}

        {inventoryError && <div className="st-error"><strong>Inventory is partial</strong><span>{inventoryError}</span></div>}
        <div className="st-inventory-grid">
          <div className="st-panel"><div className="st-section-title">ACTIVE CONNECTIONS <span>{connections.length}</span></div>
            <div className="st-table-wrap"><table><thead><tr><th>LOCAL</th><th>REMOTE</th><th>STATE</th><th>PROCESS</th></tr></thead><tbody>
              {connections.slice(0, 30).map((c, i) => <tr key={`${c.pid}-${c.local_address}-${c.local_port}-${c.remote_address}-${i}`}>
                <td>{c.local_address ?? '—'}:{c.local_port ?? '—'}<small>{c.type}</small></td><td>{c.remote_address ? `${c.remote_address}:${c.remote_port ?? '—'}` : '—'}</td>
                <td><span className={c.is_listening ? 'st-pill st-pill-listen' : 'st-pill'}>{c.status}</span></td><td>{c.process ?? 'Unknown'}<small>{c.pid == null ? 'PID unavailable' : `PID ${c.pid}`}</small></td>
              </tr>)}
              {connections.length === 0 && <tr><td colSpan={4} className="st-empty">No connection rows returned yet.</td></tr>}
            </tbody></table></div>
          </div>
          <div className="st-panel"><div className="st-section-title">LISTENING PORTS <span>{listening.length}</span></div>
            <div className="st-table-wrap"><table><thead><tr><th>PORT</th><th>ADDRESS</th><th>PROCESS</th><th>PID</th></tr></thead><tbody>
              {listening.slice(0, 30).map((c, i) => <tr key={`${c.local_port}-${c.local_address}-${c.pid}-${i}`}><td><strong>{c.local_port ?? '—'}</strong><small>{c.type}</small></td><td>{c.local_address ?? '—'}</td><td>{c.process ?? 'Unknown'}</td><td>{c.pid ?? '—'}</td></tr>)}
              {listening.length === 0 && <tr><td colSpan={4} className="st-empty">No listening ports visible to the current process.</td></tr>}
            </tbody></table></div>
          </div>
        </div>
        <div className="st-panel st-process-panel"><div className="st-section-title">RUNNING PROCESSES <span>Top {Math.min(processes.length, 50)} by resident memory</span></div>
          <div className="st-table-wrap"><table><thead><tr><th>PROCESS</th><th>PID</th><th>USER</th><th>STATUS</th><th>MEMORY</th><th>CPU SAMPLE</th></tr></thead><tbody>
            {processes.slice(0, 25).map(p => <tr key={p.pid}><td>{p.name ?? 'Unknown'}</td><td>{p.pid}</td><td>{p.username ?? '—'}</td><td>{p.status ?? '—'}</td><td>{bytes(p.memory_rss_bytes)}</td><td>{p.cpu_percent == null ? 'Warming up…' : pct(p.cpu_percent)}</td></tr>)}
            {processes.length === 0 && <tr><td colSpan={6} className="st-empty">Process inventory not available yet.</td></tr>}
          </tbody></table></div><p className="st-footnote">Read-only inventory. Process command lines and environment variables are not collected.</p>
        </div>
      </div>
    )}
  </section>
}