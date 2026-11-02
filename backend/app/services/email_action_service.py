from __future__ import annotations
from datetime import datetime, timezone
from uuid import uuid4

_ACTIONS = {}

def action_plan(risk_level: str, sender: str = "", urls: list[str] | None = None):
    level = risk_level.upper()
    if level in {"CRITICAL", "HIGH"}:
        actions = [
            ("QUARANTINE_EMAIL", "Quarantine email", "CONTAINMENT", "CRITICAL"),
            ("BLOCK_SENDER", "Block sender", "CONTAINMENT", "HIGH"),
            ("BLOCK_EXTRACTED_URLS", "Block extracted URLs/domains", "CONTAINMENT", "HIGH"),
            ("PRESERVE_EVIDENCE", "Preserve email evidence", "EVIDENCE", "HIGH"),
            ("ESCALATE_SOC", "Escalate to SOC", "ESCALATION", "HIGH"),
            ("NOTIFY_SOC", "Notify SOC", "NOTIFICATION", "MEDIUM"),
            ("MARK_FALSE_POSITIVE", "Mark false positive", "DISPOSITION", "LOW"),
        ]
    elif level == "MEDIUM":
        actions = [
            ("REQUIRE_REVIEW", "Require analyst review", "INVESTIGATION", "MEDIUM"),
            ("PRESERVE_EVIDENCE", "Preserve email evidence", "EVIDENCE", "MEDIUM"),
            ("ADD_TO_WATCHLIST", "Add sender/URLs to watchlist", "MONITORING", "MEDIUM"),
            ("QUARANTINE_EMAIL", "Quarantine email", "CONTAINMENT", "HIGH"),
            ("MARK_FALSE_POSITIVE", "Mark false positive", "DISPOSITION", "LOW"),
        ]
    else:
        actions = [
            ("ALLOW_EMAIL", "Allow / mark as reviewed", "DISPOSITION", "LOW"),
            ("PRESERVE_EVIDENCE", "Retain audit evidence", "EVIDENCE", "LOW"),
            ("ADD_TO_WATCHLIST", "Add sender/URL to watchlist", "MONITORING", "LOW"),
            ("MARK_FALSE_POSITIVE", "Mark false positive", "DISPOSITION", "LOW"),
        ]
    return [{"action_id": aid, "name": name, "type": typ, "priority": pri,
             "requires_approval": aid in {"QUARANTINE_EMAIL","BLOCK_SENDER","BLOCK_EXTRACTED_URLS","ESCALATE_SOC"},
             "status": "PROPOSED"} for aid, name, typ, pri in actions]

def execute_action(*, request_id: str, action_id: str, analyst: str, risk_level: str,
                   sender: str = "", urls: list[str] | None = None, approved: bool = True):
    allowed = {x["action_id"]: x for x in action_plan(risk_level, sender, urls)}
    if action_id not in allowed:
        raise ValueError(f"Action {action_id} is not available for risk level {risk_level}.")
    action = allowed[action_id]
    if action["requires_approval"] and not approved:
        raise ValueError("Approval is required before this containment action can execute.")
    event = {
        "audit_id": str(uuid4()), "request_id": request_id,
        "action_id": action_id, "action": action["name"], "status": "EXECUTED",
        "analyst": analyst or "SOC Analyst", "timestamp": datetime.now(timezone.utc).isoformat(),
        "sender": sender, "urls": urls or [], "risk_level": risk_level,
        "approved": approved, "execution_mode": "PROTOTYPE_CONTAINMENT",
    }
    _ACTIONS.setdefault(request_id, []).append(event)
    return event

def audit_events(request_id: str):
    return _ACTIONS.get(request_id, [])
