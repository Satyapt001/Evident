# Theme, search and sign-in update

## Run
- Backend: copy `.env.example` to `.env` (it sets `AUTH_REQUIRED=true`), then start as before.
- Frontend: `npm install && npm run dev`. First visit shows **Set up your console** (one-time admin account); after that, **Sign in**.

## What changed
- **Theme**: darker palette, working light theme (topbar toggle, Settings, saved per device, no flash on load). Every colour is a token in `src/index.css`; legacy module CSS now uses the tokens.
- **Sidebar/topbar**: one item style for all links and the collapse button, grouped navigation, collapsed rail with titles. The blinking footer item was a status dot with no size (inline element); it is now a visible light driven by `GET /health`. Removed the hard-coded "3 notifications", "SYSTEMS OK" and "DEVELOPMENT" labels; the bell shows the real open-incident count.
- **Search** (`/` or Ctrl/Cmd+K): pages, detections (`/incidents`), indicators extracted from detections (URLs, IPs, hashes), blocked IPs (`/network/blocked-ips`), live connections (`/network/sockets`). Typing a domain/URL offers "Analyze for phishing". Results open the matching Incidents row or page.
- **Auth**: `/auth/status|setup|login|me|logout|users` on the backend (PBKDF2 passwords, signed tokens, lockout after 5 failures). The frontend attaches the token to every API call and returns to sign-in on expiry. Admins add team members in Settings.
- **Incidents** page: previously had no CSS; now a filterable table with the detail drawer.
- **Fixes**: 6 TypeScript errors that broke `npm run build`; `recommended` was dropped from `/actions` responses; DELETE was blocked by CORS (network unblock).

## Removed (unused or duplicate)
Frontend: `*.social-engineering-backup-*`, `*.network-operations-backup`, `src/routes/{App,main}.tsx`, `routes/index.css`, `theme/index.css`, `hooks/PhishingAnalysisView.tsx`, `components/phishing/usePhishingAnalysis.ts`, `api|pages/DeepfakePage.tsx`, `api/DeepfakeAnalysis.tsx`, `pages/{NetworkPage,PhishingPage,MalwarePage}.tsx`, `api/operations.ts`, `types/operations.ts`, `mocks/`, 37 empty scaffold placeholders.
Backend: all `*backup*` files, `router_network_patch.txt`, `app/routers/telemetry.py`, `api/v1/malware_analysis.py` (none were imported).

## Known limits
- Backend `AUTH_REQUIRED` defaults to false so existing tests still pass; enable it in `.env`.
- Users are stored in `backend/data/auth_store.json` (single organization, git-ignored).
- Two firewall stores exist in the backend (`/admin/firewall` and `/network/blocked-ips`); search reads the latter. Merging them is a separate change.
