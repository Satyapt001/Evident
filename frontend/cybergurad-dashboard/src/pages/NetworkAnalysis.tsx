import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Info, Loader2, SlidersHorizontal } from 'lucide-react'
import AnalysisResult from '@/components/common/AnalysisResult'
import ErrorState from '@/components/common/ErrorState'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import { analyzeNetwork } from '@/api/analysis'
import { getNetworkPreset } from '@/api/networkOperations'
import NetworkOperationsPanel from '@/components/network/NetworkOperationsPanel'
import LiveNetworkMonitor from '@/components/network/LiveNetworkMonitor'
import './network-analysis.css'

const PRESETS = [
  { id: 'normal', label: 'NORMAL TRAFFIC BASELINE' },
  { id: 'port_scan', label: 'PORT SCAN VECTOR' },
  { id: 'syn_flood', label: 'DOS / DDOS VECTOR' },
  { id: 'brute_force', label: 'BRUTE FORCE VECTOR' },
] as const

type Context = {
  source_ip: string
  destination_ip: string
  source_port: string
  destination_port: string
}

const EMPTY_CONTEXT: Context = {
  source_ip: '',
  destination_ip: '',
  source_port: '',
  destination_port: '',
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function NetworkAnalysis() {
  const [mode, setMode] = useState<'manual' | 'live'>('manual')
  const [selected, setSelected] = useState('normal')
  const [flow, setFlow] = useState<Record<string, unknown>>({})
  const [context, setContext] = useState<Context>(EMPTY_CONTEXT)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadPreset = async (id: string) => {
    setSelected(id)
    setResult(null)
    setError(null)

    try {
      const data = await getNetworkPreset(id)
      setFlow(data.flow ?? {})
      setContext({
        source_ip: data.source_ip ?? '',
        destination_ip: data.destination_ip ?? '',
        source_port: data.source_port != null ? String(data.source_port) : '',
        destination_port:
          data.destination_port != null
            ? String(data.destination_port)
            : data.flow?.['Destination Port'] != null
              ? String(data.flow['Destination Port'])
              : '',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load network benchmark.')
    }
  }

  useEffect(() => {
    void loadPreset('normal')
  }, [])

  const updateContext = (key: keyof Context, value: string) => {
    setContext(current => ({ ...current, [key]: value }))
  }

  const submit = async () => {
    if (!Object.keys(flow).length) {
      setError('Load a network benchmark before running Model 3.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await analyzeNetwork(flow, {
        source_ip: context.source_ip || null,
        destination_ip: context.destination_ip || null,
        source_port: numberOrNull(context.source_port),
        destination_port: numberOrNull(context.destination_port),
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setFlow({})
    setContext(EMPTY_CONTEXT)
    setResult(null)
    setError(null)
    setSelected('')
  }

  return <>
    <PageHeader title="NETWORK / TECHNICAL" telemetry={['MODEL 3 / CIC-IDS2017', 'NETWORK-FLOW DETECTION']} />
    <div className="network-mode-switch" role="tablist" aria-label="Network analysis mode">
      <button type="button" role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'is-active' : ''} onClick={() => setMode('manual')}>MANUAL ANALYSIS</button>
      <button type="button" role="tab" aria-selected={mode === 'live'} className={mode === 'live' ? 'is-active' : ''} onClick={() => setMode('live')}>LIVE MONITORING</button>
    </div>
    {mode === 'live' ? <LiveNetworkMonitor /> : <>
    <Panel title="NETWORK FLOW ANALYSIS">
      <div className="network-ops network-flow-analysis">
        <div className="network-ops__tester">
          <div className="network-ops__tester-head">
            <span><SlidersHorizontal size={12} /> ANALYST FLOW CONTEXT</span>
            <span>MODEL USES 67 TRAINED FEATURES</span>
          </div>

          <div className="analysis-help">
            Test the production Network Threat Detector with a controlled CIC-IDS2017-style flow. Select a benchmark for quick analysis, or open the advanced editor only when you need to inspect individual model features.
          </div>

          <div className="network-ops__vectors network-flow-analysis__vectors">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                className={selected === preset.id ? 'selected' : ''}
                onClick={() => void loadPreset(preset.id)}
                disabled={loading}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="network-ops__context-grid">
            <label>
              Source IP
              <input
                value={context.source_ip}
                onChange={e => updateContext('source_ip', e.target.value)}
                placeholder="e.g. 192.0.2.45"
              />
            </label>
            <label>
              Destination IP
              <input
                value={context.destination_ip}
                onChange={e => updateContext('destination_ip', e.target.value)}
                placeholder="e.g. 192.0.2.50"
              />
            </label>
            <label>
              Source Port
              <input
                value={context.source_port}
                onChange={e => updateContext('source_port', e.target.value)}
                inputMode="numeric"
                placeholder="optional"
              />
            </label>
            <label>
              Destination Port
              <input
                value={context.destination_port}
                onChange={e => updateContext('destination_port', e.target.value)}
                inputMode="numeric"
                placeholder="22 / 80 / 443"
              />
            </label>
          </div>

          <div className="network-ops__input-note">
            <Info size={13} />
            <span>Endpoint IPs/ports are control-plane context. They are not silently inserted into the trained 67-feature vector because the production model explicitly drops identifier columns.</span>
          </div>

          <button
            type="button"
            className="network-ops__advanced-toggle"
            onClick={() => setAdvancedOpen(value => !value)}
          >
            {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {advancedOpen ? 'HIDE' : 'EDIT'} ADVANCED 67-FEATURE VECTOR
            <span>{Object.keys(flow).length} FEATURES LOADED</span>
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
              aria-label="Network flow model features"
            />
          )}

          <div className="network-flow-analysis__actions">
            <button
              type="button"
              className="network-ops__analyze"
              disabled={loading || !Object.keys(flow).length}
              onClick={() => void submit()}
            >
              {loading ? <Loader2 size={15} className="spin" /> : <Activity size={15} />}
              {loading ? 'RUNNING MODEL 3…' : 'RUN NETWORK THREAT PREDICTION'}
            </button>
            <button type="button" onClick={clear} disabled={loading}>CLEAR</button>
          </div>
        </div>

        {error && <ErrorState message={error} onRetry={submit} />}
      </div>
    </Panel>

    {result && <AnalysisResult result={result} />}

    {/* Existing Model 3 response/control workflow remains untouched below. */}
    <NetworkOperationsPanel />
    </>}
  </>
}
