from __future__ import annotations

import concurrent.futures
import logging
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List

from dotenv import load_dotenv

# Load the project-root .env so TI clients that read credentials with
# os.getenv() receive the same configuration as the FastAPI settings layer.
load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class SourceResult:
    source: str
    status: str = "unknown"
    found: bool = False
    confidence: str = "unknown"
    category: str | None = None
    message: str | None = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ThreatIntelResult:
    indicator: str
    indicator_type: str = "url"
    found: bool = False
    malicious: bool = False
    sources_checked: int = 0
    positive_sources: int = 0
    sources: List[SourceResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ThreatIntelService:
    """Coordinates URL reputation checks across independent TI sources."""

    def __init__(self, timeout: float | None = None):
        from .abusech.client import AbuseCHClient
        from .openphish.client import OpenPhishClient
        from .otx.client import OTXClient
        from .phishtank.client import PhishTankClient

        self.timeout = timeout or float(os.getenv("THREAT_INTEL_TIMEOUT", "5"))
        self.clients = [
            OpenPhishClient(timeout=self.timeout),
            PhishTankClient(timeout=self.timeout),
            OTXClient(timeout=self.timeout),
            AbuseCHClient(timeout=self.timeout),
        ]

    def lookup_url(self, url: str) -> ThreatIntelResult:
        results: List[SourceResult] = []

        def run(client: Any) -> SourceResult:
            try:
                return client.lookup_url(url)
            except Exception as exc:
                logger.warning("Threat intel source %s failed: %s", client.name, exc)
                return SourceResult(
                    source=client.name,
                    status="error",
                    message=str(exc),
                )

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(self.clients)) as executor:
            futures = [executor.submit(run, client) for client in self.clients]
            for future in futures:
                results.append(future.result())

        positive = [r for r in results if r.status == "ok" and r.found]
        return ThreatIntelResult(
            indicator=url,
            found=bool(positive),
            malicious=bool(positive),
            sources_checked=len(results),
            positive_sources=len(positive),
            sources=results,
        )
