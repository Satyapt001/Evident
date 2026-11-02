from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

URL_RE = re.compile(r"https?://[^\s<>'\"]+", re.I)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b")

RULES = [
    ("Urgency / Time Pressure", "URGENCY", 15,
     ["urgent", "immediately", "act now", "within 24 hours", "final warning", "as soon as possible"]),
    ("Threat / Fear Language", "THREAT", 15,
     ["account will be locked", "account suspended", "legal action", "unauthorized", "security violation", "will be closed", "suspended"]),
    ("Credential / Identity Verification", "CREDENTIAL_HARVESTING", 20,
     ["verify your identity", "verify your account", "confirm your identity", "enter your password", "enter your otp", "security code", "login to verify", "sign in to verify"]),
    ("Financial Manipulation", "FINANCIAL", 10,
     ["transaction", "payment", "refund", "invoice", "bank account", "wire transfer", "card payment"]),
    ("Impersonation / Authority Claim", "IMPERSONATION", 15,
     ["bank security", "security team", "it administrator", "microsoft support", "ceo", "hr department", "account security"]),
    ("Attachment / Executable Lure", "ATTACHMENT_LURE", 10,
     ["invoice.exe", "document.exe", ".scr", ".js attachment", ".zip attachment", "attached invoice", "open the attachment"]),
]


def _clean_url(url: str) -> str:
    return url.rstrip(".,;:!?)]}")


def extract_entities(sender: str, subject: str, body: str) -> dict[str, list[str]]:
    text = f"{subject}\n{body}"
    urls: list[str] = []
    for raw in URL_RE.findall(text):
        value = _clean_url(raw)
        if value not in urls:
            urls.append(value)

    domains: list[str] = []
    ips: list[str] = []
    for url in urls:
        host = urlparse(url).hostname or ""
        if host and host not in domains:
            domains.append(host)
        if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", host) and host not in ips:
            ips.append(host)

    for match in IP_RE.findall(text):
        ip = match.split(":", 1)[0]
        if ip not in ips:
            ips.append(ip)

    emails: list[str] = []
    for raw in [sender] + EMAIL_RE.findall(text):
        value = raw.strip()
        if value and value.lower() not in {x.lower() for x in emails}:
            emails.append(value)

    return {
        "urls": urls,
        "domains": domains,
        "ip_addresses": ips,
        "email_addresses": emails,
    }


def analyze_social_signals(sender: str, subject: str, body: str):
    text = f"{sender}\n{subject}\n{body}".lower()
    indicators: list[dict[str, Any]] = []
    seen: set[str] = set()

    for name, category, points, phrases in RULES:
        hits = [p for p in phrases if p in text]
        if hits and category not in seen:
            seen.add(category)
            indicators.append({
                "name": name,
                "category": category,
                "reason": f"Detected social-engineering language associated with {category.lower().replace('_', ' ')}.",
                "points": float(points),
                "evidence": ", ".join(hits[:3]),
            })

    return min(sum(x["points"] for x in indicators), 85.0), indicators


