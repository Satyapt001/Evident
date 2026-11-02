"""Normalize internal risk indicators to the public API contract."""
from __future__ import annotations
from typing import Any

def normalize_indicators(indicators: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    normalized = []
    for raw in indicators or []:
        item = dict(raw or {})
        reason = item.get("reason") or item.get("description") or item.get("message") or "Evidence identified by the configured detection engine."
        points = item.get("points")
        if points is None:
            points = item.get("weight", 0.0)
        try:
            points = float(points)
        except (TypeError, ValueError):
            points = 0.0
        item["reason"] = str(reason)
        item["points"] = points
        normalized.append(item)
    return normalized
