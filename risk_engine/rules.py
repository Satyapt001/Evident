"""Deterministic phishing-risk rules for CYBERGUARD Model 1."""

RULE_WEIGHTS = {
    "IsDomainIP": 12,
    "HasObfuscation": 10,
    "high_obfuscation": 8,
    "many_subdomains": 6,
    "redirects": 6,
    "HasExternalFormSubmit": 12,
    "HasPasswordField": 8,
    "HasHiddenFields": 5,
    "NoOfPopup": 4,
    "NoOfiFrame": 3,
    "Bank": 5,
    "Pay": 5,
    "Crypto": 5,
    "no_https": 8,
}

THRESHOLDS = {
    "ObfuscationRatio": 0.05,
    "NoOfSubDomain": 3,
    "NoOfURLRedirect": 2,
}


def evaluate_rules(features: dict) -> list[dict]:
    """Return only the risk indicators actually triggered."""
    indicators = []

    def add(name: str, reason: str, points: int):
        indicators.append({
            "name": name,
            "reason": reason,
            "points": points,
        })

    if features.get("IsDomainIP", 0):
        add(
            "IP-based domain",
            "The URL uses an IP address instead of a conventional domain.",
            RULE_WEIGHTS["IsDomainIP"],
        )

    if features.get("HasObfuscation", 0):
        add(
            "URL obfuscation",
            "Encoded or obfuscated URL characters were detected.",
            RULE_WEIGHTS["HasObfuscation"],
        )

    if float(features.get("ObfuscationRatio", 0)) >= THRESHOLDS["ObfuscationRatio"]:
        add(
            "High obfuscation ratio",
            "The URL contains a significant proportion of obfuscated characters.",
            RULE_WEIGHTS["high_obfuscation"],
        )

    if int(features.get("NoOfSubDomain", 0)) >= THRESHOLDS["NoOfSubDomain"]:
        add(
            "Multiple subdomains",
            f"The URL contains {int(features.get('NoOfSubDomain', 0))} subdomains.",
            RULE_WEIGHTS["many_subdomains"],
        )

    if int(features.get("NoOfURLRedirect", 0)) >= THRESHOLDS["NoOfURLRedirect"]:
        add(
            "Multiple redirects",
            f"The request followed {int(features.get('NoOfURLRedirect', 0))} redirects.",
            RULE_WEIGHTS["redirects"],
        )

    if features.get("HasExternalFormSubmit", 0):
        add(
            "External form submission",
            "A form submits data to a different host.",
            RULE_WEIGHTS["HasExternalFormSubmit"],
        )

    if features.get("HasPasswordField", 0):
        add(
            "Password field",
            "A password input was detected.",
            RULE_WEIGHTS["HasPasswordField"],
        )

    if features.get("HasHiddenFields", 0):
        add(
            "Hidden fields",
            "Hidden form inputs were detected.",
            RULE_WEIGHTS["HasHiddenFields"],
        )

    if features.get("NoOfPopup", 0):
        add(
            "Popup behavior",
            "Popup-related JavaScript behavior was detected.",
            RULE_WEIGHTS["NoOfPopup"],
        )

    if features.get("NoOfiFrame", 0):
        add(
            "Embedded iframe",
            "The webpage contains an iframe.",
            RULE_WEIGHTS["NoOfiFrame"],
        )

    if features.get("Bank", 0):
        add(
            "Banking indicator",
            "Banking-related content was detected.",
            RULE_WEIGHTS["Bank"],
        )

    if features.get("Pay", 0):
        add(
            "Payment indicator",
            "Payment-related content was detected.",
            RULE_WEIGHTS["Pay"],
        )

    if features.get("Crypto", 0):
        add(
            "Cryptocurrency indicator",
            "Cryptocurrency-related content was detected.",
            RULE_WEIGHTS["Crypto"],
        )

    if not features.get("IsHTTPS", 0):
        add(
            "No HTTPS",
            "The URL does not use HTTPS.",
            RULE_WEIGHTS["no_https"],
        )

    return indicators
