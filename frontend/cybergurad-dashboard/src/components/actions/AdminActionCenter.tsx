import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Lock, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { executeAdminAction, getAdminActions, type ActionExecution, type AdminAction } from '@/api/actions'
import './admin-action-center.css'

function tone(action: AdminAction) {
  if (action.category === 'CONTAINMENT') return 'action-card action-card--danger'
  if (action.category === 'DISPOSITION') return 'action-card action-card--warning'
  return 'action-card'
}

export default function AdminActionCenter({ requestId }: { requestId?: string }) {
  const [actions, setActions] = useState<AdminAction[]>([])
  const [executions, setExecutions] = useState<ActionExecution[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    if (!requestId) return
    setLoading(true); setError(null)
    try {
      const result = await getAdminActions(requestId)
      setActions(result.actions ?? [])
      setExecutions(result.executions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load admin actions.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [requestId])

  const executed = useMemo(() => new Set(executions.filter(x => x.status === 'EXECUTED').map(x => x.action_id)), [executions])

  const run = async (action: AdminAction) => {
    if (!requestId || running) return
    if (action.requires_approval) {
      const ok = window.confirm(`ADMIN APPROVAL REQUIRED\n\n${action.name}\n\n${action.description}\n\nThis prototype records the action; it does not change external infrastructure.\n\nProceed?`)
      if (!ok) return
    }
    setRunning(action.action_id); setError(null); setMessage(null)
    try {
      const result = await executeAdminAction({
        request_id: requestId,
        action_id: action.action_id,
        approved: action.requires_approval,
        actor: 'SOC Analyst',
      })
      if (result.status === 'APPROVAL_REQUIRED') {
        setMessage('Approval required. No action was executed.')
      } else {
        setMessage(result.message)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action execution failed.')
    } finally { setRunning(null) }
  }

  if (!requestId) return null

  return <section className="admin-action-center">
    <div className="admin-action-center__head">
      <div>
        <span className="admin-action-center__eyebrow">ADMIN ACTION CENTER</span>
        <h3>Response &amp; Containment</h3>
        <p>Actions are generated from the current prediction and risk level. Containment actions require analyst approval.</p>
      </div>
      <button className="action-refresh" onClick={() => void load()} disabled={loading || !!running} title="Refresh actions">
        {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
      </button>
    </div>

    {error && <div className="action-message action-message--error"><AlertTriangle size={15} />{error}</div>}
    {message && <div className="action-message action-message--success"><CheckCircle2 size={15} />{message}</div>}

    <div className="action-grid">
      {actions.map(action => {
        const done = executed.has(action.action_id)
        const busy = running === action.action_id
        return <div className={tone(action)} key={action.action_id}>
          <div className="action-card__top">
            <span className="action-card__category">{action.category}</span>
            <span className={`action-card__priority action-card__priority--${action.priority.toLowerCase()}`}>{action.priority}</span>
          </div>
          <div className="action-card__title">
            {action.requires_approval ? <Lock size={15} /> : <ShieldAlert size={15} />}
            <b>{action.name}</b>
          </div>
          <p>{action.description}</p>
          <small>{action.reason}</small>
          <button className="action-execute" onClick={() => void run(action)} disabled={busy || done || !action.available}>
            {busy ? <><Loader2 size={14} className="spin" /> EXECUTING…</> : done ? <><CheckCircle2 size={14} /> EXECUTED</> : <><Play size={14} /> {action.requires_approval ? 'APPROVE & EXECUTE' : 'EXECUTE ACTION'}</>}
          </button>
        </div>
      })}
    </div>

    {executions.length > 0 && <div className="action-history">
      <div className="action-history__head"><span>ACTION AUDIT TRAIL</span><span>{executions.length} EVENT{executions.length > 1 ? 'S' : ''}</span></div>
      {executions.slice().reverse().map((item, index) => <div className="action-history__row" key={`${item.action_id}-${item.timestamp}-${index}`}>
        <span className={`action-history__status action-history__status--${item.status.toLowerCase()}`}>{item.status}</span>
        <b>{item.name}</b>
        <span>{item.actor}</span>
        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
      </div>)}
    </div>}
  </section>
}
