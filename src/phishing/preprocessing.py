"""Input validation and normalization for phishing inference."""

from urllib.parse import urlsplit


def normalize_url(url: str) -> str:
    """Normalize a URL without contacting the destination."""
    if not isinstance(url, str):
        raise TypeError("URL must be a string.")

    url = url.strip().strip("\"'")

    if not url:
        raise ValueError("URL cannot be empty.")

    if not urlsplit(url).scheme:
        url = "https://" + url

    parsed = urlsplit(url)

    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("Only HTTP and HTTPS URLs are supported.")

    if not parsed.netloc:
        raise ValueError("Invalid URL: missing hostname.")

    return url


def validate_url(url: str) -> str:
    """Validate and return a normalized URL."""
    return normalize_url(url)
