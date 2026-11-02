import Panel from './Panel'
import AdminActionCenter from '@/components/actions/AdminActionCenter'
import { ShieldAlert, ShieldCheck, CircleAlert, CheckCircle2, Info, ChevronDown } from 'lucide-react'
import { useState } from 'react'

function pct(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : '—'
}

function riskClass(level?: string) {
  return `result-risk result-risk--${String(level ?? 'SAFE').toLowerCase()}`
}

function RiskBar({ score }: { score: number }) {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  return <div className="risk-meter"><div className="risk-meter__fill" style={{ width: `${safe}%` }} /></div>
}

function ThreatIntel({ ti }: { ti: any }) {
  if (!ti) return null
  return <section className="result-section">
    <div className="result-section__head"><span>THREAT INTELLIGENCE</span><span className="result-count">{ti.sources_checked ?? 0} CHECKED / {ti.positive_sources ?? 0} MATCH</span></div>
    <div className="ti-grid">
      {(ti.sources ?? []).map((source: any) => {
        const matched = source.found === true
        const unavailable = source.status !== 'ok'
        return <div className={`ti-row ${matched ? 'is-match' : ''}`} key={source.source}>
          <div className="ti-row__source">{source.source}</div>
          <div className="ti-row__status">{unavailable ? 'UNAVAILABLE' : 'ONLINE'}</div>
          <div className={`ti-row__result ${matched ? 'match' : ''}`}>{matched ? 'MATCH' : unavailable ? 'N/A' : 'NO MATCH'}</div>
          <div className="ti-row__message">{source.message ?? 'No additional evidence.'}</div>
        </div>
      })}
    </div>
  </section>
}

function Indicators({ indicators }: { indicators?: any[] }) {
  if (!indicators?.length) return null
  return <section className="result-section">
    <div className="result-section__head"><span>DECISION EVIDENCE</span><span className="result-count">{indicators.length} INDICATOR{indicators.length > 1 ? 'S' : ''}</span></div>
    <div className="indicator-list">
      {indicators.map((item, index) => <div className="indicator-card" key={`${item.name}-${index}`}>
        <CircleAlert size={16} />
        <div><b>{item.name}</b><p>{item.reason ?? item.description ?? 'Indicator contributed to the assessment.'}</p></div>
        <strong>+{item.points ?? item.weight ?? 0}</strong>
      </div>)}
    </div>
  </section>
}

function Response({ response }: { response: any }) {
  if (!response) return null
  const recommendations = response.recommendations ?? []
  return <section className="result-section">
    <div className="result-section__head"><span>RECOMMENDED RESPONSE</span><span className="result-count">{response.mode ?? 'RECOMMENDATION_ONLY'}</span></div>
    {response.playbook && <div className="playbook"><span>PLAYBOOK</span><b>{response.playbook.name}</b><p>{response.playbook.objective ?? response.playbook.description}</p></div>}
    <div className="recommendations">
      {recommendations.map((item: any, index: number) => {
        const text = typeof item === 'string' ? item : item.action
        return <div className="recommendation" key={index}><CheckCircle2 size={15} /><div><b>{typeof item === 'string' ? 'RECOMMENDATION' : item.priority ?? 'ACTION'}</b><p>{text}</p>{typeof item !== 'string' && item.reason && <small>{item.reason}</small>}</div></div>
      })}
    </div>
  </section>
}

