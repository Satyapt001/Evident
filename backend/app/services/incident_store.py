"""Thread-safe in-memory event store used by the prototype SOC dashboard.

The store is intentionally small and bounded for the hackathon prototype.
Every dashboard value is derived from events actually submitted to the
backend; no synthetic dashboard counters are generated here.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

_lock = Lock()
_events: list[dict[str, Any]] = []
_MAX_EVENTS = 1000


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def record_event(event: dict[str, Any]) -> dict[str, Any]:
    item = dict(event)
    item.setdefault("event_id", str(uuid4()))
    item.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    item.setdefault("status", "OPEN")

    with _lock:
        _events.append(item)
        if len(_events) > _MAX_EVENTS:
            del _events[:-_MAX_EVENTS]

    return item


def list_events(limit: int = 100) -> list[dict[str, Any]]:
    with _lock:
        return list(reversed(_events[-max(1, min(limit, _MAX_EVENTS)) :]))


def get_event(event_id: str) -> dict[str, Any] | None:
    with _lock:
        for event in reversed(_events):
            if str(event.get("event_id")) == str(event_id):
                return dict(event)
    return None


def get_event_by_request_id(request_id: str) -> dict[str, Any] | None:
    with _lock:
        for event in reversed(_events):
            if str(event.get("request_id")) == str(request_id):
                return dict(event)
    return None


def update_event(event_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        for event in reversed(_events):
            if str(event.get("event_id")) == str(event_id):
                event.update(dict(updates))
                event["updated_at"] = datetime.now(timezone.utc).isoformat()
                return dict(event)
    return None


def append_action(event_id: str, action: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        for event in reversed(_events):
            if str(event.get("event_id")) == str(event_id):
                history = event.setdefault("action_history", [])
                history.append(dict(action))
                event["last_action"] = dict(action)
                return dict(action)
    return None


def list_actions(event_id: str) -> list[dict[str, Any]]:
    with _lock:
        for event in reversed(_events):
            if str(event.get("event_id")) == str(event_id):
                return list(event.get("action_history", []))
    return []


def _last_24h(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    result = []
    for event in events:
        timestamp = _parse_timestamp(event.get("timestamp"))
        if timestamp is not None and timestamp >= cutoff:
            result.append(event)
    return result


def _timeline(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    buckets = {
        now - timedelta(hours=i): {"benign": 0, "suspicious": 0, "confirmed": 0}
        for i in range(23, -1, -1)
    }

    for event in events:
        timestamp = _parse_timestamp(event.get("timestamp"))
        if timestamp is None:
            continue
        bucket = timestamp.replace(minute=0, second=0, microsecond=0)
        if bucket not in buckets:
            continue

        level = str(event.get("risk_level", "UNKNOWN")).upper()
        if level == "SAFE":
            buckets[bucket]["benign"] += 1
        elif level in {"LOW", "MEDIUM"}:
            buckets[bucket]["suspicious"] += 1
        else:
            buckets[bucket]["confirmed"] += 1

    return [
        {
            "time": bucket.strftime("%H:%M"),
            **counts,
        }
        for bucket, counts in buckets.items()
    ]


def dashboard_summary() -> dict[str, Any]:
    events = list_events(_MAX_EVENTS)
    recent_24h = _last_24h(events)

    levels = Counter(str(e.get("risk_level", "UNKNOWN")).upper() for e in recent_24h)
    threats = [e for e in recent_24h if str(e.get("risk_level", "")).upper() != "SAFE"]
    types = Counter(str(e.get("threat_type", "UNKNOWN")).upper() for e in threats)
    active = [e for e in threats if str(e.get("status", "OPEN")).upper() not in {"RESOLVED", "CLOSED"}]

    return {
        "total_events": len(recent_24h),
        "threats_detected": len(threats),
        "critical_events": levels.get("CRITICAL", 0),
        "active_incidents": len(active),
        "risk_distribution": dict(levels),
        "threat_distribution": dict(types),
        "timeline": _timeline(recent_24h),
        "recent_events": recent_24h[:10],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
