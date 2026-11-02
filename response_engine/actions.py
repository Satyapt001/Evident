"""CYBERGUARD response action planning.

Actions are represented as proposed operations. This module intentionally
does not directly block URLs, reset accounts, send messages, or modify
security infrastructure. Actual execution belongs behind authorized,
audited integrations.
"""

from __future__ import annotations


def build_actions(
    risk_result: dict,
    recommendations: list[dict],
    playbook: dict,
) -> list[dict]:
    """Build an auditable action plan from risk, recommendations, and playbook."""
    prediction = str(risk_result.get("prediction", "legitimate")).lower()
    level = str(risk_result.get("risk_level", "SAFE")).upper()
    indicators = risk_result.get("indicators", [])

    actions = []

    def add(action_id: str, name: str, action_type: str, priority: str, requires_approval: bool):
        actions.append({
            "action_id": action_id,
            "name": name,
            "type": action_type,
            "priority": priority,
            "requires_approval": requires_approval,
            "status": "PROPOSED",
        })

    if prediction == "phishing":
        add(
            "INVESTIGATE_EVENT",
            "Open or update phishing investigation",
            "CASE_MANAGEMENT",
            "HIGH",
            True,
        )

        add(
            "SEARCH_RELATED_EVENTS",
            "Search for related URLs, domains, messages, and affected users",
            "THREAT_HUNT",
            "HIGH",
            False,
        )

        add(
            "BLOCK_DESTINATION",
            "Block or quarantine the URL/domain",
            "CONTAINMENT",
            "HIGH" if level != "CRITICAL" else "IMMEDIATE",
            True,
        )

    if any(item.get("name") == "Password field" for item in indicators):
        add(
            "ASSESS_CREDENTIAL_EXPOSURE",
            "Assess possible credential exposure",
            "IDENTITY_RESPONSE",
            "HIGH",
            True,
        )

    if level == "CRITICAL":
        add(
            "ESCALATE_SOC",
            "Escalate to SOC/security analyst",
            "ESCALATION",
            "IMMEDIATE",
            False,
        )

    if prediction == "legitimate" and not actions:
        add(
            "RETAIN_AUDIT_EVENT",
            "Retain analysis result for audit and monitoring",
            "AUDIT",
            "LOW",
            False,
        )

    return actions


def get_action_plan(
    risk_result: dict,
    recommendations: list[dict],
    playbook: dict,
) -> dict:
    """Return the complete proposed response action plan."""
    return {
        "mode": "RECOMMEND_ONLY",
        "actions": build_actions(risk_result, recommendations, playbook),
        "playbook_id": playbook.get("id"),
        "playbook_name": playbook.get("name"),
    }
