
import { useState } from 'react'
import AnalysisResult from '@/components/common/AnalysisResult'
import ErrorState from '@/components/common/ErrorState'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'
import { analyzeImage } from '@/api/analysis'

type DeepfakeResult = {
  request_id?: string
  filename?: string
  model?: {
    name?: string
    technical_name?: string
    predicted_label?: string
    confidence?: number
  }
  risk?: {
    risk_score?: number
    risk_level?: string
    severity_description?: string
  }
  response?: {
    recommendations?: string[]
  }
  [key: string]: unknown
}

export default function DeepfakeAnalysis() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<DeepfakeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile)
    setResult(null)
    setError(null)
  }

  const submit = async () => {
    if (!file || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await analyzeImage(file)
      setResult(data as DeepfakeResult)
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Deepfake image analysis failed.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="DEEPFAKE / IMPERSONATION"
        telemetry={[
          'DEEPGUARD MEDIA AUTHENTICITY ENGINE',
          'DF40 · CLIP ViT-B/16',
        ]}
      />

      <Panel title="MEDIA ANALYSIS">
        <div className="analysis-form">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.bmp"
            onChange={(event) =>
              chooseFile(event.target.files?.[0] ?? null)
            }
            disabled={loading}
          />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading || !file}
          >
            {loading ? 'ANALYZING…' : 'ANALYZE MEDIA'}
          </button>
        </div>

        <p className="analysis-hint">
          DF40 analyzes uploaded images and frames using the configured
          trained checkpoint. Results are displayed only after the API
          successfully returns an analysis.
        </p>

        {error && (
          <ErrorState
            message={error}
            onRetry={() => void submit()}
          />
        )}
      </Panel>

      {result && <AnalysisResult result={result} />}
    </>
  )
}
