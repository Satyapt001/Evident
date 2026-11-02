# Model 3 production artifact

The backend expects the trained CIC-IDS2017 production artifact at:

`models/behavior/production/network_threat_model.pkl`

The artifact must contain:
- `binary_model`
- `family_model`
- `feature_columns`
- `model_name` (optional; the API uses a stable public name)

The artifact is intentionally not bundled in this integration ZIP because model weights are environment-specific and were not present in the supplied backend/frontend archives. Copy the already-trained artifact into the path above before testing `/api/v1/analyze/network`.
