import type { CSSProperties } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, Flame, ShieldAlert, Siren, type LucideIcon } from 'lucide-react'
import { formatChange, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { StatKey, StatSummary } from '@/types/dashboard'

const META: Record<StatKey, { icon: LucideIcon; accent: string }> = {
  events: { icon: Activity, accent: 'var(--cyan)' },
  threats: { icon: ShieldAlert, accent: 'var(--orange)' },
  critical: { icon: Flame, accent: 'var(--red)' },
  incidents: { icon: Siren, accent: 'var(--yellow)' },
}

export default function StatCard({ stat }: { stat: StatSummary }) {
  const { icon: Icon, accent } = META[stat.key]
  const Arrow = stat.change >= 0 ? ArrowUpRight : ArrowDownRight
  const tone =
    stat.change === 0 ? 'flat' : (stat.change > 0) === stat.upIsBad ? 'bad' : 'good'

  return (
    <article className="stat" style={{ '--accent': accent } as CSSProperties}>
      <div className="stat__top">
        <span className="stat__label">{stat.label}</span>
        <span className="stat__icon">
          <Icon aria-hidden="true" />
        </span>
      </div>
      <div className="stat__value">{formatNumber(stat.value)}</div>
      <div className="stat__foot">
        <span className={cn('delta', `delta--${tone}`)}>
          <Arrow aria-hidden="true" />
          {formatChange(stat.change)}
        </span>
        <span>{stat.caption}</span>
      </div>
    </article>
  )
}
