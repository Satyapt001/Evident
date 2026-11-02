from __future__ import annotations
import platform, socket, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import psutil
from fastapi import APIRouter

router = APIRouter(prefix="/telemetry", tags=["System Telemetry"])
_previous_net: dict[str, float] | None = None
_previous_net_at: float | None = None

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def safe_float(value: Any) -> float | None:
    try: return round(float(value), 2) if value is not None else None
    except (TypeError, ValueError): return None

def collect_connections(warnings: list[str]) -> dict[str, Any]:
    items, listening = [], []
    try: connections = psutil.net_connections(kind="inet")
    except (psutil.AccessDenied, PermissionError, OSError) as exc:
        warnings.append(f"Connection enumeration unavailable (permissions may be required): {exc}")
        return {"items": [], "listening": [], "available": False, "total_observed": 0}
    for conn in connections:
        la, ra = conn.laddr, conn.raddr
        try: process_name = psutil.Process(conn.pid).name() if conn.pid else None
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError, OSError): process_name = None
        row = {"family": str(conn.family), "type": "TCP" if conn.type == socket.SOCK_STREAM else "UDP" if conn.type == socket.SOCK_DGRAM else str(conn.type),
               "local_ip": getattr(la, "ip", None) if la else None, "local_port": getattr(la, "port", None) if la else None,
               "remote_ip": getattr(ra, "ip", None) if ra else None, "remote_port": getattr(ra, "port", None) if ra else None,
               "status": conn.status or ("BOUND" if la and not ra else "UNKNOWN"), "pid": conn.pid, "process_name": process_name}
        if conn.status == psutil.CONN_LISTEN: listening.append(row)
        if len(items) < 250: items.append(row)
    return {"items": items, "listening": listening[:150], "available": True, "truncated": len(connections) > 250, "total_observed": len(connections)}

def collect_processes(warnings: list[str]) -> list[dict[str, Any]]:
    rows = []
    try:
        for proc in psutil.process_iter(attrs=["pid", "name", "username", "memory_info", "cpu_percent", "status", "exe"]):
            try:
                info = proc.info; mem = info.get("memory_info")
                rows.append({"pid": info.get("pid"), "name": info.get("name") or "Unknown", "username": info.get("username"),
                    "status": info.get("status"), "cpu_percent": safe_float(info.get("cpu_percent")) or 0,
                    "memory_bytes": int(mem.rss) if mem else None, "executable": info.get("exe")})
            except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError): continue
    except (psutil.Error, OSError) as exc: warnings.append(f"Process inventory partially unavailable: {exc}")
    rows.sort(key=lambda x: (x["cpu_percent"], x["memory_bytes"] or 0), reverse=True)
    return rows[:30]

def collect_network() -> dict[str, Any]:
    global _previous_net, _previous_net_at
    c = psutil.net_io_counters()
    current = {"bytes_sent": c.bytes_sent, "bytes_recv": c.bytes_recv, "packets_sent": c.packets_sent,
               "packets_recv": c.packets_recv, "errin": c.errin, "errout": c.errout, "dropin": c.dropin, "dropout": c.dropout}
    stamp = time.monotonic(); elapsed = max(stamp - _previous_net_at, .001) if _previous_net_at is not None else None
    if _previous_net is not None and elapsed:
        sent = max(0, (current["bytes_sent"] - _previous_net["bytes_sent"]) / elapsed)
        recv = max(0, (current["bytes_recv"] - _previous_net["bytes_recv"]) / elapsed)
        packets = max(0, (current["packets_sent"] + current["packets_recv"] - _previous_net["packets_sent"] - _previous_net["packets_recv"]) / elapsed)
    else: sent = recv = packets = None
    _previous_net, _previous_net_at = current, stamp
    return {**current, "bytes_sent_per_sec": round(sent, 2) if sent is not None else None,
            "bytes_recv_per_sec": round(recv, 2) if recv is not None else None,
            "packets_per_sec": round(packets, 2) if packets is not None else None, "rate_available": elapsed is not None}

@router.get("/health")
def telemetry_health() -> dict[str, Any]:
    return {"status": "ok", "collector": "psutil", "host": socket.gethostname(), "timestamp": now()}

@router.get("/overview")
def telemetry_overview() -> dict[str, Any]:
    warnings: list[str] = []
    try:
        freq = psutil.cpu_freq()
        cpu = {"percent": psutil.cpu_percent(interval=.1), "per_core_percent": psutil.cpu_percent(interval=None, percpu=True),
               "logical_cores": psutil.cpu_count(logical=True), "physical_cores": psutil.cpu_count(logical=False),
               "frequency_mhz": safe_float(freq.current) if freq else None}
    except (psutil.Error, OSError) as exc:
        warnings.append(f"CPU telemetry unavailable: {exc}"); cpu = {"percent": None, "per_core_percent": [], "logical_cores": None, "physical_cores": None, "frequency_mhz": None}
    try:
        vm, sw = psutil.virtual_memory(), psutil.swap_memory()
        memory = {"ram_total_bytes": vm.total, "ram_used_bytes": vm.used, "ram_available_bytes": vm.available, "ram_percent": vm.percent,
                  "swap_total_bytes": sw.total, "swap_used_bytes": sw.used, "swap_percent": sw.percent}
    except (psutil.Error, OSError) as exc: warnings.append(f"Memory telemetry unavailable: {exc}"); memory = {}
    try:
        usage = psutil.disk_usage(Path.cwd().anchor or "/"); dio = psutil.disk_io_counters()
        disk = {"path": Path.cwd().anchor or "/", "total_bytes": usage.total, "used_bytes": usage.used, "free_bytes": usage.free,
                "percent": usage.percent, "read_bytes": dio.read_bytes if dio else None, "write_bytes": dio.write_bytes if dio else None,
                "read_count": dio.read_count if dio else None, "write_count": dio.write_count if dio else None}
    except (psutil.Error, OSError, PermissionError) as exc: warnings.append(f"Disk telemetry unavailable: {exc}"); disk = {}
    try: network = collect_network()
    except (psutil.Error, OSError) as exc: warnings.append(f"Network counters unavailable: {exc}"); network = {}
    connections, processes = collect_connections(warnings), collect_processes(warnings)
    return {"host": {"hostname": socket.gethostname(), "platform": platform.platform(), "system": platform.system(),
            "release": platform.release(), "python_version": platform.python_version(), "timestamp": now()},
            "cpu": cpu, "memory": memory, "disk": disk, "network": network, "connections": connections,
            "processes": processes, "warnings": warnings, "partial": bool(warnings)}
