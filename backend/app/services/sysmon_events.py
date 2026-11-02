"""Durable, normalized ingestion for Windows Sysmon events.

Sysmon observations are persisted as telemetry. They are not automatically
classified by Model 3 because Event ID 3 lacks CICIDS flow statistics.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_STORE_PATH = Path(os.getenv("CYBERGUARD_SYSMON_STORE", str(_PROJECT_ROOT / "data" / "sysmon_events.jsonl")))
_LOCK = Lock()
_MAX_MEMORY_EVENTS = 1000
_recent: list[dict[str, Any]] = []


def _iso(value: Any) -> str:
    if value:
        text = str(value)
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except ValueError:
            pass
    return datetime.now(timezone.utc).isoformat()


def normalize_sysmon_event(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize common Sysmon Event ID 3 fields without inventing flow data."""
    raw = payload.get("event_data", payload.get("EventData", payload))
    if not isinstance(raw, dict):
        raise ValueError("event_data must be a JSON object")
    event_id = payload.get("event_id", payload.get("EventID", payload.get("eventId", 3)))
    try:
        event_id = int(event_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("event_id must be an integer") from exc
    if event_id != 3:
        raise ValueError("Only Sysmon Event ID 3 (NetworkConnect) is currently accepted")

    def pick(*keys: str) -> Any:
        for key in keys:
            if raw.get(key) not in (None, ""):
                return raw[key]
        return None

    def integer(value: Any, field: str) -> int | None:
        if value in (None, ""):
            return None
        try:
            result = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field} must be an integer") from exc
        if result < 0 or result > 65535 and field.lower().endswith("port"):
            raise ValueError(f"{field} is outside its valid range")
        return result

    source_ip = pick("SourceIp", "source_ip", "sourceIp")
    destination_ip = pick("DestinationIp", "destination_ip", "destinationIp")
    source_port = integer(pick("SourcePort", "source_port", "sourcePort"), "source_port")
    destination_port = integer(pick("DestinationPort", "destination_port", "destinationPort"), "destination_port")
    protocol = str(pick("Protocol", "protocol") or "UNKNOWN").upper()
    if protocol not in {"TCP", "UDP", "UNKNOWN"}:
        protocol = "UNKNOWN"
    timestamp = _iso(pick("UtcTime", "timestamp", "TimeCreated"))
    return {
        "event_id": str(uuid4()),
        "timestamp": timestamp,
        "source": "windows_sysmon",
        "source_event_id": 3,
        "threat_type": "NETWORK_CONNECTION_OBSERVED",
        "risk_level": "UNKNOWN",
        "risk_score": None,
        "status": "OBSERVED",
        "prediction": "NOT_EVALUATED",
        "explanation": "Observed Sysmon network connection; no attack classification has been made.",
        "metadata": {
            "event_provider": "Microsoft-Windows-Sysmon",
            "protocol": protocol,
            "source_ip": source_ip,
            "source_port": source_port,
            "destination_ip": destination_ip,
            "destination_port": destination_port,
            "source_hostname": pick("SourceHostname", "source_hostname"),
            "destination_hostname": pick("DestinationHostname", "destination_hostname"),
            "process_id": integer(pick("ProcessId", "process_id"), "process_id"),
            "process_guid": pick("ProcessGuid", "process_guid"),
            "image": pick("Image", "image"),
            "user": pick("User", "user"),
            "initiated": pick("Initiated", "initiated"),
            "raw_event_id": payload.get("record_id", payload.get("RecordId")),
        },
    }


def persist_sysmon_event(event: dict[str, Any]) -> dict[str, Any]:
    """Append one JSONL record durably and retain a bounded recent view."""
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    with _LOCK:
        with _STORE_PATH.open("a", encoding="utf-8") as handle:
            handle.write(encoded + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        _recent.append(dict(event))
        if len(_recent) > _MAX_MEMORY_EVENTS:
            del _recent[:-_MAX_MEMORY_EVENTS]
    return event


def list_sysmon_events(limit: int = 100) -> list[dict[str, Any]]:
    limit = max(1, min(int(limit), 1000))
    with _LOCK:
        if not _STORE_PATH.exists():
            return list(reversed(_recent[-limit:]))
        rows: list[dict[str, Any]] = []
        try:
            with _STORE_PATH.open("r", encoding="utf-8") as handle:
                for line in handle:
                    try:
                        row = json.loads(line)
                        if isinstance(row, dict):
                            rows.append(row)
                    except json.JSONDecodeError:
                        continue
        except OSError:
            return list(reversed(_recent[-limit:]))
        return list(reversed(rows[-limit:]))
