import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/auth/AuthProvider'
import AppShell from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import ModulePage from '@/pages/ModulePage'
import Incidents from '@/pages/Incidents'
import PhishingAnalysis from '@/pages/PhishingAnalysis'
import DeepfakeAnalysis from '@/pages/DeepfakeAnalysis'
import NetworkAnalysis from '@/pages/NetworkAnalysis'
import MalwareTriage from '@/pages/MalwareTriage'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import Settings from '@/pages/Settings'

const MODULES = [
  ['live-threats','LIVE THREATS','A real-time feed of detections as they are raised, with filters by severity and category.'],
  ['intelligence','THREAT INTELLIGENCE','Indicators of compromise, known campaigns and enrichment for every detection.'],
  ['evidence','EVIDENCE','Preserved artefacts for each incident, with a chain-of-custody log.'],
] as const

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="settings" element={<Settings />} />
        {/* Existing working analysis pages are preserved. */}
        <Route path="analysis/phishing" element={<PhishingAnalysis />} />
        <Route path="analysis/deepfake" element={<DeepfakeAnalysis />} />
        <Route path="analysis/network" element={<NetworkAnalysis />} />
        {/* Model 4 malware triage page */}
        <Route path="analysis/malware" element={<MalwareTriage />} />
        {MODULES.map(([path,title,description]) => (
          <Route key={path} path={path} element={<ModulePage title={title} description={description} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
