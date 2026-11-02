# EVIDENT Threat Intelligence Layer

This module enriches URL analysis with external threat-intelligence sources. It does **not** replace Model 1 or the Risk Engine.

## Sources

- OpenPhish — phishing feed lookup.
- PhishTank — verified phishing lookup.
- AlienVault OTX — URL indicator enrichment.
- abuse.ch URLhaus — malware-distribution URL enrichment.

Each provider is isolated. If one provider is unavailable, the remaining providers still return results.

## Environment variables

```env
OPENPHISH_FEED_URL=https://openphish.com/feed.txt
OPENPHISH_CACHE_TTL=900
PHISHTANK_API_KEY=
OTX_API_KEY=
URLHAUS_AUTH_KEY=
THREAT_INTEL_TIMEOUT=5
```

OpenPhish's community feed is a text feed. PhishTank supports an API key and also publishes downloadable databases. OTX requires an API key. URLhaus community API access requires an Auth-Key.

## Basic usage

```python
from threat_intelligence import ThreatIntelService

service = ThreatIntelService()
result = service.lookup_url("https://example.com/")
print(result.to_dict())
```

## Important design rule

A positive result from OpenPhish/PhishTank is phishing intelligence. A positive URLhaus result is malware-distribution intelligence. They should remain separate evidence types in the Risk Engine rather than being treated as identical labels.

## Security

Do not fetch suspicious URLs from the developer workstation merely to test this module. Threat-intelligence lookups send the indicator to the provider; page fetching is a separate operation and should be isolated/sandboxed in a production deployment.
