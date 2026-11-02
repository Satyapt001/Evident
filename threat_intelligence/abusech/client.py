from __future__ import annotations

import os

import requests

from ..service import SourceResult


class AbuseCHClient:
    """URLhaus client under the abuse.ch source namespace.

    URLhaus focuses on malware-distribution URLs, not phishing URLs. Its
    positive result is therefore malware-oriented enrichment, not a phishing
    verdict.
    """

    name = "abuse.ch URLhaus"
    endpoint = "https://urlhaus-api.abuse.ch/v1/url/"

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self.auth_key = os.getenv("URLHAUS_AUTH_KEY")

    def lookup_url(self, url: str) -> SourceResult:
        if not self.auth_key:
            return SourceResult(
                source=self.name,
                status="disabled",
                message="URLHAUS_AUTH_KEY is not configured.",
            )

        response = requests.post(
            self.endpoint,
            data={"url": url},
            timeout=self.timeout,
            headers={
                "Auth-Key": self.auth_key,
                "User-Agent": "EVIDENT-CyberGuard/0.1",
            },
        )
        response.raise_for_status()
        data = response.json()

        query_status = data.get("query_status")
        found = query_status == "ok"
        return SourceResult(
            source=self.name,
            status="ok",
            found=found,
            confidence="high" if found else "unknown",
            category="malware-url" if found else None,
            message=(
                "URLhaus has a record for this URL."
                if found
                else "URLhaus has no matching URL record."
            ),
            metadata={
                "query_status": query_status,
                "url_status": data.get("url_status"),
                "threat": data.get("threat"),
                "tags": data.get("tags", []),
                "date_added": data.get("date_added"),
            },
        )
