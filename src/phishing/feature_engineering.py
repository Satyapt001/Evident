"""PhiUSIIL-compatible phishing feature extraction.

The model was trained on 50 numeric features from PhiUSIIL.
URL-only features are calculated locally. Page-level features require an
HTTP fetch and HTML parsing.

IMPORTANT:
PhiUSIIL's URLSimilarityIndex, TLDLegitimateProb and URLCharProb are
derived features whose original reference distributions are not published
as a simple runtime formula. This implementation uses conservative
runtime approximations for those three fields. They should be replaced
with the exact reference implementation before treating external metrics
as production-grade.
"""

from __future__ import annotations

import html
import ipaddress
import math
import re
from collections import Counter
from difflib import SequenceMatcher
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup


FEATURES = [
    "URLLength", "DomainLength", "IsDomainIP", "URLSimilarityIndex",
    "CharContinuationRate", "TLDLegitimateProb", "URLCharProb",
    "TLDLength", "NoOfSubDomain", "HasObfuscation",
    "NoOfObfuscatedChar", "ObfuscationRatio", "NoOfLettersInURL",
    "LetterRatioInURL", "NoOfDegitsInURL", "DegitRatioInURL",
    "NoOfEqualsInURL", "NoOfQMarkInURL", "NoOfAmpersandInURL",
    "NoOfOtherSpecialCharsInURL", "SpacialCharRatioInURL", "IsHTTPS",
    "LineOfCode", "LargestLineLength", "HasTitle",
    "DomainTitleMatchScore", "URLTitleMatchScore", "HasFavicon",
    "Robots", "IsResponsive", "NoOfURLRedirect", "NoOfSelfRedirect",
    "HasDescription", "NoOfPopup", "NoOfiFrame",
    "HasExternalFormSubmit", "HasSocialNet", "HasSubmitButton",
    "HasHiddenFields", "HasPasswordField", "Bank", "Pay", "Crypto",
    "HasCopyrightInfo", "NoOfImage", "NoOfCSS", "NoOfJS",
    "NoOfSelfRef", "NoOfEmptyRef", "NoOfExternalRef",
]

DEFAULT_TIMEOUT = 8

# Common TLD prior used only as a runtime approximation.
COMMON_TLD_PROB = {
    "com": 0.95, "org": 0.92, "net": 0.90, "edu": 0.98, "gov": 0.99,
    "mil": 0.98, "in": 0.90, "uk": 0.91, "de": 0.91, "fr": 0.90,
    "io": 0.80, "co": 0.78, "ai": 0.78, "app": 0.78, "dev": 0.75,
    "xyz": 0.35, "top": 0.30, "click": 0.25, "shop": 0.55,
    "online": 0.40, "site": 0.42, "info": 0.50,
}


def _safe_hostname(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def _is_ip(host: str) -> int:
    try:
        ipaddress.ip_address(host)
        return 1
    except ValueError:
        return 0


def _tld(host: str) -> str:
    parts = host.split(".")
    return parts[-1] if len(parts) > 1 else ""


def _continuation_rate(url: str) -> float:
    if not url:
        return 0.0
    groups = re.findall(r"[A-Za-z]+|\d+|[^A-Za-z\d]+", url)
    longest = max((len(g) for g in groups), default=0)
    return longest / len(url)


def _obfuscation(url: str) -> tuple[int, int, float]:
    encoded = re.findall(r"%[0-9A-Fa-f]{2}", url)
    hex_like = re.findall(r"(?:0x[0-9A-Fa-f]+|\\x[0-9A-Fa-f]{2})", url)
    count = len(encoded) + len(hex_like)
    return int(count > 0), count, count / max(len(url), 1)


def _url_char_probability(url: str) -> float:
    """Runtime proxy for URLCharProb; not the original PhiUSIIL lookup."""
    if not url:
        return 0.0

    chars = [c.lower() for c in url if c.isalnum()]
    if not chars:
        return 0.0

    freq = Counter(chars)
    n = len(chars)
    entropy = -sum((v / n) * math.log2(v / n) for v in freq.values())
    # Normalize entropy into a stable [0, 1] heuristic.
    return min(entropy / 5.0, 1.0)


def _similarity_proxy(host: str, title: str) -> float:
    """Runtime proxy for URLSimilarityIndex."""
    if not host:
        return 0.0
    domain_tokens = re.sub(r"[^a-z0-9]", " ", host).split()
    title_tokens = re.sub(r"[^a-z0-9]", " ", title.lower()).split()
    if not domain_tokens or not title_tokens:
        return 0.0
    return 100.0 * max(
        SequenceMatcher(None, token, title_tokens[0]).ratio()
        for token in domain_tokens
    )


def _text_flags(text: str) -> tuple[int, int, int]:
    lower = text.lower()
    bank = int(bool(re.search(r"\b(bank|banking|account number|iban)\b", lower)))
    pay = int(bool(re.search(r"\b(pay|payment|checkout|card number|credit card)\b", lower)))
    crypto = int(bool(re.search(r"\b(bitcoin|crypto|ethereum|wallet)\b", lower)))
    return bank, pay, crypto


def _externality(base_host: str, href: str) -> str:
    try:
        target = urlsplit(href)
        if not target.netloc:
            return "self"
        return "self" if (target.hostname or "").lower() == base_host else "external"
    except Exception:
        return "empty"


def _fetch(url: str, timeout: int = DEFAULT_TIMEOUT):
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/154 Safari/537.36"
        )
    }
    response = requests.get(
        url,
        headers=headers,
        timeout=timeout,
        allow_redirects=True,
        verify=True,
    )
    response.raise_for_status()
    return response


