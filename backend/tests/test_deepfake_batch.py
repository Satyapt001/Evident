import io
import pytest
from PIL import Image
from src.deepfake.risk import calculate_deepfake_risk, build_probability_indicator
from src.deepfake.validation import validate_image_bytes, ImageValidationError


def png_bytes():
    b = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(b, "PNG")
    return b.getvalue()


def test_model_probability_is_not_double_counted():
    r = calculate_deepfake_risk(0.9991341233253479)
    assert r["model_score"] == 99.91
    assert r["evidence_score"] == 0.0
    assert r["risk_score"] == 79.93
    assert r["risk_level"] == "HIGH"


def test_independent_evidence_can_raise_critical():
    r = calculate_deepfake_risk(0.9991341233253479, [{"name": "independent", "points": 100}])
    assert r["evidence_score"] == 100.0
    assert r["risk_score"] == 99.93
    assert r["risk_level"] == "CRITICAL"


def test_real_probability_is_safe():
    r = calculate_deepfake_risk(0.008113917894661427)
    assert r["model_score"] == 0.81
    assert r["evidence_score"] == 0.0
    assert r["risk_score"] == 0.65
    assert r["risk_level"] == "SAFE"


def test_probability_indicator():
    x = build_probability_indicator(0.9991341233253479)
    assert x["name"] == "High deepfake probability"
    assert "99.91%" in x["reason"]
    assert x["points"] == 99.91
    assert build_probability_indicator(0.008113917894661427) == {}


def test_valid_png():
    r = validate_image_bytes(png_bytes(), "sample.png", "image/png")
    assert r["format"] == "PNG"
    assert r["width"] == 64

@pytest.mark.parametrize("name,mime", [("x.gif","image/gif"),("x.txt","text/plain"),("x.exe","application/octet-stream")])
def test_unsupported_format(name, mime):
    with pytest.raises(ImageValidationError):
        validate_image_bytes(png_bytes(), name, mime)


def test_empty():
    with pytest.raises(ImageValidationError):
        validate_image_bytes(b"", "x.png", "image/png")


def test_corrupt():
    with pytest.raises(ImageValidationError):
        validate_image_bytes(b"not-an-image", "x.png", "image/png")


def test_size_limit():
    with pytest.raises(ImageValidationError):
        validate_image_bytes(b"x" * 1025, "x.png", "image/png", max_bytes=1024)
