import Panel from '@/components/common/Panel'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { sum } from '@/lib/utils'
import type { CategoryStat } from '@/types/dashboard'

export default function ThreatCategories({ data }: { data: CategoryStat[] }) {
  const total = sum(data.map((d) => d.count))
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <Panel title="THREAT CATEGORIES" subtitle={`${formatNumber(total)} DETECTIONS / 24H`} flush>
      <div className="cat-list">
        {data.map((d) => (
          <div className="cat-row" key={d.category}>
            <div className="cat-row__top">
              <span className="cat-row__name">{d.category}</span>
              <span className="cat-row__nums">
                <b>{formatNumber(d.count)}</b>
                {formatPercent((d.count / total) * 100)}
              </span>
            </div>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
