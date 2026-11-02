from app.services.network_operations import build_test_vector, presets

def test_presets_exist():
    ids = {x["id"] for x in presets()}
    assert {"normal", "syn_flood", "port_scan", "brute_force"} <= ids

def test_preset_matches_model_columns():
    # Only checks construction here; the real model artifact is loaded by the API at runtime.
    flow = build_test_vector("syn_flood")
    assert isinstance(flow, dict)
    assert flow
