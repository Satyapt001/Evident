import math
from typing import Any
from fastapi import APIRouter, HTTPException

from app.schemas.network_operations import BlockIPRequest, LockdownRequest
from app.services.network_operations import (
    active_sockets, add_block, build_test_vector, get_blocked_ips,
    lockdown_state, presets, remove_block, set_lockdown
)

router = APIRouter(prefix="/network", tags=["Network Operations"])

@router.get("/presets")
def get_presets():
    return {"presets": presets()}


@router.get("/preset/{preset_id}")
def get_preset(preset_id: str):
    allowed = {x["id"] for x in presets()}
    if preset_id not in allowed:
        raise HTTPException(status_code=404, detail="Unknown network test vector.")

    item = next(x for x in presets() if x["id"] == preset_id)
    flow = build_test_vector(preset_id)

    # JSON does not support NaN or Infinity.
    # Represent unavailable measurements as null in the API response.
    json_flow = {
        key: (value if math.isfinite(value) else None)
        for key, value in flow.items()
    }

    return {**item, "flow": json_flow}


@router.get("/blocked-ips")
def blocked_ips():
    return {"items": get_blocked_ips()}

@router.post("/blocked-ips")
def block_ip(payload: BlockIPRequest):
    try:
        return add_block(payload.ip_address, payload.severity, payload.reason, payload.source)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid IPv4/IPv6 address.")

@router.delete("/blocked-ips/{ip_address}")
def unblock_ip(ip_address: str):
    if not remove_block(ip_address):
        raise HTTPException(status_code=404, detail="IP is not currently blocked.")
    return {"status": "unblocked", "ip_address": ip_address}

@router.get("/lockdown")
def get_lockdown():
    return lockdown_state()

@router.post("/lockdown")
def universal_lockdown(payload: LockdownRequest):
    return set_lockdown(payload.enabled, payload.reason)

@router.get("/sockets")
def sockets():
    return {"items": active_sockets()}