def _severity(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    if score >= 20:
        return "LOW"
    return "SAFE"


def _recommendations(level: str, has_urls: bool):
    if level in {"HIGH", "CRITICAL"}:
        result = [
            {"priority": "CRITICAL", "action": "Quarantine the email and prevent further user interaction.", "reason": "Strong social-engineering indicators were detected."},
            {"priority": "HIGH", "action": "Verify the sender through an independent trusted channel.", "reason": "The message contains authority, urgency, or identity-manipulation signals."},
            {"priority": "HIGH", "action": "Preserve the email, headers, URLs and analysis evidence.", "reason": "Evidence should be retained before containment or deletion."},
        ]
        if has_urls:
            result.append({
                "priority": "HIGH",
                "action": "Review and block malicious extracted URLs/domains if confirmed.",
                "reason": "The email contains URLs analyzed by the existing Model 1 phishing detector.",
            })
        return result

    if level == "MEDIUM":
        return [
            {"priority": "MEDIUM", "action": "Require manual analyst review before user interaction.", "reason": "Multiple suspicious social-engineering signals were detected."},
            {"priority": "MEDIUM", "action": "Verify the sender independently and inspect extracted URLs.", "reason": "The message contains potentially deceptive content."},
        ]

    return [{"priority": "LOW", "action": "Retain the analysis for audit and monitoring.", "reason": "No strong social-engineering risk was established."}]


def analyze_email(*, sender: str, subject: str, body: str, request_id: str, analyze_urls: bool = True):
    entities = extract_entities(sender, subject, body)
    social_score, indicators = analyze_social_signals(sender, subject, body)

    url_results: list[dict[str, Any]] = []

    if analyze_urls and entities["urls"]:
        # Reuse Model 1 only for URLs found in the email.
        from app.core.config import get_settings
        from app.services.phishing_service import PhishingAnalysisService

        settings = get_settings()
        service = PhishingAnalysisService(
            model_path=settings.model_path,
            metadata_path=settings.metadata_path,
        )

        for url in entities["urls"][:5]:
            try:
                result = service.analyze(url=url, fetch_page=False, timeout=min(settings.max_fetch_timeout, 8))
                risk = result["risk"]
                ti = result.get("threat_intelligence", {})
                url_results.append({
                    "url": url,
                    "prediction": result["model"].get("prediction", "UNKNOWN"),
                    "phishing_probability": float(risk.get("phishing_probability", 0.0)),
                    "risk_score": float(risk.get("risk_score", 0.0)),
                    "risk_level": risk.get("risk_level", "SAFE"),
                    "threat_intelligence_matches": int(ti.get("positive_sources", 0)),
                })
            except Exception as exc:
                url_results.append({
                    "url": url,
                    "prediction": "UNAVAILABLE",
                    "phishing_probability": None,
                    "risk_score": None,
                    "risk_level": "UNKNOWN",
                    "threat_intelligence_matches": 0,
                    "error": str(exc),
                })

    available_url_risks = [
        float(item["risk_score"])
        for item in url_results
        if item.get("risk_score") is not None
        and item.get("risk_level") != "UNKNOWN"
    ]
    max_url_risk = max(available_url_risks, default=0.0)
    final_score = min(100.0, social_score * 0.55 + max_url_risk * 0.45) if url_results else social_score
    level = _severity(final_score)

    verdict = (
        "PHISHING / SOCIAL ENGINEERING"
        if level in {"HIGH", "CRITICAL"}
        else "SUSPICIOUS EMAIL"
        if level in {"MEDIUM", "LOW"}
        else "LIKELY LEGITIMATE"
    )

    confidence = None

    if level in {"HIGH", "CRITICAL"}:
        verdict = "PHISHING / SOCIAL ENGINEERING"
        explanation = (
            "Strong social-engineering indicators were detected. "
            "Review the evidence and any URL-analysis results."
        )
    elif level in {"LOW", "MEDIUM"}:
        verdict = "SUSPICIOUS EMAIL"
        explanation = (
            "Potential social-engineering indicators were detected. "
            "Manual analyst review is recommended."
        )
    else:
        verdict = "NO INDICATORS DETECTED"
        explanation = (
            "No configured social-engineering indicators were detected. "
            "This does not prove that the email is legitimate."
        )

    from app.services.incident_store import record_event

    stored = record_event({
        "request_id": request_id,
        "threat_type": "PHISHING",
        "risk_score": round(final_score, 2),
        "risk_level": level,
        "confidence": confidence,
        "prediction": verdict,
        "explanation": explanation,
        "indicators": indicators,
        "source": "social_engineering_email",
        "metadata_source": "social_engineering_email",
        "email_analysis": True,
        "metadata": {
            "sender": sender,
            "subject": subject,
            "url": entities["urls"][0] if entities["urls"] else "",
            "urls": entities["urls"],
            "domains": entities["domains"],
            "ip_addresses": entities["ip_addresses"],
            "email_addresses": entities["email_addresses"],
            "social_engineering_score": social_score,
            "url_results": url_results,
        },
    })

    return {
        "request_id": request_id,
        "incident_id": stored["event_id"],
        "risk_score": round(final_score, 2),
        "risk_level": level,
        "verdict": verdict,
        "confidence": confidence,
        "social_engineering_score": round(social_score, 2),
        "explanation": explanation,
        "indicators": indicators,
        "entities": entities,
        "url_results": url_results,
        "recommendations": _recommendations(level, bool(url_results)),
    }

