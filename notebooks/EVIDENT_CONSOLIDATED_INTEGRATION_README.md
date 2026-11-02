# EVIDENT / CYBERGUARD — Consolidated Frontend + Model Integration Batch

This package combines the next integration step into one drop-in batch.

## Included
- Real dashboard polling from `GET /api/v1/incidents/dashboard`.
- Real incident polling from `GET /api/v1/incidents`.
- Model 1 phishing analysis UI -> `POST /api/v1/analyze/url`.
- Model 2 deepfake image analysis UI -> `POST /api/v1/analyze/image`.
- Model 3 network-flow analysis UI -> `POST /api/v1/analyze/network`.
- Model 3 production inference adapter using `models/behavior/production/network_threat_model.pkl`.
- Unified incident recording for Model 3.
- Demo mode disabled in the frontend.
- Existing backend/frontend folder names preserved.

## Apply
Extract the ZIP into the existing EVIDENT project root and allow overwrite of matching files.
Do not delete your existing model checkpoints or DeepfakeBench directory.

## Required model artifacts
The integration code expects the existing Model 1 and Model 2 artifacts already used by the working backend.
Model 3 expects:
`models/behavior/production/network_threat_model.pkl`

The actual weights are NOT bundled because they were not present in the supplied backend/frontend archives.

## Start
Backend:
`python -m uvicorn app.main:app --app-dir backend --reload`

Frontend:
`cd frontend/cybergurad-dashboard`
`npm install`
`npm run dev`

## Verification order
1. Open the dashboard and confirm it starts with backend-derived counts.
2. Run Phishing Analysis with a known test URL.
3. Upload the known Model 2 test image.
4. Run Network / Technical only after the Model 3 production artifact exists.
5. Return to Dashboard and confirm each non-SAFE event appears in the incident feed.

Model 3 is network/technical threat detection based on CIC-IDS2017; do not describe it as a pure authentication/ATO model.
