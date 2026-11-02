import { useEffect, useMemo, useState } from 'react'
import {
  Activity, Ban, CheckCircle2, ChevronDown, ChevronUp,
  CircleHelp, Info, Loader2, LockKeyhole, Network, Play, RefreshCw,
  Server, ShieldAlert, ShieldCheck, SlidersHorizontal, Unlock,
} from 'lucide-react'
import { analyzeNetwork } from '@/api/analysis'
import { executeAdminAction, getAdminActions, type ActionExecution, type AdminAction } from '@/api/actions'
import { blockIP, getBlockedIPs, getNetworkPreset, getSockets, setLockdown, unblockIP } from '@/api/networkOperations'
import './network-operations.css'

type AnyResult = any

type Context = {
  source_ip: string
  destination_ip: string
  source_port: string
  destination_port: string
}

const presets = [
  { id: 'normal', label: 'NORMAL TRAFFIC BASELINE' },
  { id: 'syn_flood', label: 'DOS / DDOS VECTOR' },
  { id: 'port_scan', label: 'PORT SCAN VECTOR' },
  { id: 'brute_force', label: 'BRUTE FORCE VECTOR' },
]

const emptyContext: Context = {
  source_ip: '',
  destination_ip: '',
  source_port: '',
  destination_port: '',
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function riskTone(level: string) {
  switch (level) {
    case 'CRITICAL': return 'critical'
    case 'HIGH': return 'high'
    case 'MEDIUM': return 'medium'
    case 'LOW': return 'low'
    default: return 'safe'
  }
}

export default function NetworkOperationsPanel() {
  const [selected, setSelected] = useState('normal')
  const [flow, setFlow] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<AnyResult>(null)
  const [context, setContext] = useState<Context>(emptyContext)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<any[]>([])
  const [ip, setIp] = useState('')
  const [sourceIp, setSourceIp] = useState('')
  const [severity, setSeverity] = useState('HIGH')
  const [reason, setReason] = useState('Manual administrator security block')
  const [lockdown, setLockdownState] = useState(false)
  const [sockets, setSockets] = useState<any[]>([])
  const [showSockets, setShowSockets] = useState(false)
  const [actions, setActions] = useState<AdminAction[]>([])
  const [executions, setExecutions] = useState<ActionExecution[]>([])
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadBlocked = async () => {
    const response = await getBlockedIPs()
    setBlocked(response.items ?? [])
  }

  useEffect(() => {
    void loadBlocked().catch(e => setError(e instanceof Error ? e.message : 'Unable to load blocked IPs.'))
    void getNetworkLockdown()
    void loadPreset('normal')
  }, [])

  const getNetworkLockdown = async () => {
    try {
      const response = await (await import('@/api/networkOperations')).getLockdown()
      setLockdownState(Boolean(response.enabled))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load lockdown state.')
    }
  }

  const loadPreset = async (id: string) => {
    setSelected(id)
    setError(null)
    setResult(null)
    setActions([])
    setExecutions([])
    try {
      const data = await getNetworkPreset(id)
      setFlow(data.flow ?? {})
      setContext({
        source_ip: data.source_ip ?? '',
        destination_ip: data.destination_ip ?? '',
        source_port: '',
        destination_port: data.flow?.['Destination Port'] != null ? String(data.flow['Destination Port']) : '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load test vector.')
    }
  }

  const analyze = async () => {
    if (!Object.keys(flow).length) return
    setLoading(true)
    setError(null)
    setActionMessage(null)
    try {
      const data = await analyzeNetwork(flow, {
        source_ip: context.source_ip || null,
        destination_ip: context.destination_ip || null,
        source_port: numberOrNull(context.source_port),
        destination_port: numberOrNull(context.destination_port),
      })
      setResult(data)
      if (data.context) {
        setContext(c => ({
          ...c,
          source_ip: data.context.source_ip ?? c.source_ip,
          destination_ip: data.context.destination_ip ?? c.destination_ip,
        }))
      }
      if (data.request_id) {
        const available = await getAdminActions(data.request_id)
        setActions(available.actions ?? [])
        setExecutions(available.executions ?? [])
      }
      await loadBlocked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const model = result?.model
  const risk = result?.risk?.risk_level ?? model?.risk_level ?? 'UNKNOWN'
  const score = Number(result?.risk?.risk_score ?? model?.risk_score ?? 0)
  const family = result?.model?.attack_family ?? result?.threat_type ?? 'BENIGN'
  const prediction = result?.model?.prediction ?? 'UNKNOWN'
  const probability = Number(result?.model?.attack_probability ?? 0)
  const indicators = result?.risk?.indicators ?? []
  const recommended = useMemo(() => actions.filter(a => a.recommended && a.available), [actions])
  const executed = useMemo(() => new Set(executions.filter(x => x.status === 'EXECUTED').map(x => x.action_id)), [executions])

  const updateContext = (key: keyof Context, value: string) => {
    setContext(current => ({ ...current, [key]: value }))
    if (key === 'source_ip') setSourceIp(value)
  }

  const prepareBlock = () => {
    const target = context.source_ip || sourceIp
    if (target) setIp(target)
    setSeverity(risk === 'CRITICAL' ? 'CRITICAL' : risk === 'HIGH' ? 'HIGH' : 'MEDIUM')
    setReason(`Model 3: ${String(family).replace(/_/g, ' ')} detected (${score.toFixed(2)}/100)`)
    document.getElementById('network-firewall-controls')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const executeAction = async (action: AdminAction) => {
    if (!result?.request_id || actionBusy || !action.available || executed.has(action.action_id)) return
    if (action.requires_approval) {
      const approved = window.confirm(
        `ADMIN APPROVAL REQUIRED\n\n${action.name}\n\n${action.description}\n\nThis prototype updates the CyberGuard application control plane; it does not modify the host OS firewall.\n\nProceed?`,
      )
      if (!approved) return
    }

    setActionBusy(action.action_id)
    setError(null)
    setActionMessage(null)
    try {
      const execution = await executeAdminAction({
        request_id: result.request_id,
        action_id: action.action_id,
        approved: action.requires_approval,
        actor: 'SOC Analyst',
      })
      setActionMessage(execution.message)
      const refreshed = await getAdminActions(result.request_id)
      setActions(refreshed.actions ?? [])
      setExecutions(refreshed.executions ?? [])
      await loadBlocked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network action failed.')
    } finally {
      setActionBusy(null)
    }
  }

  const applyBlock = async () => {
    if (!ip.trim()) {
      setError('Enter a valid source IP before applying a block rule.')
      return
    }
    try {
      await blockIP({ ip_address: ip.trim(), severity, reason })
      setActionMessage(`${ip.trim()} is now blocked in the CyberGuard application control plane.`)
      setIp('')
      await loadBlocked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Block rule failed.')
    }
  }

  const handleUnblock = async (address: string) => {
    try {
      await unblockIP(address)
      setActionMessage(`${address} has been unblocked.`)
      await loadBlocked()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to unblock IP.')
    }
  }

  const toggleLockdown = async () => {
    try {
      const response = await setLockdown(!lockdown)
      setLockdownState(Boolean(response.enabled))
      setActionMessage(Boolean(response.enabled) ? 'Universal lockdown enabled.' : 'Universal lockdown disabled.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lockdown operation failed.')
    }
  }

  const toggleSockets = async () => {
    if (!showSockets) {
      try {
        setSockets((await getSockets()).items)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to enumerate sockets.')
      }
    }
    setShowSockets(v => !v)
  }

  const flowFeatureCount = Object.keys(flow).length

  return (
    <section className="network-ops">
      <div className="network-ops__header">
        <div>
          <div className="network-ops__title"><Network size={18} /> LIVE TRAFFIC SIMULATION &amp; PIPELINE TESTER</div>
          <div className="network-ops__sub">MODEL 3 / CONTROLLED BENCHMARKS / NO EXTERNAL TRAFFIC GENERATION</div>
        </div>
        <button className={`network-ops__lockdown ${lockdown ? 'active' : ''}`} onClick={() => void toggleLockdown()}>
          <LockKeyhole size={15} /> {lockdown ? 'DISABLE LOCKDOWN' : 'UNIVERSAL LOCKDOWN'}
        </button>
      </div>

      <div className="network-ops__vectors">
        {presets.map(p => (
          <button key={p.id} className={selected === p.id ? 'selected' : ''} onClick={() => void loadPreset(p.id)} disabled={loading}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="network-ops__tester">
        <div className="network-ops__tester-head">
          <span><SlidersHorizontal size={12} /> ANALYST FLOW CONTEXT</span>
          <span>MODEL USES 67 TRAINED FEATURES</span>
        </div>
        <div className="network-ops__context-grid">
          <label>Source IP<input value={context.source_ip} onChange={e => updateContext('source_ip', e.target.value)} placeholder="e.g. 192.0.2.45" /></label>
          <label>Destination IP<input value={context.destination_ip} onChange={e => updateContext('destination_ip', e.target.value)} placeholder="e.g. 192.0.2.50" /></label>
          <label>Source Port<input value={context.source_port} onChange={e => updateContext('source_port', e.target.value)} inputMode="numeric" placeholder="optional" /></label>
          <label>Destination Port<input value={context.destination_port} onChange={e => updateContext('destination_port', e.target.value)} inputMode="numeric" placeholder="22 / 80 / 443" /></label>
        </div>
        <div className="network-ops__input-note">
          <Info size={13} /> Endpoint IPs/ports are control-plane context. They are not silently inserted into the trained 67-feature vector because the production model explicitly drops identifier columns.
        </div>

        <button className="network-ops__advanced-toggle" onClick={() => setAdvancedOpen(v => !v)}>
          {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {advancedOpen ? 'HIDE' : 'EDIT'} ADVANCED 67-FEATURE VECTOR
          <span>{flowFeatureCount} FEATURES LOADED</span>
        </button>

        {advancedOpen && (
          <textarea
            value={JSON.stringify(flow, null, 2)}
            onChange={e => {
              try {
                const parsed = JSON.parse(e.target.value)
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
                setFlow(parsed)
                setError(null)
              } catch {
                setError('Advanced flow input must be a valid JSON object.')
              }
            }}
            spellCheck={false}
            aria-label="Model 3 network flow features"
          />
        )}

        <button className="network-ops__analyze" disabled={loading || !flowFeatureCount} onClick={() => void analyze()}>
          {loading ? <Loader2 size={15} className="spin" /> : <Activity size={15} />}
          {loading ? 'RUNNING MODEL 3…' : 'RUN NETWORK THREAT PREDICTION'}
        </button>
      </div>

      {error && <div className="network-ops__error"><ShieldAlert size={15} /><span>{error}</span></div>}
      {actionMessage && <div className="network-ops__success"><CheckCircle2 size={15} /><span>{actionMessage}</span></div>}

      {result && (
        <>
          <div className={`network-ops__result network-ops__result--${riskTone(risk)}`}>
            <div className="network-ops__result-main">
              <span>MODEL 3 PREDICTION</span>
              <h3>{prediction} · {family}</h3>
              <p>{result.explanation || result.risk?.severity_description}</p>
              <div className="network-ops__context-summary">
                <span><Server size={12} /> {context.source_ip || 'Source IP not supplied'}</span>
                <span>→ {context.destination_ip || 'Destination IP not supplied'}</span>
              </div>
            </div>
            <div className="network-ops__score"><span>RISK SCORE</span><strong>{score.toFixed(2)}</strong><small>/100 · {risk}</small></div>
            <div className="network-ops__metric"><span>ATTACK PROBABILITY</span><b>{(probability * 100).toFixed(2)}%</b></div>
          </div>

          <div className="network-ops__evidence">
            <div className="network-ops__panel-title">DECISION EVIDENCE <span>{indicators.length} INDICATORS</span></div>
            {indicators.length === 0 ? (
              <div className="network-ops__empty"><CircleHelp size={14} /> Model 3 returned no additional evidence indicators for this flow.</div>
            ) : indicators.map((indicator: any, index: number) => (
              <div className="network-ops__evidence-row" key={`${indicator.name}-${index}`}>
                <ShieldAlert size={14} />
                <div><b>{indicator.name}</b><span>{indicator.reason}</span></div>
                <em>{indicator.impact ?? 'SUPPORTING'}</em>
              </div>
            ))}
          </div>

          <div className="network-ops__response">
            <div className="network-ops__panel-title">
              RECOMMENDED SECURITY RESPONSE <span>{recommended.length} RECOMMENDED / {actions.length} AVAILABLE</span>
            </div>
            {(result.response?.recommendations ?? []).map((x: string, i: number) => (
              <div className="network-ops__recommendation" key={i}>
                <ShieldCheck size={14} />
                <div><b>{x}</b><span>Use the action controls below when containment or escalation is appropriate.</span></div>
              </div>
            ))}

            <div className="network-ops__action-grid">
              {actions.map(action => {
                const done = executed.has(action.action_id)
                const busy = actionBusy === action.action_id
                return (
                  <div className={`network-ops__action-card ${action.recommended ? 'recommended' : ''}`} key={action.action_id}>
                    <div className="network-ops__action-meta">
                      <span>{action.category}</span>
                      <b>{action.priority}</b>
                    </div>
                    <strong>{action.name}</strong>
                    <p>{action.description}</p>
                    <small>{action.requires_approval ? 'ADMIN APPROVAL REQUIRED' : 'NO CONTAINMENT APPROVAL REQUIRED'}</small>
                    <button disabled={busy || done || !action.available} onClick={() => void executeAction(action)}>
                      {busy ? <><Loader2 size={13} className="spin" /> EXECUTING…</> : done ? <><CheckCircle2 size={13} /> EXECUTED</> : <><Play size={13} /> {action.requires_approval ? 'APPROVE & EXECUTE' : 'EXECUTE ACTION'}</>}
                    </button>
                  </div>
                )
              })}
            </div>

            {recommended.length === 0 && risk !== 'SAFE' && (
              <div className="network-ops__action-row">
                <button onClick={prepareBlock}><Ban size={14} /> PREPARE SOURCE-IP BLOCK</button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="network-ops__grid">
        <div className="network-ops__panel" id="network-firewall-controls">
          <div className="network-ops__panel-title">NETWORK FIREWALL &amp; ACCESS CONTROL LISTS <span>APPLICATION CONTROL PLANE</span></div>
          <div className="network-ops__form-row">
            <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Target IPv4 / IPv6 address" />
            <select value={severity} onChange={e => setSeverity(e.target.value)}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Block reason" />
            <button className="danger" onClick={() => void applyBlock()}><Ban size={14} /> APPLY BLOCK RULE</button>
          </div>
          <div className="network-ops__panel-title inner">ACTIVE BLOCKED IPS <span>{blocked.length} ACTIVE RULE{blocked.length === 1 ? '' : 'S'}</span></div>
          <div className="network-ops__table-wrap">
            <table>
              <thead><tr><th>IP ADDRESS</th><th>SEVERITY</th><th>REASON</th><th>SOURCE</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>
                {blocked.length === 0 ? <tr><td colSpan={6}>No active blocked IPs.</td></tr> : blocked.map(x => (
                  <tr key={x.ip_address}>
                    <td>{x.ip_address}</td>
                    <td><span className={`sev sev-${String(x.severity).toLowerCase()}`}>{x.severity}</span></td>
                    <td>{x.reason}</td>
                    <td>{x.source}</td>
                    <td>{x.status ?? 'BLOCKED'}</td>
                    <td><button onClick={() => void handleUnblock(x.ip_address)}><Unlock size={13} /> UNBLOCK</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="network-ops__notice">Prototype enforcement ledger. The block/unblock state is real application state, but it does not alter the host OS firewall. Production enforcement should be connected to an approved firewall/EDR adapter.</small>
        </div>
      </div>

      <button className="network-ops__sockets-toggle" onClick={() => void toggleSockets()}>
        <Network size={15} /> {showSockets ? 'HIDE ACTIVE NETWORK SOCKETS' : 'SHOW ACTIVE NETWORK SOCKETS'} {showSockets ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {showSockets && (
        <div className="network-ops__panel">
          <div className="network-ops__panel-title">ACTIVE NETWORK SOCKETS <button onClick={() => void toggleSockets()}><RefreshCw size={12} /> REFRESH</button></div>
          <div className="network-ops__table-wrap">
            <table><thead><tr><th>PROTO</th><th>LOCAL ADDRESS</th><th>REMOTE ADDRESS</th><th>STATUS</th><th>PID</th><th>PROCESS</th></tr></thead>
              <tbody>{sockets.map((x, i) => <tr key={i}><td>{x.proto}</td><td>{x.local_address}</td><td>{x.remote_address}</td><td className="socket-status">{x.status}</td><td>{x.pid}</td><td>{x.process}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
