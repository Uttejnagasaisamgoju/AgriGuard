#!/usr/bin/env python3
"""
AgriGuard ML — Production Training Pipeline
Trains EfficientNet-B0 on PlantVillage disease dataset with transfer learning,
learning rate scheduling, early stopping, and automatic checkpointing.

Usage:
    python ml/training/train.py --data-dir ml/datasets/split --epochs 25 --batch-size 32
"""
import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision.datasets import ImageFolder

# Add project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.models.efficientnet import build_model
from ml.preprocessing.transforms import get_train_transforms, get_val_transforms

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("AgriGuard-Trainer")


def parse_args():
    parser = argparse.ArgumentParser(description="Train AgriGuard Plant Disease Model")
    parser.add_argument("--data-dir", type=str, default="ml/datasets/split", help="Path to split dataset directory")
    parser.add_argument("--output-dir", type=str, default="ml/weights", help="Directory to save model weights")
    parser.add_argument("--epochs", type=int, default=25, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Mini-batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Initial learning rate")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="Weight decay for AdamW")
    parser.add_argument("--patience", type=int, default=5, help="Early stopping patience")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu", help="Device (cuda/cpu)")
    parser.add_argument("--num-workers", type=int, default=2, help="DataLoader worker processes")
    return parser.parse_args()


def train_epoch(model, dataloader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for batch_idx, (inputs, targets) in enumerate(dataloader):
        inputs, targets = inputs.to(device), targets.to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

    epoch_loss = running_loss / total
    epoch_acc = (correct / total) * 100.0
    return epoch_loss, epoch_acc


def validate(model, dataloader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for inputs, targets in dataloader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, targets)

            running_loss += loss.item() * inputs.size(0)
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

    val_loss = running_loss / total
    val_acc = (correct / total) * 100.0
    return val_loss, val_acc


def main():
    args = parse_args()
    device = torch.device(args.device)
    logger.info(f"Starting AgriGuard ML Training on device: {device}")

    data_dir = Path(args.data_dir)
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"
    test_dir = data_dir / "test"

    if not train_dir.exists() or not val_dir.exists():
        logger.error(f"Dataset split not found at {data_dir}. Run ml/scripts/prepare_dataset.py first.")
        sys.exit(1)

    # Load datasets
    train_dataset = ImageFolder(root=str(train_dir), transform=get_train_transforms())
    val_dataset = ImageFolder(root=str(val_dir), transform=get_val_transforms())

    class_names = train_dataset.classes
    num_classes = len(class_names)
    logger.info(f"Loaded {len(train_dataset)} training images across {num_classes} classes.")
    logger.info(f"Loaded {len(val_dataset)} validation images.")

    # DataLoaders
    train_loader = DataLoader(
        train_dataset, batch_size=args.batch_size, shuffle=True,
        num_workers=args.num_workers, pin_memory=(device.type == "cuda")
    )
    val_loader = DataLoader(
        val_dataset, batch_size=args.batch_size, shuffle=False,
        num_workers=args.num_workers, pin_memory=(device.type == "cuda")
    )

    # Initialize model
    model = build_model(num_classes=num_classes, pretrained=True)
    model = model.to(device)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save class mapping
    with open(output_dir / "class_labels.json", "w") as f:
        json.dump(class_names, f, indent=2)

    best_val_acc = 0.0
    patience_counter = 0
    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        epoch_start = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = validate(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - epoch_start
        logger.info(
            f"Epoch [{epoch:02d}/{args.epochs:02d}] ({elapsed:.1f}s) "
            f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}% | "
            f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%"
        )

        # Checkpoint if best
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_accuracy": val_acc,
                "num_classes": num_classes,
                "class_labels": class_names,
                "timestamp": datetime.utcnow().isoformat()
            }
            torch.save(checkpoint, output_dir / "best_model.pth")
            logger.info(f"  --> Saved new best checkpoint with accuracy {val_acc:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                logger.info(f"Early stopping triggered after {epoch} epochs (no improvement for {args.patience} epochs).")
                break

    total_time = time.time() - start_time
    logger.info(f"Training completed in {total_time/60:.2f} minutes. Best Val Acc: {best_val_acc:.2f}%")

    # Save version info
    version_info = {
        "version": "1.0.0",
        "model_architecture": "EfficientNet-B0",
        "best_val_accuracy": round(best_val_acc, 2),
        "num_classes": num_classes,
        "classes": class_names,
        "trained_at": datetime.utcnow().isoformat(),
        "epochs_trained": epoch,
        "input_resolution": "224x224",
        "framework": f"PyTorch {torch.__version__}"
    }
    with open(output_dir / "model_version.json", "w") as f:
        json.dump(version_info, f, indent=2)

    logger.info("Saved model_version.json and best_model.pth successfully.")


if __name__ == "__main__":
    main()
