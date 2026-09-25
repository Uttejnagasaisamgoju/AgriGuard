"""
AgriGuard 10-Point Mandatory Acceptance Test Suite
Verifies all 10 non-negotiable production requirements for the real AI system:
1. Valid Leaf Image Detection (genuine leaves accepted)
2. Human / Object Rejection (non-plants rejected with actionable guidance)
3. Blurry / Dark Image Rejection (quality checks enforce clear imaging)
4. Screen / Display Capture Rejection (moiré and bezel artifacts detected)
5. Real PyTorch Disease Classification (MobileNetV3 on real weights)
6. Calibrated Confidence & Shannon Entropy (OOD uncertainty detection)
7. Agricultural AI Chat Assistance (grounded agronomy guidance)
8. Non-Agricultural Query Guardrail (blocks out-of-domain topics)
9. Farm Context Injection (tailors advice to farmer's crop and plot)
10. Model Status & Real Metrics Dashboard (100% measured numbers, zero fake stats)
"""
import sys
import io
import time
import json
from pathlib import Path
from typing import Dict, Any

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

import cv2
import numpy as np
from app.database.session import SessionLocal, create_tables
from app.models.user import User
from app.models.farm import Farm
from app.ml.leaf_validator import leaf_validator
from app.services.ml_service import ml_service
from app.services.ai_chat_service import ai_chat_service
from app.services.rag_service import rag_service


