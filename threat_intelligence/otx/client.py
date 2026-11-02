from __future__ import annotations

import os
from urllib.parse import quote

import requests

from ..service import SourceResult


class OTXClient:
    name = "AlienVault OTX"
    base_url = "https://otx.alienvault.com/api/v1/indicators/url/"

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self.api_key = os.getenv("OTX_API_KEY")

    def lookup_url(self, url: str) -> SourceResult:
        if not self.api_key:
            return SourceResult(
                source=self.name,
                status="disabled",
                message="OTX_API_KEY is not configured.",
            )

        endpoint = f"{self.base_url}{quote(url, safe='')}/general"
        response = requests.get(
            endpoint,
            timeout=self.timeout,
            headers={
                "X-OTX-API-KEY": self.api_key,
                "User-Agent": "EVIDENT-CyberGuard/0.1",
            },
        )
        response.raise_for_status()
        data = response.json()

        pulse_count = int(data.get("pulse_info", {}).get("count", 0) or 0)
        found = pulse_count > 0
        return SourceResult(
            source=self.name,
            status="ok",
            found=found,
            confidence="high" if found else "unknown",
            category="threat-intelligence" if found else None,
            message=(
                f"OTX reports {pulse_count} associated pulse(s)."
                if found
                else "OTX reports no associated pulses."
            ),
            metadata={"pulse_count": pulse_count},
        )
