"""Feature normalization for authentication/API behavioral events."""
from __future__ import annotations

from typing import Any

NUMERIC_FIELDS = (
    "failed_logins",
    "successful_logins",
    "requests_per_minute",
    "failed_requests",
    "session_duration_minutes",
)

BOOL_FIELDS = (
    "new_device",
    "unusual_location",
    "unusual_time",
    "privilege_change",
)


def normalize_event(event: dict[str, Any]) -> dict[str, Any]:
    """Return a validated, normalized event without mutating the input."""
    result = dict(event)

    for field in NUMERIC_FIELDS:
        value = result.get(field, 0)
        try:
            value = float(value)
        except (TypeError, ValueError):
            value = 0.0
        result[field] = max(0.0, value)

    for field in BOOL_FIELDS:
        value = result.get(field, False)
        if isinstance(value, str):
            value = value.strip().lower() in {"1", "true", "yes", "y"}
        result[field] = bool(value)

    result["username"] = str(result.get("username", "unknown"))
    result["source_ip"] = str(result.get("source_ip", "unknown"))
    result["device_id"] = str(result.get("device_id", "unknown"))
    result["country"] = str(result.get("country", "unknown"))
    result["event_type"] = str(result.get("event_type", "authentication"))

    total_logins = result["failed_logins"] + result["successful_logins"]
    result["failure_rate"] = (
        result["failed_logins"] / total_logins if total_logins else 0.0
    )
    return result
