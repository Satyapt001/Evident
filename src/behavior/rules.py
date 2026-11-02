"""Explainable behavioral threat rules."""
from __future__ import annotations

from typing import Any


def evaluate_rules(event: dict[str, Any]) -> list[dict[str, Any]]:
    indicators: list[dict[str, Any]] = []

    failed = event["failed_logins"]
    rpm = event["requests_per_minute"]
    failed_requests = event["failed_requests"]

    if failed >= 10:
        indicators.append({
            "name": "Multiple failed logins",
            "reason": f"{int(failed)} failed login attempts were observed.",
            "points": 30,
        })
    elif failed >= 5:
        indicators.append({
            "name": "Repeated failed logins",
            "reason": f"{int(failed)} failed login attempts were observed.",
            "points": 18,
        })

    if event["new_device"]:
        indicators.append({
            "name": "Unknown device",
            "reason": "The activity originated from a device not previously associated with the user.",
            "points": 20,
        })

    if event["unusual_location"]:
        indicators.append({
            "name": "Unusual location",
            "reason": "The activity originated from an unusual geographic location.",
            "points": 20,
        })

    if event["unusual_time"]:
        indicators.append({
            "name": "Unusual activity time",
            "reason": "The activity occurred outside the user's expected activity period.",
            "points": 10,
        })

    if rpm >= 120:
        indicators.append({
            "name": "Excessive API request rate",
            "reason": f"Observed approximately {int(rpm)} requests per minute.",
            "points": 30,
        })
    elif rpm >= 60:
        indicators.append({
            "name": "Elevated API request rate",
            "reason": f"Observed approximately {int(rpm)} requests per minute.",
            "points": 18,
        })

    if failed_requests >= 20:
        indicators.append({
            "name": "Repeated API failures",
            "reason": f"{int(failed_requests)} failed API requests were observed.",
            "points": 20,
        })

    if event["privilege_change"]:
        indicators.append({
            "name": "Unexpected privilege change",
            "reason": "A privilege change occurred during the suspicious activity window.",
            "points": 30,
        })

    if event["failure_rate"] >= 0.80 and failed >= 5:
        indicators.append({
            "name": "High authentication failure ratio",
            "reason": f"{event['failure_rate'] * 100:.1f}% of observed login attempts failed.",
            "points": 20,
        })

    return indicators
