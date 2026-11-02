import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import AdminActionCenter from '@/components/actions/AdminActionCenter'
import {
  getAdminStatus,
  getHostTelemetry,
  getNetworkEvents,
  getNetworkHealth,
  getSysmonEvents,
  type AdminStatus,
  type BackendIncident,
  type HostTelemetry,
  type SysmonObservation,
} from '@/api/networkMonitoring'
import './live-network-monitor.css'

type Connection = 'loading' | 'connected' | 'offline' | 'partial'
type Risk = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'

function text(value: unknown, fallback = '—'): string {
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value)
}

function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function localTime(value?: string): string {
  if (!value) return 'Timestamp unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : `${date.toLocaleString()} (${date
        .toLocaleTimeString([], { timeZoneName: 'short' })
        .split(' ')
        .slice(-1)[0]})`
}

function eventId(e: BackendIncident): string {
  return String(e.request_id || e.event_id || '')
}

function metadata(e: BackendIncident): Record<string, unknown> {
  return e.metadata && typeof e.metadata === 'object' ? e.metadata : {}
}

function isNetworkEvent(e: BackendIncident): boolean {
  const source = String(e.source || '').toLowerCase()
  const type = String(e.threat_type || '').toUpperCase()
  const model = String(metadata(e).model || '').toLowerCase()
  return (
    source.includes('network') ||
    model.includes('network') ||
    ['PORT_SCAN', 'DOS_DDOS', 'BRUTE_FORCE', 'BOTNET', 'OTHER_ATTACK', 'NETWORK_ATTACK', 'BENIGN'].includes(type)
  )
}

function riskOf(e: BackendIncident): Risk {
  const level = String(e.risk_level || '').toUpperCase()
  return (['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(level)
    ? level
    : 'UNKNOWN') as Risk
}

function sourceIp(e: BackendIncident): string {
  const m = metadata(e)
  return text(m.source_ip ?? m.src_ip)
}

function destinationIp(e: BackendIncident): string {
  const m = metadata(e)
  return text(m.destination_ip ?? m.dst_ip)
}

function port(e: BackendIncident, key: string): string {
  return text(metadata(e)[key])
}

function protocol(e: BackendIncident): string {
  return text(metadata(e).protocol)
}

function domain(e: BackendIncident): string {
  const m = metadata(e)
  return text(m.domain ?? m.host)
}

function bytes(e: BackendIncident): string {
  const m = metadata(e)
  return text(m.bytes ?? m.flow_bytes)
}

function predictionOf(e: BackendIncident): string {
  return String(metadata(e).prediction ?? e.prediction ?? e.threat_type ?? '').toUpperCase()
}

function classificationOf(e: BackendIncident): string {
  const prediction = predictionOf(e)
  const risk = riskOf(e)
  if (risk === 'SAFE' && ['BENIGN', 'NORMAL', 'SAFE', 'LEGITIMATE'].some(x => prediction.includes(x))) {
    return 'RISK-FREE'
  }
  if (
    (risk !== 'UNKNOWN' && risk !== 'SAFE') ||
    prediction.includes('ATTACK') ||
    ['PORT_SCAN', 'DOS_DDOS', 'BRUTE_FORCE', 'PHISHING', 'BOTNET', 'OTHER_ATTACK'].some(x => prediction.includes(x))
  ) {
    return 'RISKY'
  }
  return 'UNCLASSIFIED'
}

function recommendationsOf(e: BackendIncident): string[] {
  const m = metadata(e) as Record<string, any>
  const raw = m.response?.recommendations ?? m.recommendations ?? e.recommendations ?? []
  return Array.isArray(raw)
    ? raw
        .map((item: any) => typeof item === 'string' ? item : String(item?.action ?? item?.name ?? ''))
        .filter(Boolean)
    : []
}

function primaryRecommendation(e: BackendIncident): string {
  return recommendationsOf(e)[0] ?? (
    riskOf(e) === 'SAFE'
      ? 'Continue monitoring; no elevated response recorded.'
      : 'No backend recommendation was recorded for this event.'
  )
}

function sysmonField(e: SysmonObservation, key: string): string {
  const metadata = e.metadata && typeof e.metadata === 'object' ? e.metadata : {}
  const eventData = e.event_data && typeof e.event_data === 'object' ? e.event_data : {}
  const value = e[key] ?? metadata[key] ?? eventData[key]
  return text(value)
}

export default function LiveNetworkMonitor() {
  const [events, setEvents] = useState<BackendIncident[]>([])
  const [telemetry, setTelemetry] = useState<HostTelemetry | null>(null)
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null)
  const [modelHealth, setModelHealth] = useState<Record<string, unknown> | null>(null)
  const [connection, setConnection] = useState<Connection>('loading')
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [predictionFilter, setPredictionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selected, setSelected] = useState<BackendIncident | null>(null)
  const [clearedBefore, setClearedBefore] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sysmonEvents, setSysmonEvents] = useState<SysmonObservation[]>([])
  const [sysmonError, setSysmonError] = useState('')

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const [eventResult, telemetryResult, statusResult, healthResult, sysmonResult] =
      await Promise.allSettled([
        getNetworkEvents(500),
        getHostTelemetry(),
        getAdminStatus(),
        getNetworkHealth(),
        getSysmonEvents(100),
      ])

    // Keep the existing connection indicator based on the original four APIs.
    const okCount = [eventResult, telemetryResult, statusResult, healthResult]
      .filter(result => result.status === 'fulfilled').length

    if (eventResult.status === 'fulfilled') {
      const sorted = [...eventResult.value].sort(
        (a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''),
      )
      setEvents(sorted.filter(isNetworkEvent).slice(0, 500))
    }
    if (telemetryResult.status === 'fulfilled') setTelemetry(telemetryResult.value)
    if (statusResult.status === 'fulfilled') setAdminStatus(statusResult.value)
    if (healthResult.status === 'fulfilled') setModelHealth(healthResult.value)

    if (sysmonResult.status === 'fulfilled') {
      setSysmonEvents(Array.isArray(sysmonResult.value.events) ? sysmonResult.value.events : [])
      setSysmonError('')
    } else {
      setSysmonError(String(sysmonResult.reason))
    }

    setConnection(okCount === 4 ? 'connected' : okCount > 0 ? 'partial' : 'offline')
    const failures = [
      eventResult.status === 'rejected' ? `Incident ledger: ${String(eventResult.reason)}` : '',
      telemetryResult.status === 'rejected' ? `Host telemetry: ${String(telemetryResult.reason)}` : '',
      statusResult.status === 'rejected' ? `SOC status: ${String(statusResult.reason)}` : '',
      healthResult.status === 'rejected' ? `Model 3 health: ${String(healthResult.reason)}` : '',
    ].filter(Boolean)
    setError(failures.join(' · '))
    setLastUpdated(new Date().toISOString())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  const visible = useMemo(() => events.filter(e => {
    const r = riskOf(e)
    const status = String(e.status || 'OPEN').toUpperCase()
    const haystack = [eventId(e), e.threat_type, sourceIp(e), destinationIp(e), domain(e), metadata(e).url]
      .map(x => String(x ?? ''))
      .join(' ')
      .toLowerCase()
    return (!clearedBefore || (e.timestamp || '') > clearedBefore)
      && (!query || haystack.includes(query.toLowerCase()))
      && (riskFilter === 'ALL' || r === riskFilter)
      && (predictionFilter === 'ALL' || (predictionFilter === 'ATTACK'
        ? classificationOf(e) === 'RISKY'
        : classificationOf(e) === 'RISK-FREE'))
      && (statusFilter === 'ALL' || status === statusFilter)
  }), [events, clearedBefore, query, riskFilter, predictionFilter, statusFilter])

  const stats = useMemo(() => ({
    events: events.length,
    threats: events.filter(e => ['MEDIUM', 'HIGH', 'CRITICAL'].includes(riskOf(e))).length,
    safe: events.filter(e => classificationOf(e) === 'RISK-FREE').length,
    critical: events.filter(e => riskOf(e) === 'CRITICAL').length,
    flows: num(telemetry?.flows_per_second ?? telemetry?.flows_sec),
    packets: num(telemetry?.packets_per_second ?? telemetry?.packets_sec),
  }), [events, telemetry])

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(visible, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cyberguard-network-events.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const captureUnavailable = 'Backend capability unavailable: this backend exposes host telemetry, Model 3 health, network sockets and analyzed incident events, but it does not expose packet-capture start/pause/stop or a live packet event stream.'

  return (
    <section className="live-net">
      <div className="live-net__head">
        <div>
          <div className="live-net__eyebrow">NETWORK OPERATIONS / SOC MONITOR</div>
          <h2><Activity size={20} /> Live Network Monitoring</h2>
          <p>Live view of backend telemetry and recorded analysis events. Raw packet capture is not exposed by the current backend.</p>
        </div>
        <div className={`live-net__connection live-net__connection--${connection}`}>
          {connection === 'connected' ? <Wifi size={15} /> : <WifiOff size={15} />}
          {connection === 'connected' ? 'BACKEND CONNECTED' : connection === 'partial' ? 'PARTIAL CONNECTION' : connection === 'loading' ? 'CONNECTING…' : 'BACKEND OFFLINE'}
        </div>
      </div>

      {error && (
        <div className="live-net__error">
          <AlertTriangle size={16} />
          <div><strong>Some monitoring sources are unavailable</strong><p>{error}</p></div>
          <button onClick={() => void refresh()}>RETRY</button>
        </div>
      )}

      <div className="live-net__metrics">
        <Metric label="RECORDED ANALYSIS EVENTS" value={stats.events} />
        <Metric label="RISKY EVENTS" value={stats.threats} danger={stats.threats > 0} />
        <Metric label="RISK-FREE EVENTS" value={stats.safe} />
        <Metric label="CRITICAL" value={stats.critical} danger={stats.critical > 0} />
        <Metric label="PACKETS / SEC" value={stats.packets === null ? 'DATA UNAVAILABLE' : stats.packets} />
        <Metric label="FLOWS / SEC" value={stats.flows === null ? 'DATA UNAVAILABLE' : stats.flows} />
      </div>

      <div className="live-net__status-grid">
        <Status label="NETWORK CAPTURE" state="BACKEND CAPABILITY UNAVAILABLE" detail="No packet-capture service or start/stop API is present in the supplied backend." warning />
        <Status label="MODEL 3 AI ANALYSIS" state={modelHealth?.status ? String(modelHealth.status).toUpperCase() : 'DATA UNAVAILABLE'} detail={text(modelHealth?.model, 'Model health endpoint did not return a model name.')} warning={modelHealth?.status !== 'ready'} />
        <Status label="SOC CONTROL PLANE" state={adminStatus ? 'AVAILABLE' : 'DATA UNAVAILABLE'} detail={adminStatus ? `Enforcement mode: ${text(adminStatus.enforcement_mode)} · Lockdown: ${adminStatus.lockdown ? 'ON' : 'OFF'}` : 'SOC status endpoint unavailable.'} warning={!adminStatus} />
        <Status label="HOST TELEMETRY" state={telemetry ? 'AVAILABLE' : 'DATA UNAVAILABLE'} detail={lastUpdated ? `Last poll: ${localTime(lastUpdated)}` : 'Waiting for backend telemetry.'} warning={!telemetry} />
      </div>

      <div className="live-net__pipeline">
        {['HOST TELEMETRY', 'RECORDED EVENT', 'MODEL 3 HEALTH', 'RISK / INCIDENT STORE', 'ADMIN ACTION API'].map((stage, i) => {
          const ready = Boolean(
            (i === 2 && modelHealth?.status === 'ready') ||
            (i === 0 && telemetry) ||
            (i === 1 && events.length) ||
            (i === 3 && connection !== 'offline') ||
            (i === 4 && adminStatus),
          )
          return (
            <div className="live-net__stage" key={stage}>
              <span className={ready ? 'is-ready' : 'is-waiting'}>
                {ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
              </span>
              <b>{stage}</b>
              {i < 4 && <i>→</i>}
            </div>
          )
        })}
      </div>

      <div className="live-net__controls">
        <div className="live-net__control-note"><AlertTriangle size={15} />{captureUnavailable}</div>
        <div className="live-net__control-buttons">
          <button disabled title={captureUnavailable}>START MONITORING</button>
          <button disabled title={captureUnavailable}>PAUSE</button>
          <button disabled title={captureUnavailable}>STOP</button>
          <button onClick={() => setClearedBefore(new Date().toISOString())}>CLEAR VIEW</button>
          <button onClick={() => void refresh()} disabled={refreshing}>{refreshing ? 'REFRESHING…' : <><RefreshCw size={14} /> REFRESH</>}</button>
          <button onClick={exportLog}><Download size={14} /> EXPORT LOG</button>
        </div>
      </div>

      <section className="live-net__ledger">
        <div className="live-net__ledger-head">
          <div><h3>NETWORK EVENT LEDGER</h3><p>Most recent events stored by the backend. This is not a packet-capture stream.</p></div>
          <span>{visible.length} EVENTS</span>
        </div>
        <div className="live-net__filters">
          <label className="live-net__search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search IP / domain / URL / event ID" /></label>
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} aria-label="Filter by risk">{['ALL', 'SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(x => <option key={x}>{x}</option>)}</select>
          <select value={predictionFilter} onChange={e => setPredictionFilter(e.target.value)} aria-label="Filter by prediction"><option>ALL</option><option>ATTACK</option><option>BENIGN</option></select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status">{['ALL', 'OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'].map(x => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="live-net__table-wrap">
          <table>
            <thead><tr><th>TIMESTAMP</th><th>EVENT ID</th><th>SOURCE IP</th><th>SOURCE PORT</th><th>DESTINATION IP</th><th>DEST PORT</th><th>PROTOCOL</th><th>HOST / DOMAIN</th><th>BYTES</th><th>PREDICTION</th><th>CLASSIFICATION</th><th>RISK</th><th>RECOMMENDED RESPONSE</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              {visible.map((e, i) => (
                <tr key={eventId(e) || `${e.timestamp}-${i}`}>
                  <td>{localTime(e.timestamp)}</td><td className="mono">{text(e.event_id || e.request_id)}</td><td>{sourceIp(e)}</td><td>{port(e, 'source_port')}</td><td>{destinationIp(e)}</td><td>{port(e, 'destination_port')}</td><td>{protocol(e)}</td><td>{domain(e)}</td><td>{bytes(e)}</td><td>{text(metadata(e).prediction ?? e.prediction ?? e.threat_type)}</td>
                  <td><span className={`live-net__classification live-net__classification--${classificationOf(e).toLowerCase().replace(/[^a-z]+/g, '-')}`}>{classificationOf(e)}</span></td>
                  <td><span className={`live-net__risk live-net__risk--${riskOf(e).toLowerCase()}`}>{riskOf(e)}</span></td><td className="live-net__recommendation-cell">{primaryRecommendation(e)}</td><td>{text(e.status, 'OPEN')}</td><td><button className="live-net__view" onClick={() => setSelected(e)}>VIEW</button></td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={15} className="live-net__empty">{connection === 'offline' ? 'DATA UNAVAILABLE — backend is offline.' : events.length === 0 ? 'No analyzed events have been recorded by the backend yet.' : 'No events match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="live-net__foot">Auto-refresh: 5 seconds · Last updated: {lastUpdated ? localTime(lastUpdated) : '—'} · Buffer limit: 500 events</div>
      </section>

      <section className="live-net__ledger">
        <div className="live-net__ledger-head">
          <div><h3>WINDOWS SYSMON OBSERVATIONS</h3><p>Persisted Windows network connection events. Observations are not confirmed threats and may not have been evaluated by Model 3.</p></div>
          <span>{sysmonEvents.length} OBSERVATIONS</span>
        </div>
        {sysmonError && (
          <div className="live-net__error"><AlertTriangle size={16} /><div><strong>Sysmon feed unavailable</strong><p>{sysmonError}</p></div><button onClick={() => void refresh()}>RETRY</button></div>
        )}
        <div className="live-net__table-wrap">
          <table>
            <thead><tr><th>TIMESTAMP</th><th>RECORD ID</th><th>PROCESS</th><th>SOURCE IP</th><th>SOURCE PORT</th><th>DESTINATION IP</th><th>DESTINATION PORT</th><th>PROTOCOL</th><th>EVALUATION</th></tr></thead>
            <tbody>
              {sysmonEvents.map((e, i) => (
                <tr key={`${e.record_id ?? e.event_id ?? 'sysmon'}-${i}`}>
                  <td>{localTime(e.timestamp)}</td>
                  <td className="mono">{text(e.record_id ?? e.event_id)}</td>
                  <td>{sysmonField(e, 'image')}</td>
                  <td>{sysmonField(e, 'source_ip')}</td>
                  <td>{sysmonField(e, 'source_port')}</td>
                  <td>{sysmonField(e, 'destination_ip')}</td>
                  <td>{sysmonField(e, 'destination_port')}</td>
                  <td>{sysmonField(e, 'protocol')}</td>
                  <td>{text(e.classification_status ?? e.prediction ?? e.status, 'NOT EVALUATED')}</td>
                </tr>
              ))}
              {sysmonEvents.length === 0 && !sysmonError && <tr><td colSpan={9} className="live-net__empty">No persisted Sysmon observations returned by the backend.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="live-net__foot">Auto-refresh: 5 seconds · Source: Windows Sysmon · Observations are not confirmed threats</div>
      </section>

      {selected && (
        <div className="live-net__overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <section className="live-net__drawer" role="dialog" aria-modal="true" aria-label="Network event details">
            <header><div><span>NETWORK EVENT DETAILS</span><h3>{text(selected.threat_type, 'Recorded event')}</h3></div><button aria-label="Close details" onClick={() => setSelected(null)}><X size={18} /></button></header>
            <dl>
              <dt>Event ID</dt><dd>{text(selected.event_id || selected.request_id)}</dd>
              <dt>Timestamp</dt><dd>{localTime(selected.timestamp)}</dd>
              <dt>Source IP / Port</dt><dd>{sourceIp(selected)} : {port(selected, 'source_port')}</dd>
              <dt>Destination IP / Port</dt><dd>{destinationIp(selected)} : {port(selected, 'destination_port')}</dd>
              <dt>Protocol</dt><dd>{protocol(selected)}</dd>
              <dt>Domain / URL</dt><dd>{text(metadata(selected).domain ?? metadata(selected).url)}</dd>
              <dt>Prediction</dt><dd>{text(metadata(selected).prediction ?? selected.threat_type)}</dd>
              <dt>Risk score</dt><dd>{selected.risk_score == null ? '—' : `${selected.risk_score}/100`}</dd>
              <dt>Classification</dt><dd><span className={`live-net__classification live-net__classification--${classificationOf(selected).toLowerCase().replace(/[^a-z]+/g, '-')}`}>{classificationOf(selected)}</span></dd>
              <dt>Risk level</dt><dd><span className={`live-net__risk live-net__risk--${riskOf(selected).toLowerCase()}`}>{riskOf(selected)}</span></dd>
              <dt>Recommended response</dt><dd>{recommendationsOf(selected).length ? <ul>{recommendationsOf(selected).map((item, i) => <li key={i}>{item}</li>)}</ul> : primaryRecommendation(selected)}</dd>
              <dt>Confidence</dt><dd>{num(selected.confidence) === null ? '—' : `${(Number(selected.confidence) * 100).toFixed(2)}%`}</dd>
              <dt>Explanation</dt><dd>{text(selected.explanation, 'No explanation was recorded for this event.')}</dd>
              <dt>Indicators</dt><dd>{Array.isArray(selected.indicators) && selected.indicators.length ? selected.indicators.map((x, i) => <div key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</div>) : 'No indicators recorded.'}</dd>
              <dt>Action history</dt><dd>{Array.isArray(selected.action_history) && selected.action_history.length ? selected.action_history.map((x, i) => <div key={i}>{JSON.stringify(x)}</div>) : 'No actions recorded.'}</dd>
            </dl>
            {selected.request_id && <AdminActionCenter requestId={selected.request_id} />}
          </section>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value, danger = false }: { label: string; value: unknown; danger?: boolean }) {
  return <div className={`live-net__metric ${danger ? 'live-net__metric--danger' : ''}`}><span>{label}</span><strong>{value === null ? 'DATA UNAVAILABLE' : String(value)}</strong></div>
}

function Status({ label, state, detail, warning = false }: { label: string; state: string; detail: string; warning?: boolean }) {
  return <div className="live-net__status"><span>{label}</span><strong className={warning ? 'is-warning' : 'is-ok'}>{state}</strong><p>{detail}</p></div>
}
