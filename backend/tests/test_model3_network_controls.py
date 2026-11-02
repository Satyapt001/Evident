import warnings

warnings.filterwarnings("ignore")

from app.services.action_service import available_actions, execute_action
from app.services.behavior_model3 import analyze_network_flow
from app.services.incident_store import record_event
from app.services.network_operations import build_test_vector, get_blocked_ips, remove_block, presets
from src.behavior.inference import predict_network_flow


def test_benchmark_vectors_produce_distinct_model_results():
    results = {item["id"]: predict_network_flow(build_test_vector(item["id"])) for item in presets()}

    assert results["normal"]["prediction"] == "BENIGN"
    assert results["port_scan"]["attack_family"] == "PORT_SCAN"
    assert results["syn_flood"]["attack_family"] == "DOS_DDOS"
    assert results["brute_force"]["attack_family"] == "BRUTE_FORCE"


def test_network_analysis_preserves_request_id_for_action_controls():
    result = analyze_network_flow(
        build_test_vector("port_scan"),
        request_id="network-action-test",
        source_ip="192.0.2.45",
        destination_ip="192.0.2.50",
        destination_port=109,
    )
    assert result["request_id"] == "network-action-test"
    assert result["model"]["attack_family"] == "PORT_SCAN"
    assert result["context"]["source_ip"] == "192.0.2.45"


def test_network_action_can_block_detected_source_ip():
    record_event({
        "request_id": "network-block-test",
        "prediction": "ATTACK",
        "threat_type": "PORT_SCAN",
        "risk_score": 99.0,
        "risk_level": "CRITICAL",
        "source": "network_model3",
        "metadata": {"source_ip": "192.0.2.45"},
    })

    actions = available_actions({
        "request_id": "network-block-test",
        "prediction": "ATTACK",
        "threat_type": "PORT_SCAN",
        "risk_score": 99.0,
        "risk_level": "CRITICAL",
        "source": "network_model3",
        "metadata": {"source_ip": "192.0.2.45"},
    })
    assert any(a["action_id"] == "BLOCK_SOURCE_IP" for a in actions)

    result = execute_action("network-block-test", "BLOCK_SOURCE_IP", True, "Approved for prototype demo", "SOC Analyst")
    assert result["status"] == "EXECUTED"
    assert any(x["ip_address"] == "192.0.2.45" for x in get_blocked_ips())
    assert remove_block("192.0.2.45") is True
