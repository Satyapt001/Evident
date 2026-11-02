"""CYBERGUARD shared adapter for DeepGuard deepfake risk scoring."""
from src.deepfake.risk import calculate_deepfake_risk, build_probability_indicator

__all__ = ["calculate_deepfake_risk", "build_probability_indicator"]
