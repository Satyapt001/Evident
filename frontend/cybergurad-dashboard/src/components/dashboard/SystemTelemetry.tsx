import { useEffect, useState } from 'react'
import { Activity, Cpu, HardDrive, MemoryStick, Network } from 'lucide-react'
import Panel from '@/components/common/Panel'
import { getTelemetry } from '@/api/operations'
import type { TelemetrySnapshot } from '@/types/operations'

function Metric({ icon: Icon, label, value, detail, percent }: { icon: typeof Cpu; label: string; value: string; detail: string; percent: number }) {
  return <div className="telemetry-card"><div className="telemetry-card__head"><span><Icon size={15} />{label}</span><b>{value}</b></div><div className="telemetry-bar"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div><small>{detail}</small></div>
}

export default function SystemTelemetry() {
  const [data, setData] = useState<TelemetrySnapshot | null>(null)
  useEffect(() => { let active = true; const load = async () => { try { const d = await getTelemetry(); if (active) setData(d) } catch { /* dashboard remains usable */ } }; void load(); const id = window.setInterval(() => void load(), 2000); return () => { active = false; window.clearInterval(id) } }, [])
  if (!data) return <Panel title="SYSTEM TELEMETRY" subtitle="HOST RESOURCE STREAM"><div className="telemetry-empty">Waiting for backend telemetry…</div></Panel>
  return <Panel title="SYSTEM TELEMETRY" subtitle={`${data.hostname} / ${data.platform}`} right={<span className="panel-live"><span className="status-led" />LIVE</span>}>
    <div className="telemetry-grid">
      <Metric icon={Cpu} label="CPU" value={`${data.cpu_percent.toFixed(0)}%`} detail={`${data.cpu_count} logical cores / ${data.cpu_frequency_mhz ? `${data.cpu_frequency_mhz.toFixed(0)} MHz` : 'frequency n/a'}`} percent={data.cpu_percent} />
      <Metric icon={MemoryStick} label="RAM" value={`${data.memory_percent.toFixed(1)}%`} detail={`${data.memory_used_mb.toFixed(0)} / ${data.memory_total_mb.toFixed(0)} MB`} percent={data.memory_percent} />
      <Metric icon={HardDrive} label="DISK" value={`${data.disk_percent.toFixed(0)}%`} detail={`${data.disk_used_gb.toFixed(1)} / ${data.disk_total_gb.toFixed(1)} GB`} percent={data.disk_percent} />
      <Metric icon={Network} label="NETWORK" value={`${(data.network_rx_mbps + data.network_tx_mbps).toFixed(2)} Mbps`} detail={`RX ${data.network_rx_mbps.toFixed(2)} / TX ${data.network_tx_mbps.toFixed(2)} / ${data.packets_per_sec.toFixed(0)} pkt/s`} percent={Math.min(100, (data.network_rx_mbps + data.network_tx_mbps) * 10)} />
    </div>
    <div className="telemetry-foot"><span><Activity size={13} /> {data.processes} processes</span><span>sampled every 2s</span></div>
  </Panel>
}
