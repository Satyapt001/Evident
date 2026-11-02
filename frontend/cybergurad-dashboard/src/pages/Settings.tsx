import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2, LogOut, Moon, ShieldAlert, ShieldCheck, Sun, UserPlus } from 'lucide-react'
import { createUser, getAuthStatus, listUsers, type AuthStatus, type Role, type User } from '@/api/auth'
import { API_ROOT } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { cn } from '@/lib/utils'
import { useTheme } from '@/theme/ThemeProvider'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'Never')

function TeamPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'analyst' as Role })

  const load = useCallback(() => { listUsers().then(setUsers).catch((e) => setError(e.message)) }, [])
  useEffect(load, [load])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null); setNotice(null)
    try {
      const made = await createUser(form)
      setNotice(`${made.name} can now sign in as ${made.role}.`)
      setForm({ name: '', email: '', password: '', role: 'analyst' })
      load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not add this person.') } finally { setBusy(false) }
  }

  return (
    <Panel title="Team" subtitle={`${users.length} ${users.length === 1 ? 'account' : 'accounts'}`} flush>
      <div className="table-wrap">
        <table className="tbl tbl--static">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {users.map((u) => <tr key={u.id}><td>{u.name}</td><td className="cell-dim">{u.email}</td><td><span className="badge" style={{ '--c': u.role === 'admin' ? 'var(--cyan)' : 'var(--text-dim)' } as React.CSSProperties}>{u.role}</span></td><td className="cell-time">{when(u.last_login)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <form className="team-form" onSubmit={submit}>
        <h3>Add a team member</h3>
        <div className="team-form__grid">
          <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></label>
          <label className="field"><span>Work email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="field"><span>Temporary password</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} autoComplete="new-password" /></label>
          <label className="field"><span>Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="analyst">Analyst</option><option value="admin">Administrator</option></select>
          </label>
        </div>
        {error && <div className="login__error" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" /> : <UserPlus />}Add member</button>
      </form>
    </Panel>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const health = useBackendHealth(30000)
  const [status, setStatus] = useState<AuthStatus | null>(null)

  useEffect(() => { if (health.state === 'online') getAuthStatus().then(setStatus).catch(() => setStatus(null)) }, [health.state])

  return (
    <>
      <PageHeader title="SETTINGS" telemetry={[user?.organization ?? '']} />
      <div className="settings">
        <Panel title="Appearance">
          <div className="seg" role="radiogroup" aria-label="Theme">
            {([['dark', 'Dark', Moon], ['light', 'Light', Sun]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} className={cn('seg__opt', theme === value && 'is-on')} onClick={() => setTheme(value)}><Icon />{label}</button>
            ))}
          </div>
          <p className="muted-note">Saved on this device. Dark is the default for operations rooms; light suits bright offices and printing.</p>
        </Panel>

        <Panel title="Your account">
          <dl className="kv kv--wide">
            <dt>Name</dt><dd>{user?.name}</dd>
            <dt>Email</dt><dd>{user?.email}</dd>
            <dt>Organization</dt><dd>{user?.organization}</dd>
            <dt>Role</dt><dd>{user?.role === 'admin' ? 'Administrator' : 'Analyst'}</dd>
            <dt>Last sign-in</dt><dd>{when(user?.last_login ?? null)}</dd>
          </dl>
          <button type="button" className="btn" onClick={() => void signOut()}><LogOut />Sign out</button>
        </Panel>

        <Panel title="Backend connection">
          <dl className="kv kv--wide">
            <dt>API</dt><dd className="mono">{API_ROOT}</dd>
            <dt>Status</dt><dd><span className={`sys-status sys-status--${health.state}`}><span className="led" />{health.state === 'online' ? `Online${health.version ? ` · v${health.version}` : ''}` : health.state === 'offline' ? 'Offline' : 'Checking'}</span></dd>
            <dt>Sign-in required</dt><dd>{status ? (status.auth_enforced ? <span className="inline-ok"><ShieldCheck />Enforced on every API call</span> : <span className="inline-warn"><ShieldAlert />Not enforced</span>) : '—'}</dd>
          </dl>
          {status && !status.auth_enforced && <p className="notice notice--warn">The login screen is active, but the backend still accepts requests without a token. Set <code>AUTH_REQUIRED=true</code> in <code>backend/.env</code> and restart it.</p>}
        </Panel>

        {user?.role === 'admin' && <TeamPanel />}
      </div>
    </>
  )
}
