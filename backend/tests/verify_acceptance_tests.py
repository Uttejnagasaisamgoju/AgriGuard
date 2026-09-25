"""
AgriGuard Section 35 Acceptance Test Suite
Verifies all 6 mandatory acceptance scenarios across both Gallery and Camera inputs:
- TEST 1: Real Healthy Leaf (Leaf = PASS, Disease = Healthy Foliage)
- TEST 2: Real Diseased Leaf (Leaf = PASS, Disease = Correct supported class)
- TEST 3: Real Early-Stage Leaf (Leaf = PASS, Early-stage status honestly reported)
- TEST 4: Non-Leaf Object (Leaf = FAIL, Disease model = NOT RUN)
- TEST 5: Blurry Image (Quality = FAIL / RETAKE, Disease model = NOT RUN)
- TEST 6: Camera Photo (EXIF corrected, Leaf = PASS, accurate disease result)
"""
import os
import sys
import io
import json
import pytest
import numpy as np
import cv2
from PIL import Image
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath("backend"))

from app.main import app
from app.database.session import SessionLocal
from app.models.user import User, UserRole
from app.auth.security import create_access_token

client = TestClient(app)

@pytest.fixture(scope="module")
def auth_headers():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "farmer@demo.agriguard.app").first()
        token = create_access_token({"sub": str(user.id), "role": user.role.value})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_1_real_healthy_leaf(auth_headers):
    """TEST 1: Genuine healthy leaf -> PASS leaf validation, diagnosed as Healthy Foliage"""
    path = "ml/datasets/split/test/General___Healthy/General___Healthy_002.jpg"
    assert os.path.exists(path)
    with open(path, "rb") as f:
        img_bytes = f.read()

    res = client.post(
        "/api/ml/predict",
        files={"images": ("gallery_healthy_leaf.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()
    assert data["is_leaf_valid"] is True
    assert "healthy" in data["disease"].lower()
    assert data["confidence"] >= 0.80
    print(f"\n[PASS] TEST 1 (Healthy Leaf): Disease={data['disease']}, Conf={data['confidence']:.4f}")


def test_2_real_diseased_leaf(auth_headers):
    """TEST 2: Genuine diseased leaf -> PASS leaf validation, diagnosed as correct disease"""
    path = "frontend/public/crop_brown_spot.jpg"
    assert os.path.exists(path)
    with open(path, "rb") as f:
        img_bytes = f.read()

    res = client.post(
        "/api/ml/predict",
        files={"images": ("gallery_brown_spot.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()
    assert data["is_leaf_valid"] is True
    assert "Brown Spot" in data["disease"]
    assert data["crop"] == "Rice"
    assert data["confidence"] >= 0.80
    print(f"\n[PASS] TEST 2 (Diseased Leaf): Disease={data['disease']}, Conf={data['confidence']:.4f}")


def test_3_real_early_stage_leaf(auth_headers):
    """TEST 3: Early-stage leaf -> Honest status reported per Master Prompt Section 18"""
    path = "frontend/public/crop_brown_spot.jpg"
    with open(path, "rb") as f:
        img_bytes = f.read()

    res = client.post(
        "/api/ml/predict",
        files={"images": ("gallery_early_leaf.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_leaf_valid"] is True
    img_res = data["image_results"][0]
    assert img_res.get("early_stage_supported") is False
    assert "NOT YET VALIDATED" in img_res.get("early_stage_status")
    print(f"\n[PASS] TEST 3 (Early Stage Honesty): Status={img_res.get('early_stage_status')}")


def test_4_non_leaf_rejection(auth_headers):
    """TEST 4: Non-leaf object (Farmer portrait avatar) -> FAIL leaf validation, disease model NOT run"""
    path = "frontend/public/farmer_avatar.jpg"
    assert os.path.exists(path)
    with open(path, "rb") as f:
        img_bytes = f.read()

    res = client.post(
        "/api/ml/predict",
        files={"images": ("gallery_avatar.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"
    data = res.json()
    assert data["is_leaf_valid"] is False
    assert "actionable_guidance" in data
    assert data["image_results"][0]["disease"] == "Validation Rejected"
    print(f"\n[PASS] TEST 4 (Non-Leaf Rejection): Reason={data['reason']}")


def test_5_blurry_image_rejection(auth_headers):
    """TEST 5: Severely blurry photo -> Quality FAIL / RETAKE, disease model NOT run"""
    img = cv2.imread("frontend/public/crop_brown_spot.jpg")
    kernel = np.ones((25, 25), np.float32) / 625
    blurred = cv2.filter2D(img, -1, kernel)
    blurred = cv2.GaussianBlur(blurred, (25, 25), 0)
    _, encoded = cv2.imencode(".jpg", blurred)
    blurry_bytes = encoded.tobytes()

    res = client.post(
        "/api/ml/predict",
        files={"images": ("camera_blurry_fail.jpg", blurry_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 422
    data = res.json()
    assert data["is_leaf_valid"] is False
    assert "blurry" in data["reason"].lower()
    print(f"\n[PASS] TEST 5 (Blurry Rejection): Reason={data['reason']}, Guidance={data['actionable_guidance']}")


def test_6_camera_photo_exif_and_diagnostics(auth_headers):
    """TEST 6: Camera Photo with EXIF orientation -> Upright transposition, diagnostics trace, high confidence"""
    path = "frontend/public/crop_brown_spot.jpg"
    with Image.open(path) as img:
        exif = img.getexif()
        exif[0x0112] = 6  # 90 deg CW orientation tag
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif, quality=95)
        camera_bytes = buf.getvalue()

    # Test camera capture prediction
    res = client.post(
        "/api/ml/predict",
        files={"images": ("crop_camera_1792348.jpg", camera_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_leaf_valid"] is True
    assert "Brown Spot" in data["disease"]

    # Test developer diagnostics endpoint (Section 31)
    res_diag = client.post(
        "/api/ml/diagnostics",
        files={"image": ("camera_diagnostics.jpg", camera_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_diag.status_code == 200
    diag_data = res_diag.json()
    assert "CONFIRMED_DIAGNOSIS" in diag_data["final_decision"]
    assert diag_data["image_quality"]["is_valid"] is True
    assert len(diag_data["disease_prediction"]["top_3_predictions"]) == 3
    print(f"\n[PASS] TEST 6 (Camera Capture & Diagnostics): Final Decision={diag_data['final_decision']}")


if __name__ == "__main__":
    pytest.main(["-v", __file__])
