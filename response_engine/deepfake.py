"""Deterministic response recommendations for deepfake detections."""

from __future__ import annotations

from typing import Any


def generate_deepfake_response(risk_result: dict[str, Any]) -> dict[str, Any]:
    level = str(risk_result.get("risk_level", "SAFE")).upper()

    if level == "CRITICAL":
        recommendations = [
            "Flag the multimedia for immediate manual verification.",
            "Do not use the media as an authoritative source until verified.",
            "Report the suspected impersonation or manipulated media.",
            "Notify the security administrator or SOC.",
            "Escalate the incident for investigation.",
            "Preserve the submitted media and analysis evidence for audit.",
        ]
        playbook = "CRITICAL_DEEPFAKE_INVESTIGATION"

    elif level == "HIGH":
        recommendations = [
            "Flag the multimedia for manual verification.",
            "Verify the claimed identity through an independent trusted channel.",
            "Report suspected impersonation if identity misuse is confirmed.",
            "Notify the security administrator or SOC.",
            "Preserve the submitted media and analysis evidence.",
        ]
        playbook = "DEEPFAKE_INVESTIGATION"

    elif level == "MEDIUM":
        recommendations = [
            "Perform additional manual verification of the media.",
            "Verify the source and claimed identity independently.",
            "Avoid relying on the media for sensitive decisions until verified.",
            "Preserve the media and analysis result for review.",
        ]
        playbook = "MEDIA_VERIFICATION"

    elif level == "LOW":
        recommendations = [
            "Treat the media with caution.",
            "Verify the source if the media is being used for a sensitive decision.",
            "Retain the analysis result if further investigation becomes necessary.",
        ]
        playbook = "MEDIA_VERIFICATION"

    else:
        recommendations = [
            "No immediate response action is recommended.",
            "Continue normal verification practices for sensitive multimedia.",
        ]
        playbook = "NO_INCIDENT"

    return {
        "mode": "RECOMMENDATION_ONLY",
        "recommendations": recommendations,
        "playbook": {
            "name": playbook,
            "description": _playbook_description(playbook),
        },
        "actions": [
            {
                "action": item,
                "type": "RECOMMENDATION",
                "destructive": False,
            }
            for item in recommendations
        ],
    }


def _playbook_description(playbook: str) -> str:
    descriptions = {
        "CRITICAL_DEEPFAKE_INVESTIGATION": (
            "Escalate high-confidence suspected deepfake or impersonation "
            "content for immediate human verification and SOC investigation."
        ),
        "DEEPFAKE_INVESTIGATION": (
            "Review suspected manipulated media, verify identity independently, "
            "and preserve evidence."
        ),
        "MEDIA_VERIFICATION": (
            "Perform additional verification before relying on suspicious media."
        ),
        "NO_INCIDENT": (
            "No incident response is required based on the current result."
        ),
    }

    return descriptions[playbook]