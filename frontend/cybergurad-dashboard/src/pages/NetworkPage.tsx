import { useEffect, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import { analyzeNetwork } from '@/api/analysis'
import { blockIp, getControlStatus, getFirewall, lockdown, simulateNetwork, unblockIp, unlock } from '@/api/operations'
import type { ControlStatus, FirewallRule, SimulationResult } from '@/types/operations'
import SeverityBadge from '@/components/common/SeverityBadge'

const vectors = [
  ['normal', 'NORMAL TRAFFIC BASELINE'],
  ['syn_flood', 'TCP SYN FLOOD VECTOR'],
  ['port_scan', 'PORT SCAN VECTOR'],
  ['brute_force', 'BRUTE FORCE VECTOR'],
] as const

const defaultFlow = {
  'Flow Duration': 1000,
  'Total Fwd Packets': 10,
  'Total Backward Packets': 8,
  'Total Length of Fwd Packets': 500,
  'Total Length of Bwd Packets': 400,
  'SYN Flag Count': 1,
  'ACK Flag Count': 8,
}

export default function NetworkPage() {
  const [status, setStatus] = useState<ControlStatus | null>(null)
  const [rules, setRules] = useState<FirewallRule[]>([])
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [customResult, setCustomResult] = useState<Record<string, unknown> | null>(null)
  const [flowText, setFlowText] = useState(JSON.stringify(defaultFlow, null, 2))
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('Manual administrator security block')
  const [severity, setSeverity] = useState('HIGH')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try {
      const [s, r] = await Promise.all([getControlStatus(), getFirewall()])
      setStatus(s)
      setRules(r)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network control API unavailable')
    }
  }

  useEffect(() => { void refresh() }, [])

  const run = async (vector: string) => {
    setBusy(true); setError(''); setCustomResult(null)
    try {
      const output = await simulateNetwork(vector)
      setResult(output)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Model 3 analysis failed')
    } finally { setBusy(false) }
  }

  const analyzeCustom = async () => {
    setBusy(true); setError('')
    try {
      const flow = JSON.parse(flowText)
      if (!flow || typeof flow !== 'object' || Array.isArray(flow)) throw new Error('Flow must be a JSON object.')
      setCustomResult(await analyzeNetwork(flow as Record<string, unknown>))
      setResult(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON or Model 3 analysis failed.')
    } finally { setBusy(false) }
  }

  const toggleLockdown = async () => {
    setBusy(true); setError('')
    try {
      setStatus(status?.lockdown ? await unlock() : await lockdown())
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lockdown action failed')
    } finally { setBusy(false) }
  }

  const addBlock = async (targetIp = ip, targetSeverity = severity, targetReason = reason) => {
    if (!targetIp.trim()) return
    setBusy(true); setError('')
    try {
      await blockIp(targetIp.trim(), targetSeverity, targetReason)
      setIp('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Block failed')
    } finally { setBusy(false) }
  }

  const blockDetectedSource = () => {
    if (!result?.source_ip) return
    void addBlock(result.source_ip, result.risk_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH', `Model 3 detected ${result.threat_type.replace(/_/g, ' ')}`)
  }

  const model = result?.model

  return <>
    <PageHeader
      title="NETWORK / TECHNICAL"
      telemetry={['MODEL 3 / CICIDS2017 NETWORK THREAT DETECTOR', 'ADMIN RESPONSE CONTROLS']}
      actions={
        <button className={`btn ${status?.lockdown ? 'btn--danger' : 'btn--primary'}`} disabled={busy} onClick={() => void toggleLockdown()}>
          {status?.lockdown ? 'DISABLE LOCKDOWN' : 'UNIVERSAL LOCKDOWN'}
        </button>
      }
    />

    <Panel title="LIVE TRAFFIC SIMULATION & MODEL TESTER" subtitle="CONTROLLED TEST VECTORS / EVERY VECTOR IS SENT THROUGH MODEL 3">
      <div className="vector-row">
        {vectors.map(([id, label]) => (
          <button key={id} className={`vector-btn ${id === 'syn_flood' ? 'vector-btn--danger' : ''}`} disabled={busy || status?.lockdown === true} onClick={() => void run(id)}>
            {label}
          </button>
        ))}
      </div>
      {status?.lockdown && <div className="lockdown-banner">UNIVERSAL LOCKDOWN ACTIVE — analysis test vectors and administrative network actions are gated.</div>}

      {result && (
        <div className="simulation-result">
          <div>
            <span>MODEL 3 ASSESSMENT</span>
            <b>{model?.attack_family ?? result.threat_type}</b>
          </div>
          <div>
            <span>ATTACK PROBABILITY</span>
            <strong>{((model?.attack_probability ?? result.confidence) * 100).toFixed(2)}%</strong>
          </div>
          <p>
            <b>Source IP:</b> {result.source_ip}<br />
            <b>Risk:</b> {result.risk_level} ({result.risk_score.toFixed(2)})<br />
            <b>Model prediction:</b> {model?.prediction ?? result.threat_type}<br />
            <b>Indicators:</b> {result.indicators.join(' · ')}
          </p>
          {result.risk_level !== 'SAFE' && (
            <button className="btn btn--danger" onClick={blockDetectedSource} disabled={busy}>
              BLOCK DETECTED SOURCE IP
            </button>
          )}
        </div>
      )}

      {customResult && <pre className="result-json">{JSON.stringify(customResult, null, 2)}</pre>}
    </Panel>

    <div className="network-grid">
      <Panel title="CUSTOM CICIDS FLOW → MODEL 3" subtitle="PARTIAL FLOW SUPPORTED / TRAINED MEDIAN IMPUTATION">
        <div className="analysis-form analysis-form--column">
          <textarea value={flowText} onChange={e => setFlowText(e.target.value)} spellCheck={false} aria-label="CICIDS network flow JSON" />
          <button className="btn btn--primary" disabled={busy || status?.lockdown === true} onClick={() => void analyzeCustom()}>
            ANALYZE WITH MODEL 3
          </button>
        </div>
      </Panel>

      <Panel title="NETWORK FIREWALL & ACCESS CONTROL LISTS" subtitle="APPLICATION-LEVEL BLOCK LEDGER">
        <div className="firewall-form">
          <input value={ip} onChange={e => setIp(e.target.value)} placeholder="Target IPv4 address" />
          <select value={severity} onChange={e => setSeverity(e.target.value)}>
            <option>HIGH</option><option>CRITICAL</option><option>MEDIUM</option><option>LOW</option>
          </select>
          <input value={reason} onChange={e => setReason(e.target.value)} />
          <button className="btn btn--danger" onClick={() => void addBlock()} disabled={!ip || busy || status?.lockdown === true}>APPLY BLOCK RULE</button>
        </div>
      </Panel>
    </div>

    <Panel title="ACTIVE BLOCKED IPS" subtitle={`${rules.length} APPLICATION FIREWALL RULES`} flush>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>IP ADDRESS</th><th>SEVERITY</th><th>REASON</th><th>SOURCE</th><th>PACKETS DROPPED</th><th>ACTION</th></tr></thead>
          <tbody>
            {rules.length === 0 ? <tr><td colSpan={6} className="cell-dim">No blocked IPs.</td></tr> : rules.map((r) => (
              <tr key={r.ip}>
                <td className="mono">{r.ip}</td>
                <td><SeverityBadge level={r.severity as 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} /></td>
                <td>{r.reason}</td>
                <td className="cell-dim">{r.source}</td>
                <td>{r.packets_dropped}</td>
                <td><button className="btn" disabled={busy || status?.lockdown === true} onClick={() => void unblockIp(r.ip).then(refresh)}>UNBLOCK</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>

    {error && <div className="action-error">{error}</div>}
  </>
}
