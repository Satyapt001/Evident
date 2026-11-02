"""CYBERGUARD phishing incident playbooks.

Playbooks describe the recommended investigation/response sequence.
They do not execute security controls.
"""

from __future__ import annotations


PLAYBOOKS = {
    "PHISHING_INVESTIGATION": {
        "name": "Phishing Investigation",
        "objective": "Validate the phishing event, identify affected users, and contain exposure.",
        "steps": [
            "Preserve the analyzed URL, model result, risk score, and evidence.",
            "Identify the source communication containing the URL.",
            "Search for the same domain or URL across relevant messages and alerts.",
            "Determine whether users clicked the URL.",
            "Determine whether credentials or sensitive information were submitted.",
            "Block or quarantine confirmed malicious infrastructure through authorized controls.",
            "Reset affected credentials when compromise is suspected.",
            "Review authentication activity for suspicious follow-on behavior.",
            "Close the incident only after evidence and containment actions are documented.",
        ],
    },
    "CREDENTIAL_EXPOSURE": {
        "name": "Credential Exposure Response",
        "objective": "Respond when a phishing page may have collected credentials.",
        "steps": [
            "Determine whether a password was submitted.",
            "Identify the affected account.",
            "Reset the affected credential through the organization's approved process.",
            "Revoke active sessions where appropriate.",
            "Review recent authentication events for anomalous activity.",
            "Escalate to account-takeover investigation if suspicious activity is found.",
        ],
    },
    "CRITICAL_PHISHING": {
        "name": "Critical Phishing Containment",
        "objective": "Rapidly contain a high-confidence, high-impact phishing event.",
        "steps": [
            "Escalate to the SOC/security analyst immediately.",
            "Block or quarantine the URL/domain using authorized controls.",
            "Search for affected users and related communications.",
            "Assess credential or sensitive-data exposure.",
            "Investigate authentication activity for affected accounts.",
            "Record evidence and response actions for incident tracking.",
        ],
    },
}


def select_playbook(risk_result: dict) -> dict:
    """Select the most appropriate playbook from a Risk Engine result."""
    prediction = str(risk_result.get("prediction", "legitimate")).lower()
    level = str(risk_result.get("risk_level", "SAFE")).upper()
    indicators = risk_result.get("indicators", [])

    if prediction != "phishing":
        return {
            "id": "NO_INCIDENT",
            "name": "No Phishing Incident",
            "objective": "No phishing response playbook is required based on the current result.",
            "steps": [],
        }

    password_exposure = any(
        item.get("name") == "Password field" for item in indicators
    )

    if password_exposure:
        selected = PLAYBOOKS["CREDENTIAL_EXPOSURE"].copy()
        selected["id"] = "CREDENTIAL_EXPOSURE"
        return selected

    if level == "CRITICAL":
        selected = PLAYBOOKS["CRITICAL_PHISHING"].copy()
        selected["id"] = "CRITICAL_PHISHING"
        return selected

    selected = PLAYBOOKS["PHISHING_INVESTIGATION"].copy()
    selected["id"] = "PHISHING_INVESTIGATION"
    return selected
