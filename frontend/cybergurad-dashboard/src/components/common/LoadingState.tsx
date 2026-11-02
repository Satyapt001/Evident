export default function LoadingState({ label = 'LOADING TELEMETRY' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" />
      <h2>{label}</h2>
    </div>
  )
}
