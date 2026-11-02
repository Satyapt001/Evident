from __future__ import annotations

import os
import platform
import socket
import time
from datetime import datetime, timezone
from typing import Any

import psutil
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/telemetry", tags=["System Telemetry"])
_last_net_sample: tuple[float, int, int] | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _network_rates() -> dict[str, float | None]:
    global _last_net_sample
    counters = psutil.net_io_counters()
    if counters is None:
        return {"receive_bytes_per_sec": None, "send_bytes_per_sec": None}
    now = time.monotonic()
    current = (now, int(counters.bytes_recv), int(counters.bytes_sent))
    previous = _last_net_sample
    _last_net_sample = current
    if previous is None:
        return {"receive_bytes_per_sec": None, "send_bytes_per_sec": None}
    elapsed = now - previous[0]
    if elapsed <= 0:
        return {"receive_bytes_per_sec": None, "send_bytes_per_sec": None}
    return {
        "receive_bytes_per_sec": round(max(0, current[1] - previous[1]) / elapsed, 2),
        "send_bytes_per_sec": round(max(0, current[2] - previous[2]) / elapsed, 2),
    }


def _process_name(pid: int | None) -> str | None:
    if pid is None:
        return None
    try:
        return psutil.Process(pid).name()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, OSError):
        return None


@router.get("/summary")
def get_telemetry_summary() -> dict[str, Any]:
    try:
        cpu_percent = psutil.cpu_percent(interval=None)
        per_cpu = psutil.cpu_percent(interval=None, percpu=True)
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        disk = psutil.disk_usage(os.path.abspath(os.sep))
        net = psutil.net_io_counters()
        frequency = psutil.cpu_freq()
        return {
            "collected_at": _now(),
            "host": socket.gethostname(),
            "platform": platform.platform(),
            "uptime_seconds": max(0, int(time.time() - psutil.boot_time())),
            "cpu": {
                "percent": cpu_percent,
                "logical_cores": psutil.cpu_count(logical=True) or 0,
                "physical_cores": psutil.cpu_count(logical=False),
                "per_core_percent": per_cpu,
                "frequency_mhz": round(frequency.current, 1) if frequency else None,
            },
            "memory": {
                "total_bytes": memory.total, "available_bytes": memory.available,
                "used_bytes": memory.used, "percent": memory.percent,
                "swap_total_bytes": swap.total, "swap_used_bytes": swap.used,
                "swap_percent": swap.percent,
            },
            "disk": {
                "mount": os.path.abspath(os.sep), "total_bytes": disk.total,
                "used_bytes": disk.used, "free_bytes": disk.free, "percent": disk.percent,
            },
            "network": {
                "bytes_received_total": int(net.bytes_recv) if net else None,
                "bytes_sent_total": int(net.bytes_sent) if net else None,
                "packets_received_total": int(net.packets_recv) if net else None,
                "packets_sent_total": int(net.packets_sent) if net else None,
                **_network_rates(),
            },
        }
    except (psutil.Error, OSError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=f"Host telemetry collection failed: {exc}") from exc


@router.get("/connections")
def get_network_connections(limit: int = Query(default=100, ge=1, le=500)) -> dict[str, Any]:
    try:
        connections = psutil.net_connections(kind="inet")
    except (psutil.AccessDenied, OSError, psutil.Error) as exc:
        raise HTTPException(status_code=503, detail=f"Connection inventory unavailable; OS permissions may be required: {exc}") from exc
    rows = []
    for conn in connections:
        local, remote, pid = conn.laddr, conn.raddr, conn.pid
        rows.append({
            "family": "IPv6" if conn.family == socket.AF_INET6 else "IPv4",
            "type": "TCP" if conn.type == socket.SOCK_STREAM else "UDP",
            "local_address": getattr(local, "ip", None) if local else None,
            "local_port": getattr(local, "port", None) if local else None,
            "remote_address": getattr(remote, "ip", None) if remote else None,
            "remote_port": getattr(remote, "port", None) if remote else None,
            "status": conn.status or ("BOUND" if local and not remote else "UNKNOWN"),
            "pid": pid, "process": _process_name(pid),
            "is_listening": conn.status == psutil.CONN_LISTEN,
        })
    rows.sort(key=lambda item: (not item["is_listening"], item["local_port"] or 0))
    return {"collected_at": _now(), "count": len(rows), "returned": min(len(rows), limit),
            "connections": rows[:limit],
            "note": "OS permissions can limit visible connections and process/PID details."}


@router.get("/processes")
def get_processes(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    rows = []
    for proc in psutil.process_iter(attrs=["pid", "name", "username", "status", "memory_info", "cpu_percent", "create_time"]):
        try:
            info = proc.info
            mem = info.get("memory_info")
            created = info.get("create_time")
            rows.append({
                "pid": info.get("pid"), "name": info.get("name"),
                "username": info.get("username"), "status": info.get("status"),
                "memory_rss_bytes": getattr(mem, "rss", None) if mem else None,
                "cpu_percent": info.get("cpu_percent"),
                "created_at": datetime.fromtimestamp(created, timezone.utc).isoformat() if created else None,
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, OSError):
            continue
    rows.sort(key=lambda item: item["memory_rss_bytes"] or 0, reverse=True)
    return {"collected_at": _now(), "count": len(rows), "returned": min(len(rows), limit),
            "processes": rows[:limit],
            "note": "Command-line arguments and environment variables are intentionally not collected."}


@router.post("/sysmon/events", status_code=201)
def ingest_sysmon_event(payload: dict[str, Any]) -> dict[str, Any]:
    """Accept a normalized Sysmon Event ID 3 from the local Windows collector."""
    from app.services.sysmon_events import normalize_sysmon_event, persist_sysmon_event
    try:
        event = normalize_sysmon_event(payload)
        stored = persist_sysmon_event(event)
        return {"stored": True, "classification_status": "NOT_EVALUATED", "event": stored}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail=f"Sysmon event persistence failed: {exc}") from exc


@router.get("/sysmon/events")
def get_sysmon_events(limit: int = Query(default=100, ge=1, le=1000)) -> dict[str, Any]:
    """Return persisted Sysmon events, newest first."""
    from app.services.sysmon_events import list_sysmon_events
    events = list_sysmon_events(limit)
    return {"count": len(events), "events": events, "source": "windows_sysmon", "persistent": True}
