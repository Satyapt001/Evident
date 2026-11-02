"""CYBERGUARD response recommendations for phishing incidents.

This module is deterministic and consumes the existing Risk Engine output.
It does not perform destructive actions.
"""

from __future__ import annotations


def _has_indicator(indicators: list[dict], name: str) -> bool:
    return any(item.get("name") == name for item in indicators)


def generate_recommendations(risk_result: dict) -> list[dict]:
    """Generate prioritized analyst recommendations."""
    level = str(risk_result.get("risk_level", "SAFE")).upper()
    prediction = str(risk_result.get("prediction", "legitimate")).lower()
    indicators = risk_result.get("indicators", [])

    recommendations = []

    def add(priority: str, action: str, reason: str):
        recommendations.append({
            "priority": priority,
            "action": action,
            "reason": reason,
        })

    if prediction == "phishing":
        add(
            "IMMEDIATE",
            "Do not enter credentials, payment information, or sensitive data.",
            "The phishing model classified the URL as phishing.",
        )

        add(
            "HIGH",
            "Block or quarantine the URL/domain at the appropriate security control.",
            "Prevent additional users or systems from reaching a potentially malicious destination.",
        )

        add(
            "HIGH",
            "Search for related emails, messages, or alerts containing the same URL or domain.",
            "This can identify additional potentially affected users.",
        )

    if _has_indicator(indicators, "Password field"):
        add(
            "HIGH",
            "Review whether credentials were submitted to the analyzed site.",
            "A password input was detected.",
        )

    if _has_indicator(indicators, "External form submission"):
        add(
            "HIGH",
            "Inspect the form destination and consider blocking the destination domain.",
            "The page submits form data to a different host.",
        )

    if _has_indicator(indicators, "IP-based domain"):
        add(
            "MEDIUM",
            "Treat the destination as suspicious and investigate the hosting infrastructure.",
            "The URL uses an IP address instead of a conventional hostname.",
        )

    if _has_indicator(indicators, "URL obfuscation") or _has_indicator(
        indicators, "High obfuscation ratio"
    ):
        add(
            "MEDIUM",
            "Inspect the URL for encoded or deceptive components before allowing access.",
            "Obfuscation indicators were detected.",
        )

    if _has_indicator(indicators, "Multiple redirects"):
        add(
            "MEDIUM",
            "Review the redirect chain and identify the final destination.",
            "Multiple redirects can conceal the final destination.",
        )

    if level == "CRITICAL":
        add(
            "IMMEDIATE",
            "Create or escalate a security incident for analyst investigation.",
            "The calculated risk level is CRITICAL.",
        )
    elif level == "HIGH":
        add(
            "HIGH",
            "Prioritize the event for SOC analyst review.",
            "The calculated risk level is HIGH.",
        )
    elif level == "MEDIUM":
        add(
            "MEDIUM",
            "Queue the event for security review and additional context gathering.",
            "The calculated risk level is MEDIUM.",
        )
    elif level in {"LOW", "SAFE"} and prediction == "legitimate":
        add(
            "LOW",
            "No immediate containment action is recommended; retain the event for audit context.",
            "The model currently classifies the URL as legitimate.",
        )

    # Deduplicate while preserving order.
    unique = []
    seen = set()
    for item in recommendations:
        key = (item["priority"], item["action"])
        if key not in seen:
            seen.add(key)
            unique.append(item)

    return unique
