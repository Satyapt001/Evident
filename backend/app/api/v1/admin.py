from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.admin_control import block_ip, firewall_rules, malware_triage, set_lockdown, simulate, status, telemetry, unblock_ip

router = APIRouter(prefix="/admin", tags=["SOC Administration"])

class BlockRequest(BaseModel):
    ip: str
    severity: str = Field(default="HIGH")
    reason: str = Field(default="Manual administrator security block")
class UnblockRequest(BaseModel): ip: str
class SimulationRequest(BaseModel): vector: str

@router.get('/status')
def get_status(): return status()
@router.post('/lockdown')
def lockdown(): return set_lockdown(True)
@router.post('/unlock')
def unlock(): return set_lockdown(False)
@router.get('/firewall')
def firewall(): return firewall_rules()
@router.post('/firewall/block')
def block(req: BlockRequest):
    try:
        return block_ip(req.ip, req.severity, req.reason)
    except RuntimeError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
@router.post('/firewall/unblock')
def unblock(req: UnblockRequest): return unblock_ip(req.ip)
@router.post('/network/simulate')
def network_simulation(req: SimulationRequest):
    try: return simulate(req.vector)
    except RuntimeError as exc: raise HTTPException(status_code=423, detail=str(exc)) from exc
    except FileNotFoundError as exc: raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc: raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc: raise HTTPException(status_code=500, detail=f"Model 3 simulation failed: {exc}") from exc
@router.get('/telemetry')
def host_telemetry(): return telemetry()
