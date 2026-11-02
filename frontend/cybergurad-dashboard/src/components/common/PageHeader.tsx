import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  telemetry?: ReactNode[]
  actions?: ReactNode
}

export default function PageHeader({ title, telemetry = [], actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {telemetry.length > 0 && (
          <div className="telemetry">
            {telemetry.map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        )}
      </div>
      {actions}
    </div>
  )
}
