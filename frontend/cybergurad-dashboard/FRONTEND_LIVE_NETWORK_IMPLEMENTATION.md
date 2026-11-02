# CyberGuard SOC UI restoration and live event recommendation fix

## Scope

This is an incremental update to the existing `cybergurad-dashboard` React + TypeScript + Vite frontend and two additive backend event-recording changes. It does not replace routing, models, model artifacts, the dashboard shell, the phishing feature pipeline, the DF40 checkpoint, or the Model 3 inference implementation.

## UI fixes

- Added a dedicated card/grid stylesheet for the existing reusable `AdminActionCenter`. Action category, priority, approval status, reason, execution button, and audit history are now visually separated into readable cards.
- Added missing shared model-result styles for `.result-hero`, `.result-kpi-grid`, `.risk-meter`, `.ti-row`, `.indicator-card`, `.recommendation`, and related classes used by the existing `AnalysisResult` component. This addresses the jammed-together URL and network result labels in the supplied screenshots.
- Added the `phishing-analysis-page` wrapper so its existing scoped URL input/button styling actually matches the selector.
- Added a two-tab Manual Analysis / Live Monitoring switch to the existing `/analysis/network` route. Manual Model 3 controls remain available and are not replaced.
- The live event ledger now distinguishes `RISK-FREE`, `RISKY`, and `UNCLASSIFIED` from recorded backend prediction/risk fields; it does not infer safe status when fields are missing. It shows the first recorded backend recommendation and exposes all recorded recommendations in event details.
- Admin actions remain the existing `/actions` and `/actions/execute` system. The live event drawer only renders the existing action center when the event has a usable `request_id`.

## Backend endpoints discovered in the supplied backend

- `GET /api/v1/incidents?limit=...` — recorded event ledger
- `GET /api/v1/admin/telemetry` — host telemetry
- `GET /api/v1/admin/status` — SOC control-plane status
- `GET /api/v1/analyze/network/health` — Model 3 health
- `GET /api/v1/network/presets` and `GET /api/v1/network/preset/{preset_id}` — manual benchmark flows
- `POST /api/v1/analyze/network` — genuine Model 3 inference and incident recording
- `POST /api/v1/analyze/url` — genuine Model 1 URL inference and incident recording
- `GET /api/v1/actions?request_id=...` and `POST /api/v1/actions/execute` — existing administrator action workflow

## Live monitoring limitation

The supplied backend does not expose a host packet-capture start/pause/stop API or a live packet WebSocket/SSE endpoint. The page therefore polls the actual incident ledger and telemetry every five seconds. It labels packet capture as unavailable and does not invent packets-per-second, flows-per-second, or successful start/stop state. It can classify and display recommendations for events that have actually been submitted to Model 1 or Model 3 and recorded by the backend; it is not a substitute for a host-level capture service.

## Data flow

1. Model 1 or Model 3 analyzes submitted input.
2. The backend records its real prediction, risk, explanation, indicators, and recommendation data in the existing incident store metadata.
3. Live Monitoring polls the existing incident and telemetry endpoints.
4. The UI displays the recorded prediction and risk classification, recommended response, and existing action controls where the event has a request ID.
5. Actions are only reported as executed after the existing action API responds.

## Files changed

### Frontend changed

- `src/index.css`
- `src/pages/PhishingAnalysis.tsx`
- `src/pages/NetworkAnalysis.tsx`
- `src/api/networkMonitoring.ts`
- `src/components/actions/AdminActionCenter.tsx`

### Frontend added

- `src/components/actions/admin-action-center.css`
- `src/components/network/LiveNetworkMonitor.tsx`
- `src/components/network/live-network-monitor.css`
- `src/api/networkMonitoring.ts` (new adapter in this uploaded source bundle)
- `src/pages/network-analysis.css`

### Backend changed

- `backend/app/api/v1/behavior_model3.py` — persist actual model prediction and response recommendations in existing incident metadata.
- `backend/app/api/v1/url_analysis.py` — persist actual URL prediction and response recommendations in existing incident metadata.

No new backend endpoints were invented and no model artifacts were changed.

## Apply

Extract the ZIP at the EVIDENT project root and allow replacement only for the included paths. Keep your existing `.env` file; it is intentionally not bundled. Then restart FastAPI and Vite.

Backend command:

```powershell
python -m uvicorn app.main:app --app-dir backend
```

Frontend command, from `frontend/cybergurad-dashboard`:

```powershell
npm install
npm run dev
```

## Verification

- Python compilation passes for both changed backend route modules.
- Backend regression tests: `test_admin_actions.py` passed; `test_network_operations.py` had one environment/path failure because this isolated backend ZIP does not include the root `src.behavior` package. The production project root is expected to contain that package.
- Frontend production build was not verified in this environment because package installation did not complete. Run `npm install` and `npm run build` locally and report any remaining TypeScript diagnostics.
