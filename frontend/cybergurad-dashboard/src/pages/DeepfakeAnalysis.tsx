import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { analyzeDeepfakeImage, executeDeepfakeAction, getDeepfakeActions } from '@/api/deepfake'
import '@/styles/deepguard-analysis.css'

type Action = {
  action_id: string
  name: string
  description: string
  category: string
  priority: string
  requires_approval: boolean
  available: boolean
  recommended: boolean
  reason: string
}

type Result = any

function pct(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—'
}

function verdictClass(label: string) {
  if (label === 'MANIPULATED') return 'deepguard__verdict-title--bad'
  if (label === 'AUTHENTIC') return 'deepguard__verdict-title--good'
  return 'deepguard__verdict-title--warn'
}

function riskClass(level: string) {
  return `deepguard__risk-level deepguard__risk-level--${String(level || 'SAFE').toLowerCase()}`
}

function actionButtonLabel(action: Action, running: boolean) {
  if (running) return 'EXECUTING…'
  if (!action.available) return 'UNAVAILABLE'
  if (action.action_id === 'CONFIRM_MANIPULATION') return 'CONFIRM MANIPULATION'
  if (action.action_id === 'MARK_FALSE_POSITIVE') return 'MARK FALSE POSITIVE'
  if (action.action_id === 'NEEDS_INVESTIGATION') return 'MARK FOR INVESTIGATION'
  return action.requires_approval ? 'APPROVE & EXECUTE' : 'EXECUTE ACTION'
}

