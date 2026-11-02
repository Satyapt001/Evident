from __future__ import annotations

import ipaddress
import platform
import socket
import subprocess
from datetime import datetime, timezone
from typing import Any

_BLOCKED: dict[str, dict[str, Any]] = {}
_LOCKDOWN = False

# These are representative rows from a public CICIDS2017-derived benchmark
# dataset. The model still performs the prediction; the labels are NOT used
# during inference. Missing columns in the compact benchmark view are derived
# from the corresponding flow statistics below.
_BENCHMARK_COLUMNS = [
    "Destination Port", "Flow Duration", "Total Fwd Packets", "Total Backward Packets",
    "Total Length of Fwd Packets", "Total Length of Bwd Packets", "Fwd Packet Length Max",
    "Fwd Packet Length Min", "Fwd Packet Length Mean", "Fwd Packet Length Std",
    "Bwd Packet Length Max", "Bwd Packet Length Min", "Bwd Packet Length Mean",
    "Bwd Packet Length Std", "Flow Bytes/s", "Flow Packets/s", "Flow IAT Mean",
    "Flow IAT Std", "Flow IAT Max", "Flow IAT Min", "Fwd IAT Mean", "Fwd IAT Std",
    "Fwd IAT Min", "Bwd IAT Total", "Bwd IAT Mean", "Bwd IAT Std", "Bwd IAT Max",
    "Bwd IAT Min", "Fwd PSH Flags", "Fwd URG Flags", "Fwd Header Length",
    "Bwd Header Length", "Fwd Packets/s", "Bwd Packets/s", "Min Packet Length",
    "Max Packet Length", "Packet Length Mean", "Packet Length Std", "Packet Length Variance",
    "FIN Flag Count", "RST Flag Count", "PSH Flag Count", "ACK Flag Count",
    "URG Flag Count", "ECE Flag Count", "Down/Up Ratio", "Init_Win_bytes_forward",
    "Init_Win_bytes_backward", "act_data_pkt_fwd", "min_seg_size_forward", "Active Mean",
    "Active Std", "Active Max", "Active Min", "Idle Mean", "Idle Std", "Idle Max", "Idle Min",
]

