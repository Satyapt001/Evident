from __future__ import annotations

import os
import time
from typing import Set

import requests

from ..service import SourceResult


class OpenPhishClient:
    name = "OpenPhish"

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self.feed_url = os.getenv("OPENPHISH_FEED_URL", "https://openphish.com/feed.txt")
        self.cache_ttl = float(os.getenv("OPENPHISH_CACHE_TTL", "900"))
        self._cache: Set[str] | None = None
        self._loaded_at = 0.0

    def _load_feed(self) -> Set[str]:
        now = time.time()
        if self._cache is not None and now - self._loaded_at < self.cache_ttl:
            return self._cache

        response = requests.get(
            self.feed_url,
            timeout=self.timeout,
            headers={"User-Agent": "EVIDENT-CyberGuard/0.1"},
        )
        response.raise_for_status()
        urls = {
            line.strip()
            for line in response.text.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        }
        self._cache = urls
        self._loaded_at = now
        return urls

    def lookup_url(self, url: str) -> SourceResult:
        try:
            found = url.rstrip("/") in {u.rstrip("/") for u in self._load_feed()}
            return SourceResult(
                source=self.name,
                status="ok",
                found=found,
                confidence="high" if found else "unknown",
                category="phishing" if found else None,
                message="URL present in OpenPhish feed." if found else "URL not present in OpenPhish feed.",
            )
        except Exception as exc:
            return SourceResult(source=self.name, status="error", message=str(exc))
