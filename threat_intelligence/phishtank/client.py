from __future__ import annotations

import os

import requests

from ..service import SourceResult


class PhishTankClient:
    name = "PhishTank"
    endpoint = "https://checkurl.phishtank.com/checkurl/"

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self.api_key = os.getenv("PHISHTANK_API_KEY")
        self.user_agent = os.getenv(
            "PHISHTANK_USER_AGENT",
            "EVIDENT-CyberGuard/0.1 (PhishTank integration)",
        )

    def lookup_url(self, url: str) -> SourceResult:
        payload = {"url": url, "format": "json"}
        if self.api_key:
            payload["app_key"] = self.api_key

        try:
            response = requests.post(
                self.endpoint,
                data=payload,
                timeout=self.timeout,
                headers={"User-Agent": self.user_agent},
            )
        except requests.RequestException as exc:
            return SourceResult(
                source=self.name,
                status="error",
                message=f"PhishTank request failed: {exc}",
            )

        if response.status_code in (401, 403):
            return SourceResult(
                source=self.name,
                status="unavailable",
                message=(
                    "PhishTank API access is unavailable for this request. "
                    "No usable application key is configured or access was rejected. "
                    "PhishTank registration is currently unavailable, so this source "
                    "is excluded from the current live lookup rather than treated as safe."
                ),
                metadata={"http_status": response.status_code},
            )

        if response.status_code == 429 or response.status_code == 509:
            return SourceResult(
                source=self.name,
                status="rate_limited",
                message="PhishTank rate limit reached; retry later.",
                metadata={"http_status": response.status_code},
            )

        try:
            response.raise_for_status()
            data = response.json()
        except (requests.RequestException, ValueError) as exc:
            return SourceResult(
                source=self.name,
                status="error",
                message=f"PhishTank response could not be processed: {exc}",
                metadata={"http_status": response.status_code},
            )

        result = data.get("results", {})
        found = bool(result.get("in_database")) and bool(result.get("valid"))

        return SourceResult(
            source=self.name,
            status="ok",
            found=found,
            confidence="high" if found else "unknown",
            category="phishing" if found else None,
            message=(
                "Verified online phish found in PhishTank."
                if found
                else "URL not confirmed by PhishTank."
            ),
            metadata={
                "phish_id": result.get("phish_id"),
                "verified": result.get("verified"),
                "online": result.get("online"),
                "target": result.get("target"),
            },
        )
