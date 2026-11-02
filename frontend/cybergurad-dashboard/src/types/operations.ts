export interface TelemetrySnapshot {
  hostname: string
  platform: string
  cpu_percent: number
  cpu_count: number
  cpu_frequency_mhz: number | null
  memory_percent: number
  memory_used_mb: number
  memory_total_mb: number
  disk_percent: number
  disk_used_gb: number
  disk_total_gb: number
  network_rx_mbps: number
  network_tx_mbps: number
  packets_per_sec: number
  processes: number
  generated_at: string
}

export interface FirewallRule {
  ip: string
  severity: string
  reason: string
  source: string
  packets_dropped: number
  created_at: string
}

export interface ControlStatus {
  lockdown: boolean
  enforcement_mode: 'SIMULATED' | 'ACTIVE'
  blocked_ips: FirewallRule[]
  updated_at: string
}

export interface SimulationResult {
  simulation: string
  source_ip: string
  threat_type: string
  risk_score: number
  risk_level: string
  confidence: number
  mitigation: string
  indicators: string[]
  model?: { model: string; prediction: string; attack_probability: number; attack_family: string; risk_score: number; risk_level: string; features_received?: number; features_used?: number }
  risk?: { risk_score: number; risk_level: string; indicator_count: number; indicators: Array<{ name: string; reason: string; points: number }> }
  response?: { mode: string; recommendations: string[] }
}

export interface MalwareResult {
  request_id: string
  filename: string
  file: { size_bytes: number; sha256: string; mime_type: string; entropy: number; is_pe: boolean }
  risk: { risk_score: number; risk_level: string; indicators: Array<{ name: string; reason: string; points: number }> }
  response: { mode: string; recommendations: string[] }
}
