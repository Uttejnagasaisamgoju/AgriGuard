"""
AgriGuard ML — Production Disease Classification Model Training & Evaluation
Trains a PyTorch MobileNetV3 model on the leak-free agricultural disease dataset,
evaluates on the held-out test set, and persists authentic per-class metrics.
"""
import os
import time
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_DIR = PROJECT_ROOT / "ml" / "datasets" / "disease_split"
MODELS_DIR = PROJECT_ROOT / "backend" / "uploads" / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
MODEL_OUT_PATH = MODELS_DIR / "best_model.pt"
LABELS_OUT_PATH = MODELS_DIR / "class_labels.json"
METRICS_OUT_PATH = MODELS_DIR / "disease_model_metrics.json"

MODEL_VERSION = "disease-model-v2.1.0"
BATCH_SIZE = 16
NUM_EPOCHS = 12
LEARNING_RATE = 1e-3


def build_model(num_classes: int) -> nn.Module:
    # Use MobileNetV3-Small for fast, lightweight edge and server inference
    try:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        # Freeze early feature layers for transfer learning stability
        for param in list(model.features.parameters())[:6]:
            param.requires_grad = False
    except Exception:
        model = models.mobilenet_v3_small(weights=None)

    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(
        nn.Dropout(p=0.25),
        nn.Linear(in_features, num_classes),
    )
    return model


def train_and_evaluate_disease_model():
    print("=" * 65)
    print(f"Training AgriGuard Disease Pathology Model ({MODEL_VERSION})")
    print("=" * 65)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Compute Device: {device}")

    train_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.1, contrast=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    val_test_transforms = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    train_dataset = datasets.ImageFolder(str(DATASET_DIR / "train"), transform=train_transforms)
    val_dataset = datasets.ImageFolder(str(DATASET_DIR / "val"), transform=val_test_transforms)
    test_dataset = datasets.ImageFolder(str(DATASET_DIR / "test"), transform=val_test_transforms)

    class_names = train_dataset.classes
    num_classes = len(class_names)
    print(f"Agricultural Classes ({num_classes}): {class_names}")
    print(f"Train samples: {len(train_dataset)}, Val: {len(val_dataset)}, Test: {len(test_dataset)}")

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = build_model(num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS)

    best_val_loss = float("inf")
    best_weights = None
    start_time = time.time()

    print("\nStarting Training Loop...")
    for epoch in range(1, NUM_EPOCHS + 1):
        model.train()
        running_loss = 0.0
        correct_train = 0
        total_train = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, predicted = torch.max(outputs, 1)
            correct_train += (predicted == labels).sum().item()
            total_train += labels.size(0)

        scheduler.step()
        epoch_train_loss = running_loss / max(1, total_train)
        epoch_train_acc = (correct_train / max(1, total_train)) * 100.0

        # Validation phase
        model.eval()
        val_loss = 0.0
        correct_val = 0
        total_val = 0

        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)
                val_loss += loss.item() * images.size(0)
                _, predicted = torch.max(outputs, 1)
                correct_val += (predicted == labels).sum().item()
                total_val += labels.size(0)

        epoch_val_loss = val_loss / max(1, total_val)
        epoch_val_acc = (correct_val / max(1, total_val)) * 100.0

        print(f"Epoch {epoch:2d}/{NUM_EPOCHS:2d} | "
              f"Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc:.1f}% | "
              f"Val Loss: {epoch_val_loss:.4f} Acc: {epoch_val_acc:.1f}%")

        if epoch_val_loss < best_val_loss or best_weights is None:
            best_val_loss = epoch_val_loss
            best_weights = model.state_dict().copy()

    training_duration = round(time.time() - start_time, 2)
    print(f"\nTraining completed in {training_duration}s. Best Val Loss: {best_val_loss:.4f}")

    if best_weights:
        model.load_state_dict(best_weights)

    # Completely held-out test evaluation
    print("\n--- Evaluating on Held-Out Test Set ---")
    model.eval()
    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            probs = torch.softmax(outputs, dim=1)
            _, predicted = torch.max(outputs, 1)
            all_preds.extend(predicted.cpu().numpy().tolist())
            all_targets.extend(labels.numpy().tolist())
            all_probs.extend(probs.cpu().numpy().tolist())

    y_true = np.array(all_targets)
    y_pred = np.array(all_preds)

    test_acc = float(accuracy_score(y_true, y_pred))
    macro_prec = float(precision_score(y_true, y_pred, average="macro", zero_division=0))
    macro_rec = float(recall_score(y_true, y_pred, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes))).tolist()

    report_dict = classification_report(y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0)

    print(f"Held-Out Test Accuracy: {test_acc:.4f} ({test_acc*100:.2f}%)")
    print(f"Macro Precision:        {macro_prec:.4f}")
    print(f"Macro Recall:           {macro_rec:.4f}")
    print(f"Macro F1 Score:         {macro_f1:.4f}")

    per_class_metrics = {}
    for cls in class_names:
        c_stats = report_dict.get(cls, {})
        per_class_metrics[cls] = {
            "precision": round(c_stats.get("precision", 0.0), 4),
            "recall": round(c_stats.get("recall", 0.0), 4),
            "f1_score": round(c_stats.get("f1-score", 0.0), 4),
            "support": int(c_stats.get("support", 0)),
        }
        print(f"  {cls:35s}: P={c_stats.get('precision', 0):.2f}, R={c_stats.get('recall', 0):.2f}, F1={c_stats.get('f1-score', 0):.2f}")

    # Persist model weights (compatible with PyTorch load_state_dict)
    torch.save({"model_state_dict": model.state_dict(), "version": MODEL_VERSION}, MODEL_OUT_PATH)
    print(f"\nSaved trained pathology model weights to: {MODEL_OUT_PATH}")

    # Persist class labels
    with open(LABELS_OUT_PATH, "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"Saved class labels to: {LABELS_OUT_PATH}")

    # Persist genuine evaluation metrics
    metrics_data = {
        "model_version": MODEL_VERSION,
        "architecture": "MobileNetV3-Small-Pathology",
        "dataset_name": "AgriGuard-DiseaseSplit-v2",
        "num_classes": num_classes,
        "classes": class_names,
        "training_epochs": NUM_EPOCHS,
        "training_duration_seconds": training_duration,
        "timestamp": datetime.now().isoformat(),
        "train_samples": len(train_dataset),
        "val_samples": len(val_dataset),
        "test_samples": len(test_dataset),
        "overall_test_metrics": {
            "accuracy": round(test_acc, 4),
            "macro_precision": round(macro_prec, 4),
            "macro_recall": round(macro_rec, 4),
            "macro_f1": round(macro_f1, 4),
        },
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm,
        "early_stage_support": "NOT YET VALIDATED (Requires verified stage annotations per Master Prompt Section 18)"
    }

    with open(METRICS_OUT_PATH, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Saved disease evaluation metrics to: {METRICS_OUT_PATH}")

    # Mirror to root uploads/models directory
    root_models_dir = PROJECT_ROOT / "uploads" / "models"
    root_models_dir.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(MODEL_OUT_PATH, root_models_dir / "best_model.pt")
    shutil.copy2(LABELS_OUT_PATH, root_models_dir / "class_labels.json")
    shutil.copy2(METRICS_OUT_PATH, root_models_dir / "disease_model_metrics.json")
    print(f"Mirrored model artifacts to: {root_models_dir}")


if __name__ == "__main__":
    train_and_evaluate_disease_model()
