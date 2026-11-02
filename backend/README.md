# EVIDENT Backend

FastAPI backend for the EVIDENT/CYBERGUARD platform.

## Current vertical slice

```text
POST /api/v1/analyze/url
        |
        v
PhishingAnalysisService
        |
        +--> src/phishing/
        |       Model 1
        |
        +--> risk_engine/
        |       Risk score + severity
        |
        +--> response_engine/
                Recommendations
                Playbook
                Proposed actions
```

## Run

Run these commands from the EVIDENT project root:

```powershell
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

## API

### Health

```text
GET /api/v1/health
```

### URL analysis

```text
POST /api/v1/analyze/url
Content-Type: application/json
```

Example body:

```json
{
  "url": "https://example.com",
  "fetch_page": false,
  "timeout": 8
}
```

For a controlled local test, `fetch_page=false` avoids contacting the destination.

## Architecture decisions

- `api/` contains HTTP endpoints only.
- `schemas/` contains request/response contracts.
- `services/` orchestrates business logic.
- `core/` contains configuration, logging, and application-level exceptions.
- `middleware/` contains cross-cutting HTTP behavior.
- Existing `src/phishing/`, `risk_engine/`, and `response_engine/` remain independent modules.
- Response actions are currently recommendation/proposal only. They do not automatically block domains, reset accounts, or modify security controls.
- The backend is versioned under `/api/v1` so later API changes can be introduced under `/api/v2`.
- Model paths are configuration-driven through environment variables.

## Future extension points

The service layer can later add:

- threat intelligence enrichment
- deepfake analysis
- digital impersonation analysis
- behavior/anomaly detection
- incident persistence
- authentication/RBAC
- WebSocket/SSE alert streaming
- analyst case management
- approved security-control integrations

These should be added as separate services rather than putting detection logic directly in API routes.
