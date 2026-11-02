"""CYBERGUARD severity classification."""

def get_severity(risk_score: float) -> str:
    score = float(risk_score)

    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    if score >= 20:
        return "LOW"
    return "SAFE"


def get_severity_description(severity: str) -> str:
    descriptions = {
        "SAFE": "No significant phishing risk identified.",
        "LOW": "Limited suspicious indicators detected.",
        "MEDIUM": "Suspicious characteristics require caution.",
        "HIGH": "Strong phishing indicators detected.",
        "CRITICAL": "Very strong indicators of a potential phishing attempt.",
    }

    return descriptions.get(severity, "Unknown severity.")
