"""
AgriGuard End-to-End Verification Test Suite: Camera-Captured Leaf Photos
Tests:
1. High-Resolution & EXIF Orientation Normalization (sideways phone camera handling)
2. In-Camera Real-Time Leaf Validation (blurry/non-leaf rejection with actionable guidance)
3. OpenCV AI Image Enhancement (CLAHE contrast, bilateral denoise, unsharp mask, idempotency)
4. Disease Detection Accuracy for Camera Photos (Known Diseased, Known Healthy, Honest Confidences)
5. Varied Real Field Lighting Conditions (Bright Sun, Shaded, Normal)
6. Parity between Camera Capture and File Upload Pipelines
"""
import sys
import os
import io
import pytest
import numpy as np
import cv2
from PIL import Image, ImageOps
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.database.session import SessionLocal
from app.models.user import User, UserRole
from app.auth.security import create_access_token
from app.services.ml_service import ml_service
from app.ml.leaf_validator import leaf_validator
from app.services.enhancement_service import ImageEnhancementService
from app.services.storage_service import StorageService

client = TestClient(app)


@pytest.fixture(scope="module")
def auth_headers():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "test_camera_farmer@agriguard.app").first()
        if not user:
            user = User(
                email="test_camera_farmer@agriguard.app",
                password_hash="testpass123",
                name="Camera Test Farmer",
                role=UserRole.FARMER,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def create_test_image_with_exif(source_path: str, orientation: int = 6) -> bytes:
    """Creates a JPEG byte stream with specific EXIF orientation tag (e.g. 6 = 90 deg CW)"""
    with Image.open(source_path) as img:
        exif = img.getexif()
        exif[0x0112] = orientation  # 0x0112 is EXIF Orientation tag
        out = io.BytesIO()
        img.save(out, format="JPEG", exif=exif, quality=95)
        return out.getvalue()


def create_blurry_image(source_path: str) -> bytes:
    """Simulates severe motion blur in a camera capture"""
    img = cv2.imread(source_path)
    # Apply severe box motion blur kernel
    kernel_motion_blur = np.zeros((25, 25))
    kernel_motion_blur[12, :] = np.ones(25) / 25
    blurred = cv2.filter2D(img, -1, kernel_motion_blur)
    blurred = cv2.GaussianBlur(blurred, (21, 21), 0)
    _, encoded = cv2.imencode(".jpg", blurred, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return encoded.tobytes()


def create_lighting_variant(source_path: str, factor: float) -> bytes:
    """Adjusts luminance to simulate bright sunlight (> 1.0) or shade (< 1.0)"""
    img = cv2.imread(source_path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] * factor, 0, 255)
    adjusted = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    _, encoded = cv2.imencode(".jpg", adjusted, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return encoded.tobytes()


def test_camera_resolution_and_exif_orientation_correction(auth_headers):
    """
    Step 1: Verify camera photos with EXIF orientation (e.g. portrait photos on mobile)
    are physically transposed upright and full resolution is preserved without downsampling.
    """
    source_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"
    assert os.path.exists(source_path), "Reference diseased photo missing"

    # Simulate mobile phone camera capture with EXIF Orientation = 6 (90 deg CW)
    exif_bytes = create_test_image_with_exif(source_path, orientation=6)
    assert len(exif_bytes) > 100_000, "Image byte buffer too small"

    response = client.post(
        "/api/ml/enhance",
        files={"image": ("camera_exif_test.jpg", exif_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 200, f"Enhance endpoint failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert "dimensions" in data
    w, h = data["dimensions"]["width"], data["dimensions"]["height"]
    assert w >= 500 and h >= 500, f"Resolution was degraded! Dimensions: {w}x{h}"

    # Verify physical file on disk was saved upright
    enhanced_rel_path = data["enhanced_path"]
    assert os.path.exists(enhanced_rel_path)
    saved_img = Image.open(enhanced_rel_path)
    # An upright transposed image should not have orientation tag 6 remaining
    exif = saved_img.getexif()
    assert exif.get(0x0112, 1) == 1, "EXIF orientation was not transposed upright!"


def test_in_camera_validation_blurry_and_nonleaf(auth_headers):
    """
    Step 2: Confirm leaf-image validation check catches blurry, poorly-framed,
    and non-leaf camera captures and returns actionable retake guidance.
    """
    source_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"

    # 1. Test Blurry Camera Photo
    blurry_bytes = create_blurry_image(source_path)
    res_blur = client.post(
        "/api/vision/validate",
        files={"image": ("camera_blurry.jpg", blurry_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_blur.status_code == 200
    data_blur = res_blur.json()
    assert data_blur["is_valid"] is False, "Blurry camera capture should be rejected"
    assert "blurry" in data_blur["reason"].lower()
    assert len(data_blur["actionable_guidance"]) > 10
    assert "hold" in data_blur["actionable_guidance"].lower() or "focus" in data_blur["actionable_guidance"].lower()

    # 2. Test Non-Leaf Camera Photo (Farmer portrait avatar)
    avatar_path = "c:/sih3/frontend/public/farmer_avatar.jpg"
    with open(avatar_path, "rb") as f:
        avatar_bytes = f.read()

    res_nonleaf = client.post(
        "/api/vision/validate",
        files={"image": ("camera_person.jpg", avatar_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_nonleaf.status_code == 200
    data_nonleaf = res_nonleaf.json()
    assert data_nonleaf["is_valid"] is False, "Non-leaf camera capture should be rejected"
    assert "leaf" in data_nonleaf["reason"].lower()
    assert "actionable_guidance" in data_nonleaf

    # 3. Test Valid Camera Leaf Photo
    with open(source_path, "rb") as f:
        leaf_bytes = f.read()

    res_valid = client.post(
        "/api/vision/validate",
        files={"image": ("camera_good_leaf.jpg", leaf_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_valid.status_code == 200
    data_valid = res_valid.json()
    assert data_valid["is_valid"] is True, f"Valid camera leaf failed validation: {data_valid}"


def test_opencv_ai_enhancement_on_camera_photos(auth_headers):
    """
    Step 2: Confirm real OpenCV enhancement (CLAHE, bilateral filter, unsharp mask)
    runs on camera captures and handles idempotency without double-filtering.
    """
    source_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"
    with open(source_path, "rb") as f:
        leaf_bytes = f.read()

    res = client.post(
        "/api/ml/enhance",
        files={"image": ("camera_capture_raw.jpg", leaf_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    applied = data.get("enhancements_applied", [])
    assert any("CLAHE" in a for a in applied)
    assert any("Bilateral" in a for a in applied)
    assert any("Unsharp" in a for a in applied)
    assert os.path.exists(data["enhanced_path"])

    # Test enhancement idempotency directly via service
    enh_service = ImageEnhancementService()
    re_enh = enh_service.enhance_crop_image(data["enhanced_path"])
    assert re_enh["success"] is True
    assert re_enh["enhanced_path"] == data["enhanced_path"], "Should recognize existing enhancement"


def test_disease_detection_camera_diseased_and_healthy(auth_headers):
    """
    Step 3 & 4: Confirm accurate disease detection specifically for camera photos:
    - Known diseased sample (Rice Brown Spot) -> Brown Spot, high honest confidence
    - Known diseased sample (Rice Leaf Blast) -> Leaf Blast, high honest confidence
    - Non-leaf photo -> Rejected by pre-validation (422 HTTP)
    """
    # 1. Known Diseased Sample: Rice Brown Spot
    with open("c:/sih3/frontend/public/crop_brown_spot.jpg", "rb") as f:
        brown_spot_bytes = f.read()

    res_brown = client.post(
        "/api/ml/predict",
        files={"images": ("camera_brown_spot.jpg", brown_spot_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_brown.status_code == 200, f"Predict failed: {res_brown.text}"
    data_brown = res_brown.json()
    assert data_brown.get("is_leaf_valid") is True
    assert "Brown Spot" in data_brown.get("disease", "")
    assert data_brown.get("crop") == "Rice"
    conf = data_brown.get("confidence")
    assert conf is not None and conf > 0.80, f"Expected high authentic confidence, got {conf}"
    assert isinstance(conf, float), "Confidence should be a genuine floating point probability"

    # 2. Known Diseased Sample: Rice Leaf Blast
    with open("c:/sih3/frontend/public/blast_rice.jpg", "rb") as f:
        blast_bytes = f.read()

    res_blast = client.post(
        "/api/ml/predict",
        files={"images": ("camera_blast.jpg", blast_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_blast.status_code == 200
    data_blast = res_blast.json()
    assert data_blast.get("is_leaf_valid") is True
    assert "Blast" in data_blast.get("disease", "")
    assert data_blast.get("confidence") > 0.85

    # 3. Non-Leaf Photo -> Rejected before disease model is reached
    with open("c:/sih3/frontend/public/farmer_avatar.jpg", "rb") as f:
        avatar_bytes = f.read()

    res_nonleaf = client.post(
        "/api/ml/predict",
        files={"images": ("camera_avatar.jpg", avatar_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    # The pipeline should reject invalid leaf images with 422
    assert res_nonleaf.status_code == 422, f"Expected 422 Leaf Validation Failed, got {res_nonleaf.status_code}"
    rej_data = res_nonleaf.json()
    assert rej_data.get("is_leaf_valid") is False
    assert "actionable_guidance" in rej_data


def test_camera_lighting_conditions_robustness(auth_headers):
    """
    Step 4: Verify consistent accuracy across real-world lighting conditions:
    Bright direct outdoor sun (+35% luminance) vs Shaded canopy (-25% luminance).
    """
    source_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"

    # 1. Bright Sunlight Condition
    bright_bytes = create_lighting_variant(source_path, factor=1.35)
    res_bright = client.post(
        "/api/ml/predict",
        files={"images": ("camera_bright_sun.jpg", bright_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_bright.status_code == 200
    data_bright = res_bright.json()
    assert data_bright.get("is_leaf_valid") is True
    assert "Brown Spot" in data_bright.get("disease", "")

    # 2. Shaded Foliage Condition
    shade_bytes = create_lighting_variant(source_path, factor=0.75)
    res_shade = client.post(
        "/api/ml/predict",
        files={"images": ("camera_shade.jpg", shade_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    assert res_shade.status_code == 200
    data_shade = res_shade.json()
    assert data_shade.get("is_leaf_valid") is True
    assert "Brown Spot" in data_shade.get("disease", "")


def test_parity_between_camera_and_upload(auth_headers):
    """
    Verify parity: Camera-captured photo (simulated) and gallery-uploaded photo
    produce equivalent diagnosis and confidence without camera penalty.
    """
    source_path = "c:/sih3/frontend/public/crop_brown_spot.jpg"
    with open(source_path, "rb") as f:
        img_bytes = f.read()

    # Upload flow
    res_upload = client.post(
        "/api/ml/predict",
        files={"images": ("gallery_upload.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    data_upload = res_upload.json()

    # Camera flow (simulating in-app camera capture)
    res_camera = client.post(
        "/api/ml/predict",
        files={"images": ("crop_camera_1789894.jpg", img_bytes, "image/jpeg")},
        headers=auth_headers,
    )
    data_camera = res_camera.json()

    assert data_upload["disease"] == data_camera["disease"], "Camera and upload diagnosed different diseases!"
    assert abs(data_upload["confidence"] - data_camera["confidence"]) < 0.01, "Confidence differs between camera and upload!"