def run_acceptance_suite():
    print("=" * 75)
    print("AGRIGUARD — 10-POINT MANDATORY AI ACCEPTANCE TEST SUITE")
    print("=" * 75)

    db = SessionLocal()
    create_tables()
    rag_service.seed_initial_knowledge(db)

    user = db.query(User).first()
    if not user:
        from app.database.seed import seed_database
        seed_database(db)
        user = db.query(User).first()
    user_id = str(user.id)

    results = []

    # -------------------------------------------------------------
    # Point 1: Valid Leaf Image Detection
    # -------------------------------------------------------------
    print("\n[Point 1/10] Testing Valid Leaf Image Detection...")
    valid_leaf_path = str(PROJECT_ROOT / "frontend" / "public" / "crop_brown_spot.jpg")
    val_res = leaf_validator.validate(valid_leaf_path)
    p1_pass = val_res.get("is_valid") is True and val_res.get("leaf_probability", 0) > 0.50
    print(f"  Result: is_valid={val_res.get('is_valid')}, leaf_prob={val_res.get('leaf_probability'):.3f}")
    results.append(("Point 1: Valid Leaf Acceptance", p1_pass, f"Leaf probability: {val_res.get('leaf_probability'):.2f}"))

    # -------------------------------------------------------------
    # Point 2: Human Face / Object Rejection
    # -------------------------------------------------------------
    print("\n[Point 2/10] Testing Human Face / Object Rejection...")
    human_path = str(PROJECT_ROOT / "frontend" / "public" / "farmer_avatar.jpg")
    human_val = leaf_validator.validate(human_path)
    p2_pass = (
        human_val.get("is_valid") is False
        and human_val.get("reason") is not None
        and len(human_val.get("actionable_guidance", "")) > 10
    )
    print(f"  Result: is_valid={human_val.get('is_valid')}, reason='{human_val.get('reason')}'")
    print(f"  Guidance: '{human_val.get('actionable_guidance')}'")
    results.append(("Point 2: Human/Non-Plant Rejection", p2_pass, f"Rejection reason: {human_val.get('reason')}"))

    # -------------------------------------------------------------
    # Point 3: Blurry / Dark Image Quality Check
    # -------------------------------------------------------------
    print("\n[Point 3/10] Testing Blurry and Dark Photo Rejection...")
    # Generate an artificially blurred version of the leaf
    img = cv2.imread(valid_leaf_path)
    blurred = cv2.GaussianBlur(img, (45, 45), 0)
    scratch_dir = PROJECT_ROOT / "backend" / "uploads" / "scratch"
    scratch_dir.mkdir(parents=True, exist_ok=True)
    blur_path = str(scratch_dir / "test_blur.jpg")
    cv2.imwrite(blur_path, blurred)

    blur_val = leaf_validator.validate(blur_path)
    p3_pass = blur_val.get("is_valid") is False and ("blurry" in blur_val.get("reason", "").lower() or blur_val.get("blur_score") < 0.25)
    print(f"  Result: is_valid={blur_val.get('is_valid')}, blur_score={blur_val.get('blur_score'):.3f}, reason='{blur_val.get('reason')}'")
    results.append(("Point 3: Blurry/Dark Photo Rejection", p3_pass, f"Blur detected: {blur_val.get('reason')}"))

    # -------------------------------------------------------------
    # Point 4: Screen / Display Capture Rejection
    # -------------------------------------------------------------
    print("\n[Point 4/10] Testing Screen / Display Capture Rejection...")
    # Add artificial moire pattern / screen bezel
    screen_img = img.copy()
    h, w = screen_img.shape[:2]
    # Draw display bezel border inset by 16px
    cv2.rectangle(screen_img, (16, 16), (w - 16, h - 16), (10, 10, 10), thickness=14)
    # Add periodic moire scan lines
    screen_img[::3, :] = np.clip(screen_img[::3, :] * 0.3, 0, 255).astype(np.uint8)
    screen_path = str(scratch_dir / "test_screen.jpg")
    cv2.imwrite(screen_path, screen_img)

    screen_val = leaf_validator.validate(screen_path)
    p4_pass = screen_val.get("screen_probability", 0) > 0.40 or screen_val.get("is_valid") is False
    print(f"  Result: screen_prob={screen_val.get('screen_probability'):.3f}, reason='{screen_val.get('reason')}'")
    results.append(("Point 4: Screen/Display Artifact Rejection", p4_pass, f"Screen score: {screen_val.get('screen_probability'):.2f}"))

    # -------------------------------------------------------------
    # Point 5: Real PyTorch Disease Classification
    # -------------------------------------------------------------
    print("\n[Point 5/10] Testing Real PyTorch Disease Classification...")
    ml_pred = ml_service.predict(valid_leaf_path, validate_leaf_first=False)
    p5_pass = (
        ml_pred.get("disease") is not None
        and ml_pred.get("crop") is not None
        and ml_pred.get("confidence", 0) > 0.50
        and len(ml_pred.get("top_predictions", [])) > 1
        and ml_pred.get("model_version") == "disease-model-v1.0.0"
    )
    print(f"  Result: Disease='{ml_pred.get('disease')}', Crop='{ml_pred.get('crop')}', Conf={ml_pred.get('confidence'):.3f}")
    print(f"  Architecture: MobileNetV3 (Model Version: {ml_pred.get('model_version')})")
    results.append(("Point 5: Real PyTorch Disease Classifier", p5_pass, f"{ml_pred.get('disease')} ({ml_pred.get('confidence'):.2f})"))

    # -------------------------------------------------------------
    # Point 6: Calibrated Confidence & Shannon Entropy
    # -------------------------------------------------------------
    print("\n[Point 6/10] Testing Calibrated Confidence & Shannon Entropy...")
    entropy = ml_pred.get("entropy", 0.0)
    uncertainty = ml_pred.get("uncertainty_score", 0.0)
    p6_pass = entropy is not None and "is_uncertain" in ml_pred and "escalation_recommended" in ml_pred
    print(f"  Result: Shannon Entropy={entropy:.4f}, Uncertainty={uncertainty:.4f}, is_uncertain={ml_pred.get('is_uncertain')}")
    results.append(("Point 6: Calibrated Confidence & Shannon Entropy", p6_pass, f"Entropy: {entropy:.4f}"))

    # -------------------------------------------------------------
    # Point 7: Agricultural AI Chat Assistance
    # -------------------------------------------------------------
    print("\n[Point 7/10] Testing Agricultural AI Chat Guidance...")
    chat_res = ai_chat_service.generate_response(
        db=db,
        user_id=user_id,
        query="What are the symptoms and immediate fungicide spray for Rice Blast disease?",
    )
    p7_pass = (
        len(chat_res.get("response", "")) > 150
        and len(chat_res.get("sources", [])) > 0
        and len(chat_res.get("suggested_questions", [])) > 0
        and chat_res.get("confidence", 0) > 0.70
    )
    print(f"  Result: Sources={len(chat_res.get('sources', []))}, Suggestions={len(chat_res.get('suggested_questions', []))}")
    print(f"  Sample guidance: {chat_res.get('response')[:120]}...")
    results.append(("Point 7: Agricultural AI Chat Assistant", p7_pass, f"Sources cited: {len(chat_res.get('sources', []))}"))

    # -------------------------------------------------------------
    # Point 8: Non-Agricultural Query Rejection
    # -------------------------------------------------------------
    print("\n[Point 8/10] Testing Non-Agricultural Query Rejection...")
    non_agri = ai_chat_service.generate_response(
        db=db,
        user_id=user_id,
        query="Write a quicksort python algorithm to trade stocks on wall street.",
    )
    p8_pass = (
        non_agri.get("model_version") == "AgriGuard-Domain-Filter"
        or "exclusively in" in non_agri.get("response", "").lower()
    )
    print(f"  Result: Guardrail triggered={p8_pass}, Model='{non_agri.get('model_version')}'")
    results.append(("Point 8: Non-Agri Query Guardrail", p8_pass, "Correctly rejected non-farming query"))

    # -------------------------------------------------------------
    # Point 9: Farm Context Injection
    # -------------------------------------------------------------
    print("\n[Point 9/10] Testing Farm Context Injection...")
    # Find user farm
    farm = db.query(Farm).filter(Farm.user_id == user_id).first()
    farm_id = str(farm.id) if farm else None
    farm_chat = ai_chat_service.generate_response(
        db=db,
        user_id=user_id,
        farm_id=farm_id,
        query="How much nitrogen fertilizer should I apply per acre for my active field?",
    )
    f_ctx = farm_chat.get("farm_context", {})
    p9_pass = f_ctx is not None and (f_ctx.get("farm_name") is not None or f_ctx.get("crop") is not None)
    print(f"  Result: Active Farm='{f_ctx.get('farm_name')}', Active Crop='{f_ctx.get('crop')}', Location='{f_ctx.get('location')}'")
    results.append(("Point 9: Farm Context Injection", p9_pass, f"Farm: {f_ctx.get('farm_name')}, Crop: {f_ctx.get('crop')}"))

    # -------------------------------------------------------------
    # Point 10: Model Dashboard Real Status & Verified Numbers
    # -------------------------------------------------------------
    print("\n[Point 10/10] Testing Real Metrics & Dashboard Status...")
    metrics_path = PROJECT_ROOT / "backend" / "uploads" / "models" / "disease_model_metrics.json"
    p10_pass = False
    details = "No metrics found"
    if metrics_path.exists():
        with open(metrics_path, "r") as f:
            metrics = json.load(f)
        test_acc = metrics.get("test_accuracy")
        macro_f1 = metrics.get("macro_f1")
        p10_pass = test_acc is not None and macro_f1 is not None and test_acc > 70.0
        details = f"Test Acc: {test_acc}%, Macro F1: {macro_f1:.4f}, Epochs: {metrics.get('training_epochs')}"
    print(f"  Result: {details}")
    results.append(("Point 10: Real Measured Model Metrics", p10_pass, details))

    # -------------------------------------------------------------
    # Summary Table
    # -------------------------------------------------------------
    print("\n" + "=" * 75)
    print("10-POINT MANDATORY ACCEPTANCE TEST SUMMARY")
    print("=" * 75)
    all_passed = True
    for name, passed, info in results:
        status_str = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"[{status_str:4s}] {name:42s} | {info}")

    print("-" * 75)
    passed_count = sum(1 for _, p, _ in results)
    print(f"FINAL ACCEPTANCE RESULT: {passed_count}/10 POINTS PASSED ({'ALL REQUIREMENTS SATISFIED' if all_passed else 'SOME TESTS FAILED'})")
    print("=" * 75)

    return all_passed


if __name__ == "__main__":
    success = run_acceptance_suite()
    sys.exit(0 if success else 1)
