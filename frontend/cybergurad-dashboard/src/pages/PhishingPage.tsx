import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import AnalysisResult from '@/components/common/AnalysisResult'
import { analyzePhishingUrl, type PhishingAnalysisResponse } from '@/api/phishing'

export default function PhishingPage() {
  const [url, setUrl] = useState('')
  const [fetchPage, setFetchPage] = useState(true)
  const [result, setResult] = useState<PhishingAnalysisResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = url.trim()
    if (!value) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await analyzePhishingUrl(value, { fetchPage, timeout: 8 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Phishing analysis failed.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <PageHeader
      title="PHISHING ANALYSIS"
      telemetry={['MODEL 1 / RANDOM FOREST', 'THREAT INTELLIGENCE ENRICHMENT']}
    />
    <Panel title="URL ANALYSIS" subtitle="MODEL → RISK → EXPLANATION → RESPONSE">
      <div className="action-form">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          placeholder="https://suspicious-domain.example/login"
          type="url"
          autoComplete="off"
        />
        <button className="btn btn--primary" disabled={!url.trim() || busy} onClick={() => void submit()}>
          {busy ? 'ANALYZING…' : 'ANALYZE URL'}
        </button>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 12 }}>
        <input type="checkbox" checked={fetchPage} onChange={(e) => setFetchPage(e.target.checked)} />
        Fetch page content for the 50-feature analysis
      </label>
      <p style={{ marginTop: 8, opacity: 0.65, fontSize: 11 }}>
        Disable page fetching when testing an untrusted URL. URL structure, Model 1 and threat-intelligence checks can still run.
      </p>
      {error && <div className="action-error">{error}</div>}
    </Panel>
    {result && <AnalysisResult result={result} />}
  </>
}