def extract_features(url: str, fetch_page: bool = True, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Return exactly the 50 features expected by phishing_model.pkl."""
    from .preprocessing import validate_url

    url = validate_url(url)
    parsed = urlsplit(url)
    host = _safe_hostname(url)
    tld = _tld(host)
    path_query = parsed.path + ("?" + parsed.query if parsed.query else "")

    letters = sum(c.isalpha() for c in url)
    digits = sum(c.isdigit() for c in url)
    specials = sum(not c.isalnum() for c in url)
    other_specials = sum(c in ";:@._~%/-" for c in url)

    has_obf, obf_count, obf_ratio = _obfuscation(url)

    features = {
        "URLLength": len(url),
        "DomainLength": len(host),
        "IsDomainIP": _is_ip(host),
        "URLSimilarityIndex": 0.0,
        "CharContinuationRate": _continuation_rate(url),
        "TLDLegitimateProb": COMMON_TLD_PROB.get(tld, 0.50),
        "URLCharProb": _url_char_probability(url),
        "TLDLength": len(tld),
        "NoOfSubDomain": max(len(host.split(".")) - 2, 0),
        "HasObfuscation": has_obf,
        "NoOfObfuscatedChar": obf_count,
        "ObfuscationRatio": obf_ratio,
        "NoOfLettersInURL": letters,
        "LetterRatioInURL": letters / max(len(url), 1),
        "NoOfDegitsInURL": digits,
        "DegitRatioInURL": digits / max(len(url), 1),
        "NoOfEqualsInURL": url.count("="),
        "NoOfQMarkInURL": url.count("?"),
        "NoOfAmpersandInURL": url.count("&"),
        "NoOfOtherSpecialCharsInURL": other_specials,
        "SpacialCharRatioInURL": specials / max(len(url), 1),
        "IsHTTPS": int(parsed.scheme.lower() == "https"),
    }

    # Defaults for page-derived features.
    page_defaults = {
        "LineOfCode": 0, "LargestLineLength": 0, "HasTitle": 0,
        "DomainTitleMatchScore": 0.0, "URLTitleMatchScore": 0.0,
        "HasFavicon": 0, "Robots": 0, "IsResponsive": 0,
        "NoOfURLRedirect": 0, "NoOfSelfRedirect": 0, "HasDescription": 0,
        "NoOfPopup": 0, "NoOfiFrame": 0, "HasExternalFormSubmit": 0,
        "HasSocialNet": 0, "HasSubmitButton": 0, "HasHiddenFields": 0,
        "HasPasswordField": 0, "Bank": 0, "Pay": 0, "Crypto": 0,
        "HasCopyrightInfo": 0, "NoOfImage": 0, "NoOfCSS": 0, "NoOfJS": 0,
        "NoOfSelfRef": 0, "NoOfEmptyRef": 0, "NoOfExternalRef": 0,
    }
    features.update(page_defaults)

    if not fetch_page:
        features["URLSimilarityIndex"] = _similarity_proxy(host, "")
        return {k: features[k] for k in FEATURES}

    response = _fetch(url, timeout=timeout)
    final_url = response.url
    final_host = _safe_hostname(final_url)
    html_text = response.text or ""
    soup = BeautifulSoup(html_text, "html.parser")

    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    title_lower = title.lower()
    host_words = re.sub(r"[^a-z0-9]", " ", host).split()
    title_words = re.sub(r"[^a-z0-9]", " ", title_lower).split()

    features["URLSimilarityIndex"] = _similarity_proxy(host, title)
    features["LineOfCode"] = len(html_text.splitlines())
    features["LargestLineLength"] = max(
        (len(line) for line in html_text.splitlines()), default=0
    )
    features["HasTitle"] = int(bool(title))

    domain_text = " ".join(host_words)
    title_text = " ".join(title_words)
    features["DomainTitleMatchScore"] = 100.0 * SequenceMatcher(
        None, domain_text, title_text
    ).ratio() if title_text else 0.0
    features["URLTitleMatchScore"] = 100.0 * SequenceMatcher(
        None, re.sub(r"[^a-z0-9]", " ", path_query.lower()), title_text
    ).ratio() if title_text else 0.0

    features["HasFavicon"] = int(bool(
        soup.find("link", rel=lambda x: x and "icon" in str(x).lower())
    ))
    features["Robots"] = int(bool(soup.find(string=re.compile("robots", re.I))))
    features["IsResponsive"] = int(bool(
        soup.find("meta", attrs={"name": re.compile("^viewport$", re.I)})
    ))

    # Redirect counts are based on the requests redirect history.
    history = response.history
    features["NoOfURLRedirect"] = len(history)
    features["NoOfSelfRedirect"] = sum(
        _safe_hostname(h.url) == _safe_hostname(h.headers.get("Location", ""))
        for h in history if h.headers.get("Location")
    )

    features["HasDescription"] = int(bool(
        soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
    ))
    features["NoOfPopup"] = len(
        re.findall(r"(window\.open|alert\s*\(|onbeforeunload|onclick\s*=)", html_text, re.I)
    )
    features["NoOfiFrame"] = len(soup.find_all("iframe"))

    forms = soup.find_all("form")
    features["HasExternalFormSubmit"] = 0
    features["HasSubmitButton"] = int(bool(
        soup.find("input", attrs={"type": re.compile("^submit$", re.I)}) or
        soup.find("button", attrs={"type": re.compile("^submit$", re.I)})
    ))
    features["HasHiddenFields"] = int(bool(
        soup.find("input", attrs={"type": re.compile("^hidden$", re.I)})
    ))
    features["HasPasswordField"] = int(bool(
        soup.find("input", attrs={"type": re.compile("^password$", re.I)})
    ))

    self_ref = empty_ref = external_ref = 0
    social = 0
    social_domains = (
        "facebook.com", "instagram.com", "twitter.com", "x.com",
        "linkedin.com", "youtube.com", "tiktok.com",
    )

    for form in forms:
        action = form.get("action", "")
        if action:
            target = urljoin(final_url, action)
            if _safe_hostname(target) != final_host:
                features["HasExternalFormSubmit"] = 1

    for a in soup.find_all("a", href=True):
        href = html.unescape(a["href"].strip())
        if not href:
            empty_ref += 1
            continue
        if href in {"#", "javascript:void(0)", "javascript:;"}:
            empty_ref += 1
            continue

        kind = _externality(final_host, urljoin(final_url, href))
        if kind == "self":
            self_ref += 1
        elif kind == "external":
            external_ref += 1

        if any(domain in href.lower() for domain in social_domains):
            social = 1

    features["HasSocialNet"] = social
    features["NoOfSelfRef"] = self_ref
    features["NoOfEmptyRef"] = empty_ref
    features["NoOfExternalRef"] = external_ref

    text = soup.get_text(" ", strip=True)
    features["Bank"], features["Pay"], features["Crypto"] = _text_flags(text)
    features["HasCopyrightInfo"] = int(
        bool(re.search(r"(©|copyright)", text, re.I))
    )
    features["NoOfImage"] = len(soup.find_all("img"))
    features["NoOfCSS"] = len(soup.find_all("link", href=True, rel=lambda x: x and "stylesheet" in str(x).lower()))
    features["NoOfJS"] = len(soup.find_all("script"))

    return {k: features[k] for k in FEATURES}
