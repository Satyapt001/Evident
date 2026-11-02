import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import AdminActionCenter from '@/components/actions/AdminActionCenter'
import PhishingAnalysisView from '@/components/phishing/PhishingAnalysisView'
import { usePhishingAnalysis } from '@/hooks/usePhishingAnalysis'
import SocialEngineeringAnalyzer from '@/components/phishing/SocialEngineeringAnalyzer'

export default function PhishingAnalysis() {
  const [params, setParams] = useSearchParams()
  const [url, setUrl] = useState(params.get('url') ?? 'https://example.com/')
  const { state, analyze } = usePhishingAnalysis()
  const ranFromLink = useRef(false)

  // Arriving from search with ?url=... runs that check once, then clears the parameter.
  useEffect(() => {
    const incoming = params.get('url')
    if (!incoming || ranFromLink.current) return
    ranFromLink.current = true
    setUrl(incoming)
    void analyze(incoming, true)
    setParams({}, { replace: true })
  }, [params, setParams, analyze])

  const submit = async () => {
    const value = url.trim()
    if (!value) return
    await analyze(value, true)
  }

  return <div className="phishing-analysis-page">
    <PageHeader
      title="PHISHING ANALYSIS"
      telemetry={['MODEL 1 / RANDOM FOREST', 'THREAT INTELLIGENCE ENABLED']}
    />

    <Panel title="URL ANALYSIS">
      <div className="analysis-form">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && url.trim()) void submit() }}
          placeholder="https://suspicious.example"
          aria-label="URL to analyze"
        />
        <button onClick={() => void submit()} disabled={state.status === 'loading' || !url.trim()}>
          {state.status === 'loading' ? 'ANALYZING…' : 'ANALYZE URL'}
        </button>
      </div>
    </Panel>

    <PhishingAnalysisView state={state} />
    {state.status === 'success' && <AdminActionCenter requestId={state.data.request_id} />}
    <SocialEngineeringAnalyzer />
  </div>
}