_BENCHMARK_ROWS: dict[str, list[float]] = {
    # Public CICIDS2017-derived sample labelled BENIGN.
    "normal": [
        443, 5229119, 9, 9, 394, 3204, 207, 0, 43.777779, 72.987633,
        1432, 0, 356, 576.9599, 688.070007, 3.442262, 307595.25, 1177536.75,
        4874558, 3, 653639.875, 1706130.875, 3, 250439, 31304.875, 57588.675781,
        133437, 3, 0, 0, 192, 192, 1.721131, 1.721131, 0, 1432, 189.368423,
        420.463013, 176789.140625, 0, 0, 1, 0, 0, 0, 1, 8192, 62, 8, 20,
        0, 0, 0, 0, 0, 0, 0, 0,
    ],
    # Public CICIDS2017-derived sample labelled PortScan.
    "port_scan": [
        109, 41, 1, 1, 0, 6, 0, 0, 0, 0, 6, 6, 6, 0,
        146341.46875, 48780.488281, 41, 0, 41, 41, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 40, 20, 24390.244141, 24390.244141, 0, 6, 2, 3.464102, 12,
        0, 0, 1, 0, 0, 0, 1, 29200, 0, 0, 40, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    # Public CICIDS2017-derived sample labelled DoS Hulk.
    "syn_flood": [
        80, 82728192, 6, 6, 369, 11595, 351, 0, 61.5, 141.855911,
        4344, 0, 1932.5, 2181.008301, 144.618164, 0.145053, 7520745,
        24900000, 82600000, 4, 16500000, 36900000, 4, 82700000, 16500000,
        36900000, 82600000, 65, 0, 0, 164, 200, 0.072527, 0.072527, 0,
        4344, 920.769226, 1714.960083, 2941088.25, 1, 0, 0, 0, 0, 0,
        1, 0, 235, 3, 20, 17984, 0, 17984, 17984, 82600000, 0, 82600000, 82600000,
    ],
    # Public CICIDS2017-derived sample labelled SSH-Patator, grouped by the
    # production family model as BRUTE_FORCE.
    "brute_force": [
        22, 14327322, 21, 32, 2008, 2745, 640, 0, 95.619049, 140.045166,
        976, 0, 85.78125, 220.240585, 331.743774, 3.699226, 275525.4375,
        772041.8125, 3531086, 3, 622885.875, 1136437.625, 348, 14300000,
        462167.25, 961376.5625, 3531086, 3, 0, 0, 680, 1032, 1.465731,
        2.233495, 0, 976, 88.018517, 189.590271, 35944.472656, 0, 0, 1,
        0, 0, 0, 1, 29200, 247, 16, 32, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
}

_PRESET_CONTEXT = {
    "normal": {
        "source_ip": "192.0.2.10",
        "destination_ip": "192.0.2.3",
        "description": "CICIDS2017-derived benign flow used as the normal benchmark baseline.",
    },
    "syn_flood": {
        "source_ip": "192.0.2.69",
        "destination_ip": "192.0.2.50",
        "description": "CICIDS2017-derived DoS Hulk flow; used as a controlled high-volume attack benchmark.",
    },
    "port_scan": {
        "source_ip": "192.0.2.45",
        "destination_ip": "192.0.2.50",
        "description": "CICIDS2017-derived PortScan flow used as a reconnaissance benchmark.",
    },
    "brute_force": {
        "source_ip": "192.0.2.22",
        "destination_ip": "192.0.2.50",
        "description": "CICIDS2017-derived SSH-Patator flow; Model 3 groups it under BRUTE_FORCE.",
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _artifact_columns() -> list[str]:
    from src.behavior.inference import load_model
    return list(load_model()["feature_columns"])


def _normalized(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())



def _expand_benchmark_row(values: list[float]) -> dict[str, float]:
    if len(values) != len(_BENCHMARK_COLUMNS):
        raise ValueError(
            "Internal Model 3 benchmark vector has an invalid feature count."
        )

    d = dict(zip(_BENCHMARK_COLUMNS, values))

    # Normalize known spelling variations in the benchmark schema.
    aliases = {
        "TotalLength of Bwd Packets": "Total Length of Bwd Packets",
        "TotalLength of Fwd Packets": "Total Length of Fwd Packets",
        "Total Lengthof Fwd Packets": "Total Length of Fwd Packets",
        "FwdPacket Length Mean": "Fwd Packet Length Mean",
        "Packet LengthStd": "Packet Length Std",
    }

    for old_name, correct_name in aliases.items():
        if old_name in d:
            value = d.pop(old_name)
            if correct_name not in d:
                d[correct_name] = value

    # Derive fields expected by the trained artifact.
    d["Fwd IAT Total"] = d["Flow Duration"]
    d["Fwd IAT Max"] = d["Flow IAT Max"]
    d["Fwd Header Length.1"] = d["Fwd Header Length"]
    d["Subflow Fwd Packets"] = d["Total Fwd Packets"]
    d["Subflow Fwd Bytes"] = d["Total Length of Fwd Packets"]
    d["Subflow Bwd Packets"] = d["Total Backward Packets"]
    d["Subflow Bwd Bytes"] = d["Total Length of Bwd Packets"]

    # Derive average packet/segment sizes where packet counts are available.
    total_packets = (
        d["Total Fwd Packets"] + d["Total Backward Packets"]
    )
    total_bytes = (
        d["Total Length of Fwd Packets"]
        + d["Total Length of Bwd Packets"]
    )

    d["Average Packet Size"] = (
        total_bytes / total_packets if total_packets else 0.0
    )
    d["Avg Fwd Segment Size"] = (
        d["Total Length of Fwd Packets"] / d["Total Fwd Packets"]
        if d["Total Fwd Packets"] else 0.0
    )
    d["Avg Bwd Segment Size"] = (
        d["Total Length of Bwd Packets"] / d["Total Backward Packets"]
        if d["Total Backward Packets"] else 0.0
    )

    # SYN count cannot be inferred reliably from packet totals.
    # Keep it explicitly marked as unavailable rather than fabricating it.
    # build_test_vector must not silently turn unavailable features into zero.
    d["SYN Flag Count"] = float("nan")

    return d



def build_test_vector(kind: str) -> dict[str, Any]:
    key = str(kind).lower()
    if key not in _BENCHMARK_ROWS:
        raise ValueError(f"Unknown network test vector: {kind}")

    values = _expand_benchmark_row(_BENCHMARK_ROWS[key])
    columns = _artifact_columns()

    missing = [column for column in columns if column not in values]
    if missing:
        raise ValueError(
            f"Incomplete benchmark vector '{key}'; "
            f"missing model features: {missing}"
        )

    return {column: float(values[column]) for column in columns}




def presets() -> list[dict[str, str]]:
    return [
        {
            "id": "normal",
            "label": "NORMAL TRAFFIC BASELINE",
            "description": _PRESET_CONTEXT["normal"]["description"],
        },
        {
            "id": "syn_flood",
            "label": "DOS / DDOS VECTOR",
            "description": _PRESET_CONTEXT["syn_flood"]["description"],
        },
        {
            "id": "port_scan",
            "label": "PORT SCAN VECTOR",
            "description": _PRESET_CONTEXT["port_scan"]["description"],
        },
        {
            "id": "brute_force",
            "label": "BRUTE FORCE VECTOR",
            "description": _PRESET_CONTEXT["brute_force"]["description"],
        },
    ]


def preset_context(preset_id: str) -> dict[str, str]:
    if preset_id not in _PRESET_CONTEXT:
        raise ValueError(f"Unknown network test vector: {preset_id}")
    return dict(_PRESET_CONTEXT[preset_id])


def get_blocked_ips() -> list[dict[str, Any]]:
    return list(_BLOCKED.values())


def add_block(
    ip: str,
    severity: str,
    reason: str,
    source: str = "ADMINISTRATOR",
) -> dict[str, Any]:
    address = str(ip).strip()
    ipaddress.ip_address(address)
    item = {
        "ip_address": address,
        "severity": str(severity).upper(),
        "reason": str(reason).strip() or "Administrator security block",
        "source": source,
        "packets_dropped": 0,
        "blocked_at": _now(),
        "status": "BLOCKED",
        "enforcement_mode": "SIMULATED",
    }
    _BLOCKED[address] = item
    return item


def remove_block(ip: str) -> bool:
    address = str(ip).strip()
    try:
        ipaddress.ip_address(address)
    except ValueError:
        return False
    return _BLOCKED.pop(address, None) is not None


def set_lockdown(enabled: bool, reason: str = "Universal enterprise lockdown") -> dict[str, Any]:
    global _LOCKDOWN
    _LOCKDOWN = bool(enabled)
    return {
        "enabled": _LOCKDOWN,
        "mode": "SIMULATED",
        "reason": reason,
        "changed_at": _now(),
        "message": "Application-level containment ledger updated. OS firewall rules are not changed by the prototype.",
    }


def lockdown_state() -> dict[str, Any]:
    return {"enabled": _LOCKDOWN, "mode": "SIMULATED"}


def active_sockets() -> list[dict[str, Any]]:
    try:
        import psutil

        rows = []
        for c in psutil.net_connections(kind="inet"):
            local = f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "-"
            remote = f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "-"
            process = "-"
            if c.pid:
                try:
                    process = psutil.Process(c.pid).name()
                except Exception:
                    process = "PID " + str(c.pid)
            rows.append({
                "proto": "TCP" if c.type == socket.SOCK_STREAM else "UDP",
                "local_address": local,
                "remote_address": remote,
                "status": c.status or "-",
                "pid": c.pid or "-",
                "process": process,
            })
        return rows
    except Exception:
        if platform.system().lower().startswith("win"):
            try:
                output = subprocess.check_output(
                    ["netstat", "-ano"],
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=5,
                )
                rows = []
                for line in output.splitlines():
                    parts = line.split()
                    if len(parts) >= 4 and parts[0].upper() in {"TCP", "UDP"}:
                        if parts[0].upper() == "TCP" and len(parts) >= 5:
                            rows.append({
                                "proto": parts[0],
                                "local_address": parts[1],
                                "remote_address": parts[2],
                                "status": parts[3],
                                "pid": parts[4],
                                "process": "PID " + parts[4],
                            })
                        elif parts[0].upper() == "UDP":
                            rows.append({
                                "proto": parts[0],
                                "local_address": parts[1],
                                "remote_address": parts[2],
                                "status": "LISTENING",
                                "pid": parts[-1],
                                "process": "PID " + parts[-1],
                            })
                return rows
            except Exception as exc:
                return [{"proto": "-", "local_address": "-", "remote_address": "-", "status": "UNAVAILABLE", "pid": "-", "process": str(exc)}]
        return [{"proto": "-", "local_address": "-", "remote_address": "-", "status": "UNAVAILABLE", "pid": "-", "process": "Socket enumeration unavailable"}]
