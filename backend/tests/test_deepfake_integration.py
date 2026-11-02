from app.services import deepfake_service


def test_service_uses_model_probability_without_double_counting(monkeypatch, tmp_path):
    model = tmp_path / "clip.pth"
    model.write_bytes(b"checkpoint")

    monkeypatch.setattr(deepfake_service, "predict_image", lambda _: {
        "model": "DF40 CLIP ViT-B/16",
        "predicted_class": 1,
        "class_probabilities": [0.0008658767, 0.9991341233],
        "class_1_probability": 0.9991341233,
    })
    service = deepfake_service.DeepfakeAnalysisService(str(model))
    result = service.analyze(tmp_path / "x.png")

    assert result["risk"]["risk_score"] == 79.93
    assert result["risk"]["risk_level"] == "HIGH"
    assert result["risk"]["evidence_score"] == 0.0
    assert result["response"]["mode"] == "RECOMMENDATION_ONLY"
