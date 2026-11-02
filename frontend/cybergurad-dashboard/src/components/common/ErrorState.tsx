import { TriangleAlert } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export default function ErrorState({ title = 'DATA UNAVAILABLE', message, onRetry }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <TriangleAlert />
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          RETRY
        </button>
      )}
    </div>
  )
}
