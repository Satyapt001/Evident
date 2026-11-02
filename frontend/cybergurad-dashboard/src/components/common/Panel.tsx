import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title: string
  subtitle?: string
  right?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}

export default function Panel({ title, subtitle, right, flush, className, children }: PanelProps) {
  return (
    <section className={cn('panel', className)}>
      <header className="panel__head">
        <div>
          <h2 className="panel__title">{title}</h2>
          {subtitle && <p className="panel__sub">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className={cn('panel__body', flush && 'panel__body--flush')}>{children}</div>
    </section>
  )
}
