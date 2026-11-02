import type { CSSProperties } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import Panel from '@/components/common/Panel'
import { CHART_COLORS } from '@/lib/constants'
import { formatNumber } from '@/lib/formatters'
import type { TimelinePoint } from '@/types/dashboard'

const SERIES = [
  { key: 'benign', label: 'BENIGN', color: CHART_COLORS.benign },
  { key: 'suspicious', label: 'SUSPICIOUS', color: CHART_COLORS.suspicious },
  { key: 'confirmed', label: 'CONFIRMED', color: CHART_COLORS.confirmed },
] as const

function TimelineTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip__title">{label} UTC</div>
      {SERIES.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key)
        if (!p) return null
        return (
          <div className="chart-tip__row" key={s.key}>
            <span style={{ '--c': s.color } as CSSProperties}>
              <i />
              {s.label}
            </span>
            <b>{formatNumber(Number(p.value))}</b>
          </div>
        )
      })}
    </div>
  )
}

export default function ThreatTimeline({ data }: { data: TimelinePoint[] }) {
  return (
    <Panel
      title="THREAT ACTIVITY"
      subtitle="EVENTS PER HOUR / LAST 24H"
      right={
        <div className="legend">
          {SERIES.map((s) => (
            <span key={s.key} style={{ '--c': s.color } as CSSProperties}>
              <i />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      <div style={{ height: 272 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.key === 'benign' ? 0.22 : 0.3} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="time" stroke={CHART_COLORS.grid} tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} interval={3} />
            <YAxis stroke={CHART_COLORS.grid} tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
            <Tooltip content={<TimelineTooltip />} cursor={{ stroke: CHART_COLORS.cursor, strokeDasharray: '3 3' }} />
            {SERIES.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.6} fill={`url(#fill-${s.key})`} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
