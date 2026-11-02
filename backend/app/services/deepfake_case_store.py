"""Filesystem-backed deepfake case and admin-action store.

The store is deliberately independent from the existing incident store so the
new deepfake workflow does not alter previously completed modules. Uploaded
media is staged for the duration of the case; evidence/quarantine copies are
created only when an administrator explicitly executes an action.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

_ROOT = Path(__file__).resolve().parents[3] / "data" / "deepfake"
_STAGING = _ROOT / "staging"
_EVIDENCE = _ROOT / "evidence"
_QUARANTINE = _ROOT / "quarantine"
_CASES = _ROOT / "cases"
_LOCK = RLock()

ACTION_DEFS = {
    "PRESERVE_EVIDENCE": ("Preserve evidence", "Copy the original media and analysis metadata into the evidence store.", "EVIDENCE", "MEDIUM", False),
    "REQUEST_HUMAN_REVIEW": ("Request human review", "Route the analysis for analyst verification before relying on the result.", "CASE", "HIGH", False),
    "NOTIFY_SOC": ("Notify SOC", "Record a SOC notification for the deepfake/impersonation case.", "NOTIFICATION", "HIGH", False),
    "ESCALATE_INCIDENT": ("Escalate incident", "Move the case to analyst investigation.", "CASE", "HIGH", False),
    "QUARANTINE_MEDIA": ("Quarantine media", "Move a copy of the submitted media into the restricted quarantine area.", "CONTAINMENT", "CRITICAL", True),
    "CONFIRM_MANIPULATION": ("Confirm manipulation", "Record the analyst decision that the media is manipulated.", "DISPOSITION", "HIGH", True),
    "MARK_FALSE_POSITIVE": ("Mark false positive", "Record that the analyst determined the model result was a false positive.", "DISPOSITION", "MEDIUM", True),
    "NEEDS_INVESTIGATION": ("Needs further investigation", "Keep the case open and mark it for further investigation.", "DISPOSITION", "MEDIUM", False),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_name(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).name)
    return cleaned or "media"


def _case_path(request_id: str) -> Path:
    return _CASES / f"{request_id}.json"


def _save(case: dict[str, Any]) -> None:
    _CASES.mkdir(parents=True, exist_ok=True)
    _case_path(case["request_id"]).write_text(json.dumps(case, indent=2), encoding="utf-8")


def _load(request_id: str) -> dict[str, Any]:
    path = _case_path(request_id)
    if not path.is_file():
        raise KeyError(f"Deepfake case not found: {request_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def create_case(request_id: str, source_path: Path, filename: str, analysis: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        _STAGING.mkdir(parents=True, exist_ok=True)
        staged = _STAGING / f"{request_id}_{_safe_name(filename)}"
        shutil.copy2(source_path, staged)
        sha256 = hashlib.sha256(staged.read_bytes()).hexdigest()
        case = {
            "request_id": request_id,
            "filename": filename,
            "sha256": sha256,
            "staged_path": str(staged),
            "status": "OPEN",
            "analyst_decision": None,
            "created_at": _now(),
            "updated_at": _now(),
            "actions": [],
            "analysis": analysis,
        }
        _save(case)
        return case


def get_case(request_id: str) -> dict[str, Any]:
    with _LOCK:
        return _load(request_id)


def available_actions(request_id: str) -> list[dict[str, Any]]:
    case = get_case(request_id)
    decision = case.get("analyst_decision")
    result = []
    for action_id, (name, description, category, priority, approval) in ACTION_DEFS.items():
        available = True
        reason = "Available for this case."
        if action_id == "PRESERVE_EVIDENCE" and case.get("evidence_path"):
            available = False; reason = "Evidence has already been preserved."
        elif action_id == "QUARANTINE_MEDIA" and case.get("quarantine_path"):
            available = False; reason = "Media is already quarantined."
        elif action_id in {"CONFIRM_MANIPULATION", "MARK_FALSE_POSITIVE", "NEEDS_INVESTIGATION"} and decision:
            available = False; reason = f"Analyst decision already recorded as {decision}."
        result.append({
            "action_id": action_id, "name": name, "description": description,
            "category": category, "priority": priority, "requires_approval": approval,
            "available": available, "recommended": _recommended(case, action_id), "reason": reason,
        })
    return result


def _recommended(case: dict[str, Any], action_id: str) -> bool:
    level = str(case.get("analysis", {}).get("risk_level", "SAFE")).upper()
    if action_id in {"PRESERVE_EVIDENCE", "REQUEST_HUMAN_REVIEW"}:
        return level in {"MEDIUM", "HIGH", "CRITICAL"}
    if action_id in {"NOTIFY_SOC", "ESCALATE_INCIDENT"}:
        return level in {"HIGH", "CRITICAL"}
    if action_id == "QUARANTINE_MEDIA":
        return level == "CRITICAL"
    return False


def execute_action(request_id: str, action_id: str, approved: bool, note: str, actor: str) -> dict[str, Any]:
    if action_id not in ACTION_DEFS:
        raise KeyError(f"Action {action_id} is not supported")
    with _LOCK:
        case = _load(request_id)
        actions = {item["action_id"]: item for item in available_actions(request_id)}
        selected = actions[action_id]
        if not selected["available"]:
            raise ValueError(selected["reason"])
        if selected["requires_approval"] and not approved:
            return {"action_id": action_id, "status": "APPROVAL_REQUIRED", "message": "Administrator approval is required before this action can execute.", "request_id": request_id}

        metadata: dict[str, Any] = {}
        if action_id == "PRESERVE_EVIDENCE":
            staged = Path(case["staged_path"])
            if not staged.is_file():
                raise FileNotFoundError("Staged media is no longer available for evidence preservation.")
            _EVIDENCE.mkdir(parents=True, exist_ok=True)
            target = _EVIDENCE / f"{request_id}_{_safe_name(case['filename'])}"
            shutil.copy2(staged, target)
            case["evidence_path"] = str(target)
            metadata["evidence_path"] = str(target)
        elif action_id == "QUARANTINE_MEDIA":
            staged = Path(case["staged_path"])
            if not staged.is_file():
                raise FileNotFoundError("Staged media is no longer available for quarantine.")
            _QUARANTINE.mkdir(parents=True, exist_ok=True)
            target = _QUARANTINE / f"{request_id}_{_safe_name(case['filename'])}"
            shutil.copy2(staged, target)
            case["quarantine_path"] = str(target)
            case["status"] = "CONTAINED"
            metadata["quarantine_path"] = str(target)
        elif action_id == "REQUEST_HUMAN_REVIEW":
            case["status"] = "INVESTIGATING"
            case["human_review_requested"] = True
        elif action_id == "NOTIFY_SOC":
            case["soc_notified"] = True
        elif action_id == "ESCALATE_INCIDENT":
            case["status"] = "INVESTIGATING"
        elif action_id == "CONFIRM_MANIPULATION":
            case["analyst_decision"] = "CONFIRMED_MANIPULATION"
            case["status"] = "CONFIRMED"
        elif action_id == "MARK_FALSE_POSITIVE":
            case["analyst_decision"] = "FALSE_POSITIVE"
            case["status"] = "RESOLVED"
        elif action_id == "NEEDS_INVESTIGATION":
            case["analyst_decision"] = "NEEDS_INVESTIGATION"
            case["status"] = "INVESTIGATING"

        action = {
            "action_id": action_id, "name": selected["name"], "status": "EXECUTED",
            "actor": actor or "SOC Analyst", "note": note, "timestamp": _now(),
            "recommended": selected["recommended"], "metadata": metadata,
        }
        case["actions"].append(action)
        case["updated_at"] = _now()
        _save(case)
        return action
