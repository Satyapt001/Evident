"""Prototype SOC administration/control plane.

Actions are intentionally application-level and non-destructive: firewall rules and
lockdown state are maintained by the EVIDENT control plane and are not written to the
host operating system firewall. This keeps the hackathon prototype safe and portable.
"""
from __future__ import annotations
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from pathlib import Path
import json
import hashlib
import math
import mimetypes
import os
import platform
import psutil

_lock = Lock()
_lockdown = False
_rules: dict[str, dict[str, Any]] = {}
_prev_net = None
_prev_time = None


def _now(): return datetime.now(timezone.utc).isoformat()

def status():
    with _lock:
        return {"lockdown": _lockdown, "enforcement_mode": "SIMULATED", "blocked_ips": list(_rules.values()), "updated_at": _now()}

def set_lockdown(active: bool):
    global _lockdown
    with _lock: _lockdown = active
    return status()

def firewall_rules():
    with _lock: return list(_rules.values())

def block_ip(ip: str, severity: str, reason: str):
    global _rules
    if _lockdown:
        raise RuntimeError("Universal lockdown is active; new firewall rules are temporarily gated.")
    # Lightweight validation without changing the host firewall.
    import ipaddress
    ipaddress.ip_address(ip)
    rule = {"ip": ip, "severity": severity.upper(), "reason": reason.strip() or "Manual administrator security block", "source": "AI/ADMIN CONTROL PLANE", "packets_dropped": 0, "created_at": _now()}
    with _lock: _rules[ip] = rule
    return rule

def unblock_ip(ip: str):
    with _lock: return {"removed": _rules.pop(ip, None) is not None}

def simulate(vector: str):
    """Run a controlled vector through the real Model 3 production artifact.

    This endpoint does not generate external traffic. It submits a deterministic
    CIC-IDS feature vector to the same inference path used by /analyze/network.
    """
    if _lockdown:
        raise RuntimeError("Universal lockdown is active; network simulation is disabled.")

    scenarios_path = Path(__file__).resolve().parents[3] / "configs" / "network_demo_vectors.json"
    if not scenarios_path.is_file():
        raise FileNotFoundError(f"Missing Model 3 demo vectors: {scenarios_path}")

    scenarios = json.loads(scenarios_path.read_text(encoding="utf-8"))
    if vector not in scenarios:
        raise ValueError(f"Unknown simulation vector: {vector}")

    from src.behavior.inference import predict_network_flow
    from risk_engine.behavior import score_behavior_prediction
    from response_engine.behavior import recommendations

    model = predict_network_flow(scenarios[vector])
    prediction = {
        "attack_probability": model["attack_probability"],
        "attack_category": model.get("attack_family", "OTHER_ATTACK"),
    }
    risk = score_behavior_prediction(prediction)
    category = prediction["attack_category"]
    if category == "BENIGN":
        category = "NORMAL"

    source_ips = {
        "normal": "192.0.2.10",
        "syn_flood": "198.51.100.24",
        "port_scan": "203.0.113.45",
        "brute_force": "192.0.2.142",
        "botnet": "198.51.100.88",
    }

    return {
        "simulation": vector,
        "source_ip": source_ips.get(vector, "192.0.2.10"),
        "threat_type": category,
        "risk_score": risk["risk_score"],
        "risk_level": risk["risk_level"],
        "confidence": model["attack_probability"],
        "mitigation": recommendations(category, risk["risk_level"])[-1],
        "indicators": risk["indicators"] or ["Model 3 evaluated the supplied flow as benign."],
        "model": model,
        "risk": risk,
        "response": {
            "mode": "RECOMMENDATION_ONLY",
            "recommendations": recommendations(category, risk["risk_level"]),
        },
    }

def telemetry():
    global _prev_net, _prev_time
    now = __import__('time').monotonic()
    net = psutil.net_io_counters()
    rx = tx = pps = 0.0
    if _prev_net is not None and _prev_time is not None:
        dt = max(now - _prev_time, 0.001)
        rx = (net.bytes_recv - _prev_net.bytes_recv) * 8 / dt / 1_000_000
        tx = (net.bytes_sent - _prev_net.bytes_sent) * 8 / dt / 1_000_000
        pps = ((net.packets_recv - _prev_net.packets_recv) + (net.packets_sent - _prev_net.packets_sent)) / dt
    _prev_net, _prev_time = net, now
    mem = psutil.virtual_memory(); disk = psutil.disk_usage(os.path.abspath(os.sep)); freq = psutil.cpu_freq()
    return {"hostname": platform.node(), "platform": f"{platform.system()} {platform.release()}", "cpu_percent": psutil.cpu_percent(interval=0.05), "cpu_count": psutil.cpu_count() or 0, "cpu_frequency_mhz": freq.current if freq else None, "memory_percent": mem.percent, "memory_used_mb": mem.used/1048576, "memory_total_mb": mem.total/1048576, "disk_percent": disk.percent, "disk_used_gb": disk.used/1e9, "disk_total_gb": disk.total/1e9, "network_rx_mbps": max(0.0, rx), "network_tx_mbps": max(0.0, tx), "packets_per_sec": max(0.0, pps), "processes": len(psutil.pids()), "generated_at": _now()}

def malware_triage(data: bytes, filename: str):
    if not data: raise ValueError("Empty file")
    if len(data) > 25 * 1024 * 1024: raise ValueError("File exceeds 25 MB prototype limit")
    sha = hashlib.sha256(data).hexdigest(); size=len(data); mime=mimetypes.guess_type(filename)[0] or "application/octet-stream"
    freq=[0]*256
    for b in data: freq[b]+=1
    entropy=-sum((n/size)*math.log2(n/size) for n in freq if n)
    is_pe=data[:2]==b'MZ'
    ext=os.path.splitext(filename)[1].lower()
    indicators=[]; score=0.0
    if is_pe: indicators.append({"name":"PE executable header","reason":"File begins with the Windows MZ executable signature.","points":55}); score+=55
    if ext in {'.exe','.dll','.scr','.msi','.bat','.cmd','.ps1','.vbs','.js'}: indicators.append({"name":"Executable/script extension","reason":f"Filename uses a high-risk executable or script extension: {ext}.","points":20}); score+=20
    if entropy >= 7.2: indicators.append({"name":"High byte entropy","reason":f"Measured Shannon entropy is {entropy:.2f}, consistent with compressed or packed content.","points":20}); score+=20
    if ext in {'.jpg','.jpeg','.png','.pdf','.docx'} and is_pe: indicators.append({"name":"Type mismatch","reason":"Filename extension does not match the detected PE header.","points":25}); score+=25
    score=min(100.0,score); level='CRITICAL' if score>=80 else 'HIGH' if score>=60 else 'MEDIUM' if score>=40 else 'LOW' if score>=20 else 'SAFE'
    return {"file":{"size_bytes":size,"sha256":sha,"mime_type":mime,"entropy":round(entropy,4),"is_pe":is_pe},"risk":{"risk_score":round(score,2),"risk_level":level,"indicators":indicators},"response":{"mode":"RECOMMENDATION_ONLY","recommendations":["Preserve the original file and SHA-256 hash.","Do not execute the submitted artifact.","Submit high-risk artifacts to an isolated malware sandbox for deeper analysis.","Correlate the hash with approved threat-intelligence sources."]}}
