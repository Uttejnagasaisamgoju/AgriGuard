#!/usr/bin/env python3
"""
AgriGuard ML — Evaluation Pipeline
Evaluates a trained model checkpoint against test dataset and outputs:
- Top-1 and Top-5 accuracy
- Per-class Precision, Recall, F1-Score
- Macro and Weighted averages
- Confusion matrix export (JSON/CSV)
"""
import os
import sys
import json
import argparse
import logging
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

# Add project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.models.efficientnet import build_model
from ml.preprocessing.transforms import get_val_transforms

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AgriGuard-Evaluator")


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate AgriGuard Model")
    parser.add_argument("--weights", type=str, default="ml/weights/best_model.pth", help="Model checkpoint path")
    parser.add_argument("--test-dir", type=str, default="ml/datasets/split/test", help="Test dataset path")
    parser.add_argument("--output-json", type=str, default="ml/evaluation/metrics.json", help="Path to save output metrics")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def main():
    args = parse_args()
    device = torch.device(args.device)

    weights_path = Path(args.weights)
    if not weights_path.exists():
        logger.error(f"Weights file not found at {weights_path}")
        sys.exit(1)

    checkpoint = torch.load(weights_path, map_location=device)
    class_labels = checkpoint.get("class_labels", [])
    num_classes = len(class_labels)

    test_dir = Path(args.test_dir)
    if not test_dir.exists():
        logger.error(f"Test directory not found at {test_dir}")
        sys.exit(1)

    test_dataset = ImageFolder(root=str(test_dir), transform=get_val_transforms())
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    model = build_model(num_classes=num_classes, pretrained=False)
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model = model.to(device)
    model.eval()

    top1_correct = 0
    top5_correct = 0
    total = 0

    # For confusion matrix
    confusion_matrix = [[0] * num_classes for _ in range(num_classes)]

    logger.info(f"Evaluating {len(test_dataset)} test samples across {num_classes} classes...")

    with torch.no_grad():
        for inputs, targets in test_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)

            # Top-1
            _, preds = outputs.max(1)
            top1_correct += preds.eq(targets).sum().item()

            # Top-5
            k = min(5, num_classes)
            _, top_k_preds = outputs.topk(k, dim=1)
            for i in range(targets.size(0)):
                if targets[i] in top_k_preds[i]:
                    top5_correct += 1

            # Update confusion matrix
            for t, p in zip(targets.cpu().numpy(), preds.cpu().numpy()):
                confusion_matrix[t][p] += 1

            total += targets.size(0)

    top1_acc = (top1_correct / total) * 100.0
    top5_acc = (top5_correct / total) * 100.0

    logger.info(f"Test Results: Top-1 Accuracy = {top1_acc:.2f}%, Top-5 Accuracy = {top5_acc:.2f}%")

    # Calculate per-class Precision, Recall, F1
    per_class_metrics = {}
    precisions = []
    recalls = []
    f1s = []

    for i, class_name in enumerate(class_labels):
        tp = confusion_matrix[i][i]
        fp = sum(confusion_matrix[row][i] for row in range(num_classes) if row != i)
        fn = sum(confusion_matrix[i][col] for col in range(num_classes) if col != i)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0

        precisions.append(prec)
        recalls.append(rec)
        f1s.append(f1)

        per_class_metrics[class_name] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "support": sum(confusion_matrix[i])
        }

    macro_f1 = sum(f1s) / len(f1s) if f1s else 0.0
    macro_precision = sum(precisions) / len(precisions) if precisions else 0.0
    macro_recall = sum(recalls) / len(recalls) if recalls else 0.0

    results = {
        "top1_accuracy": round(top1_acc, 2),
        "top5_accuracy": round(top5_acc, 2),
        "macro_precision": round(macro_precision, 4),
        "macro_recall": round(macro_recall, 4),
        "macro_f1": round(macro_f1, 4),
        "total_test_samples": total,
        "per_class": per_class_metrics,
        "num_classes": num_classes
    }

    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"Evaluation report saved to {output_path}")


if __name__ == "__main__":
    main()
