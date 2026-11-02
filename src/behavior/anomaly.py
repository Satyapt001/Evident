"""Lightweight behavioral anomaly scoring.

This module intentionally uses deterministic thresholds so Model 3 remains
explainable and operational without requiring a trained checkpoint.
"""
from __future__ import annotations

from typing import Any


def calculate_anomaly_score(event: dict[str, Any]) -> float:
    score = 0.0

    if event["failed_logins"] >= 5:
        score += min(25.0, event["failed_logins"] * 2.5)

    if event["requests_per_minute"] >= 60:
        score += min(25.0, event["requests_per_minute"] / 4.0)

    if event["new_device"]:
        score += 15.0

    if event["unusual_location"]:
        score += 15.0

    if event["unusual_time"]:
        score += 5.0

    if event["privilege_change"]:
        score += 15.0

    if event["failed_requests"] >= 10:
        score += min(15.0, event["failed_requests"] * 0.75)

    return round(min(score, 100.0), 2)