export default function DeepfakeAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [caseData, setCaseData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [decision, setDecision] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const chooseFile = (next: File | null) => {
    setFile(next); setResult(null); setActions([]); setCaseData(null); setError(null); setMessage(null); setDecision('')
    if (preview) URL.revokeObjectURL(preview)
    setPreview(next ? URL.createObjectURL(next) : null)
  }

  const loadActions = async (requestId: string) => {
    const data = await getDeepfakeActions(requestId)
    setActions(data.actions ?? [])
    setCaseData(data.case ?? null)
  }

  const submit = async () => {
    if (!file) return
    setLoading(true); setError(null); setMessage(null); setResult(null); setActions([]); setCaseData(null)
    try {
      const data = await analyzeDeepfakeImage(file)
      setResult(data)
      await loadActions(data.request_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DeepGuard inference failed.')
    } finally { setLoading(false) }
  }

  const runAction = async (action: Action) => {
    if (!result?.request_id || running || !action.available) return
    if (action.requires_approval) {
      const ok = window.confirm(`ADMIN APPROVAL REQUIRED\n\n${action.name}\n\n${action.description}\n\nNo external infrastructure is changed by this prototype action. Proceed?`)
      if (!ok) return
    }
    setRunning(action.action_id); setError(null); setMessage(null)
    try {
      const response = await executeDeepfakeAction(result.request_id, action.action_id, action.requires_approval, '')
      if (response.status === 'APPROVAL_REQUIRED') setMessage('Approval is required. No action was executed.')
      else setMessage(`${action.name} executed successfully.`)
      await loadActions(result.request_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action execution failed.')
    } finally { setRunning(null) }
  }

  const applyDecision = async () => {
    if (!decision) return
    const actionId = decision === 'CONFIRMED_MANIPULATION' ? 'CONFIRM_MANIPULATION' : decision === 'FALSE_POSITIVE' ? 'MARK_FALSE_POSITIVE' : 'NEEDS_INVESTIGATION'
    const action = actions.find(item => item.action_id === actionId)
    if (action) await runAction(action)
  }

  const model = result?.model ?? {}
  const risk = result?.risk ?? {}
  const evidence = result?.analysis_evidence ?? []
  const recommendations = result?.response?.recommendations ?? []
  const verdict = String(model.predicted_label ?? '').toUpperCase()
  const executed = useMemo(() => new Set((caseData?.actions ?? []).filter((item: any) => item.status === 'EXECUTED').map((item: any) => item.action_id)), [caseData])

  return <>
    <PageHeader title="DEEPFAKE / IMPERSONATION" telemetry={['DEEPGUARD MEDIA AUTHENTICITY ENGINE', 'DF40 · CLIP ViT-B/16 · MEDIA FORENSICS']} />

    <Panel title="MEDIA ANALYSIS">
      <div className="deepguard__upload">
        <div className="deepguard__upload-row">
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.bmp" onChange={e => chooseFile(e.target.files?.[0] ?? null)} />
          <button className="deepguard__button" onClick={() => void submit()} disabled={!file || loading}>
            {loading ? <><Loader2 size={14} className="spin" /> ANALYZING MEDIA</> : 'ANALYZE MEDIA'}
          </button>
        </div>
        <p className="deepguard__hint">DF40 currently analyzes uploaded images/frames. No prediction is generated unless the configured trained checkpoint successfully runs inference.</p>
      </div>
    </Panel>

    {error && <section className="deepguard__error">
      <div className="deepguard__error-icon"><AlertTriangle size={30} /></div>
      <div className="deepguard__error-title">MODEL UNAVAILABLE / ANALYSIS FAILED</div>
      <p>{error}</p>
      <p>No authenticity prediction was generated.</p>
      <details className="deepguard__diagnostic"><summary>VIEW DIAGNOSTIC DETAILS</summary><pre>Runtime: DF40 · CLIP ViT-B/16{`\n`}Status: inference unavailable{`\n`}Selected file: {file?.name ?? 'none'}{`\n`}API response: {error}</pre></details>
      <button className="deepguard__button deepguard__button--secondary" onClick={() => void submit()} disabled={!file || loading} style={{marginTop:14}}>RETRY</button>
    </section>}

    {result && <div className="deepguard">
      <div className="deepguard__grid">
        <section className="deepguard__preview">
          {preview ? <img src={preview} alt="Analyzed media" /> : <div className="deepguard__preview-empty">MEDIA PREVIEW</div>}
        </section>
        <section className="deepguard__verdict">
          <span className="deepguard__eyebrow">VERDICT</span>
          <h2 className={`deepguard__verdict-title ${verdictClass(verdict)}`}>
            {verdict === 'MANIPULATED' ? <ShieldAlert size={23} /> : verdict === 'AUTHENTIC' ? <ShieldCheck size={23} /> : null}
            {verdict === 'MANIPULATED' ? 'LIKELY MANIPULATED' : verdict === 'AUTHENTIC' ? 'LIKELY AUTHENTIC' : verdict || 'INCONCLUSIVE'}
          </h2>
          <p className="deepguard__verdict-copy">{risk.severity_description}</p>
          <div className="deepguard__risk"><strong>{Number(risk.risk_score ?? 0).toFixed(2)}</strong><span>/100 risk</span></div>
          <span className={riskClass(risk.risk_level)}>{risk.risk_level ?? 'UNKNOWN'}</span>
        </section>
      </div>

      <div className="deepguard__kpis">
        <div className="deepguard__kpi"><span>MODEL CONFIDENCE</span><b>{pct(model.confidence)}</b></div>
        <div className="deepguard__kpi"><span>MANIPULATION PROBABILITY</span><b>{pct(model.class_1_probability)}</b></div>
        <div className="deepguard__kpi"><span>AUTHENTIC PROBABILITY</span><b>{pct(model.class_probabilities?.[0])}</b></div>
        <div className="deepguard__kpi"><span>ANALYSIS ID</span><b>{result.request_id}</b></div>
      </div>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>ANALYSIS SUMMARY</span><span>GENUINE MODEL OUTPUT</span></div>
        <div className="deepguard__section-body"><div className="deepguard__summary-grid">
          <div className="deepguard__field"><span>CLASSIFICATION</span><b>{model.predicted_label ?? '—'}</b></div>
          <div className="deepguard__field"><span>MEDIA TYPE</span><b>{result.media?.format ?? 'IMAGE'}</b></div>
          <div className="deepguard__field"><span>DIMENSIONS</span><b>{result.media?.width} × {result.media?.height}</b></div>
          <div className="deepguard__field"><span>MODEL</span><b>{model.name}</b></div>
          <div className="deepguard__field"><span>TECHNICAL MODEL</span><b>{model.technical_name}</b></div>
          <div className="deepguard__field"><span>DEVICE</span><b>{model.device}</b></div>
          <div className="deepguard__field"><span>PROBABILITY MARGIN</span><b>{pct(model.probability_margin)}</b></div>
          <div className="deepguard__field"><span>PREDICTION ENTROPY</span><b>{Number(model.prediction_entropy ?? 0).toFixed(4)}</b></div>
          <div className="deepguard__field"><span>SHA-256</span><b>{result.media?.sha256}</b></div>
        </div></div>
      </section>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>FORENSIC EVIDENCE</span><span>MODEL-DERIVED / COMPUTED ONLY</span></div>
        <div className="deepguard__section-body"><div className="deepguard__evidence">
          {evidence.map((item: any) => <div className="deepguard__evidence-card" key={item.name}><b>{item.name}</b><div className="deepguard__evidence-value">{item.value}{item.unit === '%' ? '%' : ''}</div><p>{item.interpretation}</p></div>)}
        </div></div>
      </section>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>SECURITY ASSESSMENT</span><span>{risk.risk_level ?? 'UNKNOWN'} PRIORITY</span></div>
        <div className="deepguard__section-body">
          <p className="deepguard__assessment">{risk.severity_description}</p>
          <div className="deepguard__recommendations"><b>RECOMMENDED RESPONSE</b><ul>{recommendations.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></div>
        </div>
      </section>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>RECOMMENDED ADMIN ACTIONS</span><span>ADMIN CONTROL REQUIRED</span></div>
        {message && <div className="deepguard__status"><CheckCircle2 size={14} style={{verticalAlign:'-2px', marginRight:6}} />{message}</div>}
        <div className="deepguard__actions">
          {actions.map(action => <article className={`deepguard__action ${action.recommended ? 'deepguard__action--recommended' : ''} ${action.category === 'CONTAINMENT' ? 'deepguard__action--danger' : ''}`} key={action.action_id}>
            <div className="deepguard__action-top"><span className="deepguard__tag">{action.category} · {action.priority}</span>{action.recommended && <span className="deepguard__recommended">RECOMMENDED</span>}</div>
            <h4>{action.name}</h4><p>{action.description}</p><small>{action.reason}</small>
            <button onClick={() => void runAction(action)} disabled={!!running || !action.available || executed.has(action.action_id)}>{executed.has(action.action_id) ? 'EXECUTED' : actionButtonLabel(action, running === action.action_id)}</button>
          </article>)}
        </div>
      </section>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>ANALYST DECISION</span><span>SEPARATE FROM MODEL PREDICTION</span></div>
        <div className="deepguard__section-body"><div className="deepguard__decision">
          <label><input type="radio" name="deepguard-decision" value="CONFIRMED_MANIPULATION" checked={decision === 'CONFIRMED_MANIPULATION'} onChange={e => setDecision(e.target.value)} />Confirm Manipulation</label>
          <label><input type="radio" name="deepguard-decision" value="FALSE_POSITIVE" checked={decision === 'FALSE_POSITIVE'} onChange={e => setDecision(e.target.value)} />Mark False Positive</label>
          <label><input type="radio" name="deepguard-decision" value="NEEDS_INVESTIGATION" checked={decision === 'NEEDS_INVESTIGATION'} onChange={e => setDecision(e.target.value)} />Needs Further Investigation</label>
          <button onClick={() => void applyDecision()} disabled={!decision || !!running}>APPLY DECISION</button>
        </div></div>
      </section>

      <section className="deepguard__section">
        <div className="deepguard__section-head"><span>ACTION / AUDIT HISTORY</span><button className="deepguard__button deepguard__button--secondary" style={{padding:'6px 9px'}} onClick={() => void loadActions(result.request_id)} disabled={!!running}><RefreshCw size={12} /> REFRESH</button></div>
        <div className="deepguard__section-body">
          {(caseData?.actions?.length ?? 0) === 0 ? <div className="deepguard__field"><b>No administrator actions have been executed.</b></div> : <table className="deepguard__history"><thead><tr><th>TIME</th><th>ACTION</th><th>ACTOR</th><th>STATUS</th></tr></thead><tbody>{caseData.actions.slice().reverse().map((item:any, index:number) => <tr key={`${item.action_id}-${item.timestamp}-${index}`}><td>{new Date(item.timestamp).toLocaleTimeString()}</td><td>{item.name}</td><td>{item.actor}</td><td>{item.status}</td></tr>)}</tbody></table>}
        </div>
      </section>
    </div>}
  </>
}
