from pathlib import Path

from app.services import deepfake_case_store


def test_deepfake_actions_are_admin_controlled(tmp_path, monkeypatch):
    root = tmp_path / "deepfake"
    monkeypatch.setattr(deepfake_case_store, "_ROOT", root)
    monkeypatch.setattr(deepfake_case_store, "_STAGING", root / "staging")
    monkeypatch.setattr(deepfake_case_store, "_EVIDENCE", root / "evidence")
    monkeypatch.setattr(deepfake_case_store, "_QUARANTINE", root / "quarantine")
    monkeypatch.setattr(deepfake_case_store, "_CASES", root / "cases")

    source = tmp_path / "sample.png"
    source.write_bytes(b"real-test-media")
    case = deepfake_case_store.create_case(
        "case-1", source, "sample.png", {"risk_score": 95, "risk_level": "CRITICAL", "prediction": "MANIPULATED"}
    )
    assert Path(case["staged_path"]).is_file()
    actions = deepfake_case_store.available_actions("case-1")
    assert any(x["action_id"] == "QUARANTINE_MEDIA" and x["requires_approval"] for x in actions)

    blocked = deepfake_case_store.execute_action("case-1", "QUARANTINE_MEDIA", False, "", "Analyst")
    assert blocked["status"] == "APPROVAL_REQUIRED"

    executed = deepfake_case_store.execute_action("case-1", "QUARANTINE_MEDIA", True, "Approved", "Analyst")
    assert executed["status"] == "EXECUTED"
    final = deepfake_case_store.get_case("case-1")
    assert Path(final["quarantine_path"]).is_file()
    assert final["status"] == "CONTAINED"


def test_probability_output_is_model_derived(monkeypatch, tmp_path):
    from app.services import deepfake_service

    model = tmp_path / "clip.pth"
    model.write_bytes(b"checkpoint")
    image = tmp_path / "x.png"
    image.write_bytes(b"not-an-image")

    monkeypatch.setattr(deepfake_service, "_prepare_torch_runtime", lambda: None)
    monkeypatch.setattr(deepfake_service, "_image_metadata", lambda _: {
        "format": "PNG", "width": 100, "height": 100, "color_mode": "RGB", "size_bytes": 12, "sha256": "abc"
    })

    import sys, types
    fake = types.SimpleNamespace(predict_image=lambda _: {
        "model": "DeepGuard Media Authenticity Engine",
        "technical_model": "DF40 CLIP ViT-B/16",
        "predicted_class": 1,
        "predicted_label": "MANIPULATED",
        "class_probabilities": [0.08, 0.92],
        "class_1_probability": 0.92,
        "confidence": 0.92,
        "probability_margin": 0.84,
        "prediction_entropy": 0.27,
        "logits": [-1.0, 1.0],
        "device": "cpu",
    })
    monkeypatch.setitem(sys.modules, "src.deepfake.predict", fake)
    result = deepfake_service.DeepfakeAnalysisService(str(model)).analyze(image)
    assert result["model"]["class_1_probability"] == 0.92
    assert result["model"]["predicted_label"] == "MANIPULATED"
    assert result["media"]["sha256"] == "abc"
