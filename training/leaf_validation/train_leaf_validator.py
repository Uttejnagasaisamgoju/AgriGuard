"""
AgriGuard ML — Train & Evaluate Leaf Validation Model
Extracts 24-dimensional agronomic, spectral, and textural features from real leaf
and non-leaf/unusable images, trains a calibrated classifier, tunes operating threshold,
and evaluates performance on held-out test data.
"""
import os
import json
import joblib
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Dict, Any

import cv2
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "leaf_validation"
MODELS_DIR = PROJECT_ROOT / "backend" / "uploads" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_OUT_PATH = MODELS_DIR / "leaf_validator.joblib"
METRICS_OUT_PATH = MODELS_DIR / "leaf_validator_metrics.json"

MODEL_VERSION = "leaf-validator-v2.0.0"


def compute_leaf_area_ratio(bgr: np.ndarray) -> float:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, w = bgr.shape[:2]
    total_pixels = max(1, h * w)

    lower_green = np.array([24, 30, 30])
    upper_green = np.array([88, 255, 255])
    mask_green = cv2.inRange(hsv, lower_green, upper_green)

    lower_brown = np.array([10, 35, 30])
    upper_brown = np.array([32, 255, 240])
    mask_brown = cv2.inRange(hsv, lower_brown, upper_brown)

    foliage_mask = cv2.bitwise_or(mask_green, mask_brown)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    foliage_mask = cv2.morphologyEx(foliage_mask, cv2.MORPH_CLOSE, kernel)
    leaf_pixels = cv2.countNonZero(foliage_mask)
    return float(round(leaf_pixels / total_pixels, 4))


