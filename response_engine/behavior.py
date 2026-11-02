"""Non-destructive response recommendations for Model 3 network threats."""


def recommendations(category: str, risk_level: str) -> list[str]:
    category = str(category).upper()
    risk_level = str(risk_level).upper()

    rec = [
        "Preserve the network-flow evidence and associated telemetry.",
        "Notify the SOC/security administrator when the event requires investigation.",
    ]

    if risk_level in {"HIGH", "CRITICAL"}:
        rec.append("Investigate the source and destination endpoints before containment.")

    if category == "BRUTE_FORCE":
        rec.append("Review authentication logs and consider rate limiting or account protection.")
    elif category == "PORT_SCAN":
        rec.append("Review source IP activity and inspect the targeted services.")
    elif category == "DOS_DDOS":
        rec.append("Review traffic volume and consider approved DDoS mitigation controls.")
    elif category == "WEB_ATTACK":
        rec.append("Review affected web/API services and WAF logs.")
    elif category in {"INFILTRATION", "BOTNET", "HEARTBLEED"}:
        rec.append("Escalate for host and network forensics.")

    return rec


def build_behavior_response(threat_type: str, risk_level: str) -> dict:
    category = str(threat_type).upper()
    severity = str(risk_level).upper()
    rec = recommendations(category, severity)

    return {
        "mode": "RECOMMENDATION_ONLY",
        "recommendations": rec,
        "playbook": {
            "name": "NETWORK_THREAT_INVESTIGATION",
            "description": (
                "Investigate the detected behavioral or network threat, "
                "correlate related telemetry, and preserve evidence."
            ),
        },
        "actions": [
            {
                "action": item,
                "type": "RECOMMENDATION",
                "destructive": False,
            }
            for item in rec
        ],
    }
