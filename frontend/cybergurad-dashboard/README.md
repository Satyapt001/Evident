# CYBERGUARD Dashboard

Frontend for the CYBERGUARD security operations platform. This milestone is the SOC Overview dashboard, running entirely on demo data.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Structure

| Path | Purpose |
|---|---|
| `src/App.tsx` | Composes the app; renders `AppRoutes` only |
| `src/routes/AppRoutes.tsx` | Route table; unbuilt modules use `ModulePage` |
| `src/components/layout/` | `AppShell`, `Sidebar`, `Topbar` |
| `src/components/dashboard/` | `StatCard`, `ThreatTimeline`, `RiskDistribution`, `ThreatCategories`, `RecentIncidents` |
| `src/components/incidents/` | `IncidentDrawer` (opens when an incident row is selected) |
| `src/components/common/` | `Panel`, `PageHeader`, `Loading/Error/EmptyState`, `SeverityBadge`, `StatusBadge` |
| `src/pages/` | `Dashboard`, `ModulePage`, `NotFound` |
| `src/mocks/` | `dashboard.ts`, `incidents.ts` (all demo data lives here) |
| `src/api/dashboard.ts` | Data source; returns mocks now |
| `src/hooks/` | `useDashboardData`, `useClock` |
| `src/types/` | `dashboard.ts`, `incident.ts`, `threat.ts` |
| `src/lib/` | `constants.ts` (severity colors), `formatters.ts`, `navigation.ts`, `utils.ts` |

Empty folders `components/{threats,phishing,deepfake,intelligence}` are reserved for the next milestones.

## Connecting FastAPI later

Replace the body of `getDashboardSnapshot()` in `src/api/dashboard.ts` with a fetch to `API_BASE_URL` (set `VITE_API_BASE_URL` in `.env`). Make it async and let `useDashboardData` handle the `loading` and `error` states, which the Dashboard page already renders.

## Path alias

Imports use `@/` for `src/`. It is configured in `vite.config.ts` (`resolve.alias`) and `tsconfig.app.json` (`paths`).
