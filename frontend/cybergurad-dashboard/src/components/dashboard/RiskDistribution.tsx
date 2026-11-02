import type { CSSProperties } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipProps } from 'recharts'
import Panel from '@/components/common/Panel'
import { SEVERITY_COLORS, SEVERITY_ORDER } from '@/lib/constants'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { sum } from '@/lib/utils'
import type { RiskSlice } from '@/types/dashboard'

function RiskTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const level = p.name as keyof typeof SEVERITY_COLORS
  return (
    <div className="chart-tip">
      <div className="chart-tip__row">
        <span style={{ '--c': SEVERITY_COLORS[level] } as CSSProperties}>
          <i />
          {level}
        </span>
        <b>{formatNumber(Number(p.value))}</b>
      </div>
    </div>
  )
}

export default function RiskDistribution({ data }: { data: RiskSlice[] }) {
  const slices = SEVERITY_ORDER.map((level) => data.find((d) => d.level === level)).filter(
    (d): d is RiskSlice => Boolean(d),
  )
  const total = sum(slices.map((s) => s.count))

  return (
    <Panel title="RISK DISTRIBUTION" subtitle="ALL EVENTS / 24H">
      <div className="donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="level" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {slices.map((s) => (
                <Cell key={s.level} fill={SEVERITY_COLORS[s.level]} />
              ))}
            </Pie>
            <Tooltip content={<RiskTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut__center">
          <b>{formatNumber(total)}</b>
          <span>EVENTS</span>
        </div>
      </div>
      <div className="risk-list">
        {[...slices].reverse().map((s) => (
          <div className="risk-row" key={s.level} style={{ '--c': SEVERITY_COLORS[s.level] } as CSSProperties}>
            <i />
            <span className="name">{s.level}</span>
            <span className="count">{formatNumber(s.count)}</span>
            <span className="pct">{formatPercent((s.count / total) * 100, 2)}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