function PhishingResult({ result }: { result: any }) {
  const risk = result.risk ?? {}
  const model = result.model ?? {}
  const [showFeatures, setShowFeatures] = useState(false)
  return <>
    <div className="result-hero">
      <div className="result-verdict">
        {risk.risk_level === 'SAFE' ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
        <div><span>FINAL ASSESSMENT</span><strong>{String(model.prediction ?? 'UNKNOWN').toUpperCase()}</strong><p>{risk.severity_description}</p></div>
      </div>
      <div className={riskClass(risk.risk_level)}><span>RISK SCORE</span><strong>{risk.risk_score ?? '—'}<small>/100</small></strong><b>{risk.risk_level ?? '—'}</b></div>
    </div>
    <div className="result-kpi-grid">
      <div><span>MODEL CONFIDENCE</span><b>{pct(model.probability)}</b></div>
      <div><span>PHISHING PROBABILITY</span><b>{pct(model.phishing_probability)}</b></div>
      <div><span>MODEL SCORE</span><b>{risk.model_score ?? '—'}</b></div>
      <div><span>TI EVIDENCE</span><b>{risk.threat_intel_score ?? 0}</b></div>
    </div>
    <Panel title="RISK ASSESSMENT">
      <div className="result-section-inner"><RiskBar score={Number(risk.risk_score)} /><div className="risk-scale"><span>SAFE</span><span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>CRITICAL</span></div></div>
    </Panel>
    <Panel title="THREAT INTELLIGENCE"><ThreatIntel ti={result.threat_intelligence} /></Panel>
    <Panel title="EXPLANATION"><div className="explanation"><Info size={18} /><div><b>Why CyberGuard reached this result</b><p>{risk.severity_description}</p><p>Random Forest confidence is {pct(model.probability)} with a phishing probability of {pct(model.phishing_probability)}. {risk.indicator_count ? `Threat intelligence contributed ${risk.indicator_count} independent indicator${risk.indicator_count > 1 ? 's' : ''}.` : 'No independent threat-intelligence indicators contributed to the score.'}</p></div></div></Panel>
    <Panel title="DECISION EVIDENCE"><Indicators indicators={risk.indicators} /></Panel>
    <Panel title="RESPONSE"><Response response={result.response} /></Panel>
    <AdminActionCenter requestId={result.request_id} />
    <Panel title="TECHNICAL FEATURES">
      <button className="collapse-row" onClick={() => setShowFeatures(v => !v)}><span>{showFeatures ? 'HIDE' : 'SHOW'} 50 ENGINEERED FEATURES</span><ChevronDown size={16} className={showFeatures ? 'rotate' : ''} /></button>
      {showFeatures && <div className="feature-grid">{Object.entries(result.features ?? {}).map(([key, value]) => <div key={key}><span>{key}</span><b>{String(value)}</b></div>)}</div>}
    </Panel>
  </>
}

function DeepfakeResult({ result }: { result: any }) {
  const model = result.model ?? {}; const risk = result.risk ?? {}
  return <>
    <div className="result-hero"><div className="result-verdict"><ShieldAlert size={28} /><div><span>MEDIA ASSESSMENT</span><strong>{model.predicted_class === 1 ? 'SUSPECTED DEEPFAKE' : 'LIKELY AUTHENTIC'}</strong><p>{risk.severity_description}</p></div></div><div className={riskClass(risk.risk_level)}><span>RISK SCORE</span><strong>{risk.risk_score ?? '—'}<small>/100</small></strong><b>{risk.risk_level ?? '—'}</b></div></div>
    <div className="result-kpi-grid"><div><span>DEEPFAKE PROBABILITY</span><b>{pct(model.class_1_probability)}</b></div><div><span>AUTHENTIC PROBABILITY</span><b>{pct(model.class_probabilities?.[0])}</b></div><div><span>MODEL</span><b>{model.name ?? 'DF40'}</b></div><div><span>RESPONSE MODE</span><b>{result.response?.mode ?? 'RECOMMENDATION_ONLY'}</b></div></div>
    <Panel title="MODEL CONFIDENCE"><div className="probability-pair"><div><span>AUTHENTIC</span><b>{pct(model.class_probabilities?.[0])}</b></div><div><span>MANIPULATED</span><b>{pct(model.class_1_probability)}</b></div></div></Panel>
    <Panel title="EXPLANATION"><div className="explanation"><Info size={18} /><div><b>DF40 assessment</b><p>{risk.severity_description}</p><p>The result is based on the DF40 CLIP ViT-B/16 class probabilities and the backend risk policy.</p></div></div></Panel>
    <Panel title="RECOMMENDED RESPONSE"><Response response={result.response} /></Panel>
    <AdminActionCenter requestId={result.request_id} />
  </>
}

function NetworkResult({ result }: { result: any }) {
  const model = result.model ?? {}; const risk = result.risk ?? {}
  return <>
    <div className="result-hero"><div className="result-verdict">{model.prediction === 'ATTACK' ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}<div><span>NETWORK ASSESSMENT</span><strong>{model.prediction ?? 'UNKNOWN'}</strong><p>{risk.severity_description ?? 'Network-flow assessment completed.'}</p></div></div><div className={riskClass(risk.risk_level)}><span>RISK SCORE</span><strong>{risk.risk_score ?? '—'}<small>/100</small></strong><b>{risk.risk_level ?? '—'}</b></div></div>
    <div className="result-kpi-grid"><div><span>ATTACK PROBABILITY</span><b>{pct(model.attack_probability)}</b></div><div><span>ATTACK FAMILY</span><b>{model.attack_family ?? 'BENIGN'}</b></div><div><span>MODEL</span><b>{model.model ?? 'Network Threat Detector'}</b></div><div><span>FEATURES USED</span><b>{model.features_used ?? '—'}</b></div></div>
    <Panel title="RISK ASSESSMENT"><div className="result-section-inner"><RiskBar score={Number(risk.risk_score)} /><div className="risk-scale"><span>SAFE</span><span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>CRITICAL</span></div></div></Panel>
    <Panel title="DECISION EVIDENCE"><Indicators indicators={risk.indicators} /></Panel>
    <Panel title="RECOMMENDED RESPONSE"><Response response={result.response} /></Panel>
    <AdminActionCenter requestId={result.request_id} />
  </>
}

export default function AnalysisResult({ result }: { result: any }) {
  if (result?.threat_intelligence || result?.features?.URLLength !== undefined) return <div className="analysis-result"><PhishingResult result={result} /></div>
  if (result?.model?.class_1_probability !== undefined) return <div className="analysis-result"><DeepfakeResult result={result} /></div>
  return <div className="analysis-result"><NetworkResult result={result} /></div>
}