def extract_features(img: np.ndarray) -> np.ndarray:
    """Extracts 24-dimensional feature vector matching production inference"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

    h_mean, h_std = float(np.mean(hsv[:, :, 0])), float(np.std(hsv[:, :, 0]))
    s_mean, s_std = float(np.mean(hsv[:, :, 1])), float(np.std(hsv[:, :, 1]))
    v_mean, v_std = float(np.mean(hsv[:, :, 2])), float(np.std(hsv[:, :, 2]))

    l_mean, l_std = float(np.mean(lab[:, :, 0])), float(np.std(lab[:, :, 0]))
    a_mean, a_std = float(np.mean(lab[:, :, 1])), float(np.std(lab[:, :, 1]))
    b_mean, b_std = float(np.mean(lab[:, :, 2])), float(np.std(lab[:, :, 2]))

    lap = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(lap.var())
    lap_mean = float(np.mean(np.abs(lap)))

    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobelx**2 + sobely**2)
    grad_mean = float(np.mean(grad_mag))
    grad_std = float(np.std(grad_mag))

    leaf_ratio = compute_leaf_area_ratio(img)

    green_mask = cv2.inRange(hsv, np.array([24, 30, 30]), np.array([88, 255, 255]))
    green_ratio = float(cv2.countNonZero(green_mask) / max(1, img.shape[0] * img.shape[1]))

    brown_mask = cv2.inRange(hsv, np.array([10, 35, 30]), np.array([32, 255, 240]))
    brown_ratio = float(cv2.countNonZero(brown_mask) / max(1, img.shape[0] * img.shape[1]))

    skin_mask = cv2.inRange(hsv, np.array([0, 20, 60]), np.array([20, 180, 255]))
    skin_ratio = float(cv2.countNonZero(skin_mask) / max(1, img.shape[0] * img.shape[1]))

    fft_res = cv2.resize(gray, (128, 128))
    f = np.fft.fft2(fft_res)
    fshift = np.fft.fftshift(f)
    fft_energy = float(np.sum(np.abs(fshift)**2) / 1e8)
    fft_std = float(np.std(np.abs(fshift)))
    fft_max = float(np.max(np.abs(fshift)))
    fft_ratio = fft_max / max(1.0, float(np.mean(np.abs(fshift))))

    features = np.array([
        h_mean, h_std, s_mean, s_std, v_mean, v_std,
        l_mean, l_std, a_mean, a_std, b_mean, b_std,
        lap_var, lap_mean, grad_mean, grad_std,
        leaf_ratio, green_ratio, brown_ratio, skin_ratio,
        fft_energy, fft_std, fft_max, fft_ratio
    ], dtype=np.float32)

    return features


def load_split(split_name: str) -> Tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    split_dir = DATASET_DIR / split_name

    # Leaf = 1
    leaf_files = sorted((split_dir / "leaf").glob("*.jpg"))
    for p in leaf_files:
        img = cv2.imread(str(p))
        if img is not None:
            X.append(extract_features(img))
            y.append(1)

    # Not Leaf = 0
    non_leaf_files = sorted((split_dir / "not_leaf").glob("*.jpg"))
    for p in non_leaf_files:
        img = cv2.imread(str(p))
        if img is not None:
            X.append(extract_features(img))
            y.append(0)

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int64)


def train_and_evaluate():
    print("=" * 65)
    print(f"Training Leaf Validation Model ({MODEL_VERSION})")
    print("=" * 65)

    X_train, y_train = load_split("train")
    X_val, y_val = load_split("val")
    X_test, y_test = load_split("test")

    print(f"Train samples: {len(y_train)} (Leaf: {np.sum(y_train == 1)}, Non-Leaf: {np.sum(y_train == 0)})")
    print(f"Val samples:   {len(y_val)} (Leaf: {np.sum(y_val == 1)}, Non-Leaf: {np.sum(y_val == 0)})")
    print(f"Test samples:  {len(y_test)} (Leaf: {np.sum(y_test == 1)}, Non-Leaf: {np.sum(y_test == 0)})")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # Calibrated Random Forest Classifier
    clf = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train_scaled, y_train)

    # Tune operating threshold on validation set
    val_probs = clf.predict_proba(X_val_scaled)[:, 1]
    best_thresh = 0.50
    best_f1 = 0.0

    for thresh in np.arange(0.35, 0.85, 0.05):
        preds = (val_probs >= thresh).astype(int)
        score = f1_score(y_val, preds, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_thresh = round(float(thresh), 2)

    print(f"\nOperating Threshold selected on Validation: {best_thresh:.2f} (Val F1: {best_f1:.4f})")

    # Evaluate on held-out test set
    test_probs = clf.predict_proba(X_test_scaled)[:, 1]
    test_preds = (test_probs >= best_thresh).astype(int)

    acc = float(accuracy_score(y_test, test_preds))
    prec = float(precision_score(y_test, test_preds, zero_division=0))
    rec = float(recall_score(y_test, test_preds, zero_division=0))
    f1 = float(f1_score(y_test, test_preds, zero_division=0))
    cm = confusion_matrix(y_test, test_preds).tolist()

    tn, fp, fn, tp = confusion_matrix(y_test, test_preds).ravel()
    fpr = float(round(fp / max(1, fp + tn), 4))
    fnr = float(round(fn / max(1, fn + tp), 4))

    print("\n--- Held-Out Test Evaluation Results ---")
    print(f"Accuracy:  {acc:.4f} ({acc*100:.2f}%)")
    print(f"Precision: {prec:.4f}")
    print(f"Recall:    {rec:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print(f"False Positive Rate: {fpr:.4f}")
    print(f"False Negative Rate: {fnr:.4f}")
    print(f"Confusion Matrix (TN={tn}, FP={fp}, FN={fn}, TP={tp}):")
    print(f"  [[{cm[0][0]}, {cm[0][1]}],")
    print(f"   [{cm[1][0]}, {cm[1][1]}]]")

    # Persist model bundle
    bundle = {
        "model": clf,
        "scaler": scaler,
        "version": MODEL_VERSION,
        "operating_threshold": best_thresh,
        "training_timestamp": datetime.utcnow().isoformat(),
        "n_features": 24,
    }
    joblib.dump(bundle, MODEL_OUT_PATH)
    print(f"\nSaved trained LeafValidator to: {MODEL_OUT_PATH}")

    # Persist metrics
    metrics = {
        "model_version": MODEL_VERSION,
        "architecture": "RandomForest-24DimFeatures",
        "dataset_name": "AgriGuard-LeafValidation-v2",
        "training_timestamp": datetime.utcnow().isoformat(),
        "train_samples": len(y_train),
        "val_samples": len(y_val),
        "test_samples": len(y_test),
        "operating_threshold": best_thresh,
        "test_metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "false_positive_rate": fpr,
            "false_negative_rate": fnr,
            "confusion_matrix": cm,
        }
    }
    with open(METRICS_OUT_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved evaluation metrics to: {METRICS_OUT_PATH}")


if __name__ == "__main__":
    train_and_evaluate()
