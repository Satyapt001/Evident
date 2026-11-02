"""CLI-friendly Model 3 prediction entry point."""
from __future__ import annotations

import argparse
import json

from .inference import predict_network_flow


def main() -> None:
    parser = argparse.ArgumentParser(description="CYBERGUARD Model 3 analyzer")
    parser.add_argument("--event", required=True, help="JSON behavioral event")
    args = parser.parse_args()

    event = json.loads(args.event)
    print(json.dumps(predict_network_flow(event), indent=2))


if __name__ == "__main__":
    main()
