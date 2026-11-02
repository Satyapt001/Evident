import { useState } from 'react'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import PageHeader from '@/components/common/PageHeader'
import RecentIncidents from '@/components/dashboard/RecentIncidents'
import RiskDistribution from '@/components/dashboard/RiskDistribution'
import StatCard from '@/components/dashboard/StatCard'
import ThreatCategories from '@/components/dashboard/ThreatCategories'
import ThreatTimeline from '@/components/dashboard/ThreatTimeline'
import IncidentDrawer from '@/components/incidents/IncidentDrawer'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { Incident } from '@/types/incident'
import SystemTelemetry from '@/components/overview/SystemTelemetry'

export default function Dashboard() {
  const { status, data, error, retry } = useDashboardData()
  const [selected, setSelected] = useState<Incident | null>(null)

  if (status === 'loading') return <LoadingState />
  if (status === 'error' || !data) return <ErrorState message={error ?? 'Dashboard data could not be loaded.'} onRetry={retry} />

  return (
    <>
      <PageHeader
        title="SECURITY OVERVIEW"
        telemetry={[
          <><span className="dot dot--live live" style={{ color: 'var(--cyan)' }} />REAL-TIME THREAT MONITORING</>,
          <>LAST UPDATED: <b className="live">{new Date(data.generatedAt).toLocaleTimeString()}</b></>,
        ]}
      />

      <div className="stats">
        {data.stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </div>

      <SystemTelemetry/>
      
      <div className="grid-row grid-row--8-4">
        <ThreatTimeline data={data.timeline} />
        <RiskDistribution data={data.risk} />
      </div>

      <div className="grid-row grid-row--8-4">
        <RecentIncidents incidents={data.incidents} selectedId={selected?.id} onSelect={setSelected} />
        <ThreatCategories data={data.categories} />
      </div>

      {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
