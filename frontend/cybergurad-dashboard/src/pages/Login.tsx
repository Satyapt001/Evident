import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Moon, Sun, TriangleAlert } from 'lucide-react'
import { getAuthStatus, type AuthStatus } from '@/api/auth'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthProvider'
import BrandMark from '@/components/common/BrandMark'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { useTheme } from '@/theme/ThemeProvider'

const MODULES = [
  ['Phishing', 'URL and email analysis with live threat-intel lookups'],
  ['Deepfake', 'Image authenticity scoring for impersonation cases'],
  ['Network', 'Flow classification with live connection monitoring'],
  ['Malware', 'File triage with analyst-approved containment'],
] as const

export default function Login() {
  const { phase, signIn, setup } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const health = useBackendHealth(10000)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [org, setOrg] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (health.state !== 'online') return
    getAuthStatus().then(setStatus).catch(() => setStatus(null))
  }, [health.state])

  if (phase === 'signed-in') return <Navigate to={from} replace />

  const firstRun = status?.initialized === false

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (firstRun) await setup({ organization: org.trim(), name: name.trim(), email: email.trim(), password }, remember)
      else await signIn(email.trim(), password, remember)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Sign-in failed.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <button type="button" className="login__theme icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
        {theme === 'dark' ? <Sun /> : <Moon />}
      </button>

      <section className="login__brief" aria-label="About CYBERGUARD">
        <div className="login__logo"><BrandMark size={30} /><span className="brand-word">CYBERGUARD</span></div>
        <h1>Detect, review and contain threats from one console.</h1>
        <p>Every detection your models raise lands here with the evidence behind it, and nothing is blocked until an administrator approves it.</p>
        <ul className="login__modules">
          {MODULES.map(([title, text]) => <li key={title}><b>{title}</b><span>{text}</span></li>)}
        </ul>
        <div className={`login__link login__link--${health.state}`} role="status">
          <span className="dot" aria-hidden="true" />
          {health.state === 'online' && `Backend connected${health.version ? ` · v${health.version}` : ''}`}
          {health.state === 'offline' && 'Backend not reachable'}
          {health.state === 'checking' && 'Checking backend…'}
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={submit} noValidate>
          <h2>{firstRun ? 'Set up your console' : 'Sign in'}</h2>
          <p className="login__lead">
            {firstRun
              ? 'Create the first administrator account for your organization. This step is only available until an account exists.'
              : status?.organization ? `Use your ${status.organization} security team account.` : 'Use your security team account.'}
          </p>

          {firstRun && <>
            <label className="field"><span>Organization</span>
              <input value={org} onChange={(e) => setOrg(e.target.value)} autoComplete="organization" required minLength={2} placeholder="Acme Security Operations" />
            </label>
            <label className="field"><span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
            </label>
          </>}

          <label className="field"><span>Work email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required placeholder="you@company.com" autoFocus />
          </label>

          <label className="field"><span>Password</span>
            <div className="field__password">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={firstRun ? 'new-password' : 'current-password'} required />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button>
            </div>
            {firstRun && <small>At least 10 characters, with a letter and a number.</small>}
          </label>

          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in on this device</label>

          {error && <div className="login__error" role="alert"><TriangleAlert />{error}</div>}
          {health.state === 'offline' && !error && <div className="login__error" role="alert"><TriangleAlert />The backend is not reachable, so sign-in will fail. Start it and try again.</div>}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy || !email || !password || (firstRun && (!org || !name))}>
            {busy ? <><Loader2 className="spin" />{firstRun ? 'Creating account' : 'Signing in'}</> : firstRun ? 'Create admin account' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
