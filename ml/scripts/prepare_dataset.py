#!/usr/bin/env python3
"""
AgriGuard ML — Dataset Preparation Script
Downloads and prepares PlantVillage dataset for training.

Usage:
    python ml/scripts/prepare_dataset.py

The PlantVillage dataset contains 38 classes of plant diseases.
Download from: https://www.kaggle.com/datasets/emmarex/plantdisease
Or use the Kaggle API: kaggle datasets download -d emmarex/plantdisease
"""
import os
import sys
import shutil
import json
import random
from pathlib import Path
from typing import Tuple, List

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

DATASET_ROOT = Path(__file__).parent.parent / "datasets"
RAW_DIR = DATASET_ROOT / "raw"
PROCESSED_DIR = DATASET_ROOT / "processed"
SPLIT_DIR = DATASET_ROOT / "split"

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15
RANDOM_SEED = 42
MIN_IMAGES_PER_CLASS = 10


def validate_images(directory: Path) -> Tuple[List[Path], List[Path]]:
    """Validate images and separate good/corrupt files"""
    valid = []
    corrupt = []

    try:
        from PIL import Image
    except ImportError:
        print("Pillow not installed. Run: pip install Pillow")
        sys.exit(1)

    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
    image_files = [f for f in directory.rglob("*") if f.suffix.lower() in image_extensions]

    print(f"Scanning {len(image_files)} images in {directory}...")

    for i, img_path in enumerate(image_files):
        if i % 1000 == 0:
            print(f"  Validated {i}/{len(image_files)}...")
        try:
            with Image.open(img_path) as img:
                img.verify()
            valid.append(img_path)
        except Exception:
            corrupt.append(img_path)
            print(f"  CORRUPT: {img_path}")

    print(f"  Valid: {len(valid)}, Corrupt: {len(corrupt)}")
    return valid, corrupt


def split_dataset(class_dir: Path, output_dir: Path, class_name: str):
    """Split a class directory into train/val/test"""
    from PIL import Image

    valid_files, _ = validate_images(class_dir)

    if len(valid_files) < MIN_IMAGES_PER_CLASS:
        print(f"  Skipping '{class_name}': only {len(valid_files)} valid images (minimum {MIN_IMAGES_PER_CLASS})")
        return 0, 0, 0

    random.shuffle(valid_files)

    n = len(valid_files)
    n_train = int(n * TRAIN_RATIO)
    n_val = int(n * VAL_RATIO)

    splits = {
        "train": valid_files[:n_train],
        "val": valid_files[n_train:n_train + n_val],
        "test": valid_files[n_train + n_val:],
    }

    counts = {}
    for split_name, files in splits.items():
        split_class_dir = output_dir / split_name / class_name
        split_class_dir.mkdir(parents=True, exist_ok=True)

        for src in files:
            dst = split_class_dir / src.name
            shutil.copy2(str(src), str(dst))

        counts[split_name] = len(files)

    return counts.get("train", 0), counts.get("val", 0), counts.get("test", 0)


def prepare_dataset(raw_dataset_path: str = None):
    """Main dataset preparation function"""
    random.seed(RANDOM_SEED)

    if raw_dataset_path:
        raw_path = Path(raw_dataset_path)
    else:
        raw_path = RAW_DIR / "PlantVillage"

    if not raw_path.exists():
        print(f"""
ERROR: Dataset not found at {raw_path}

To get the PlantVillage dataset:

Option 1 — Kaggle (recommended):
  1. Install kaggle: pip install kaggle
  2. Configure API: https://www.kaggle.com/docs/api
  3. Run: kaggle datasets download -d emmarex/plantdisease
  4. Extract to: {RAW_DIR}/PlantVillage/

Option 2 — Manual download:
  1. Go to: https://www.kaggle.com/datasets/emmarex/plantdisease
  2. Download and extract
  3. Place class folders in: {RAW_DIR}/PlantVillage/

Option 3 — TensorFlow Datasets (automatic):
  python ml/scripts/download_tfds.py

Expected structure:
  {RAW_DIR}/PlantVillage/
    Apple___Apple_scab/
    Apple___Black_rot/
    ...
""")
        sys.exit(1)

    # Find class directories
    class_dirs = [d for d in raw_path.iterdir() if d.is_dir()]
    if not class_dirs:
        # Maybe nested one level deeper
        for sub in raw_path.iterdir():
            if sub.is_dir():
                class_dirs = [d for d in sub.iterdir() if d.is_dir()]
                if class_dirs:
                    raw_path = sub
                    break

    if not class_dirs:
        print(f"No class directories found in {raw_path}")
        sys.exit(1)

    print(f"\nFound {len(class_dirs)} classes")
    print(f"Output directory: {SPLIT_DIR}\n")
    SPLIT_DIR.mkdir(parents=True, exist_ok=True)

    total_stats = {"classes": [], "train": 0, "val": 0, "test": 0}

    for class_dir in sorted(class_dirs):
        class_name = class_dir.name
        print(f"Processing: {class_name}")
        n_train, n_val, n_test = split_dataset(class_dir, SPLIT_DIR, class_name)
        if n_train > 0:
            total_stats["classes"].append({
                "name": class_name,
                "train": n_train,
                "val": n_val,
                "test": n_test,
                "total": n_train + n_val + n_test,
            })
            total_stats["train"] += n_train
            total_stats["val"] += n_val
            total_stats["test"] += n_test
            print(f"  train={n_train}, val={n_val}, test={n_test}")

    # Save dataset metadata
    meta = {
        "num_classes": len(total_stats["classes"]),
        "classes": [c["name"] for c in total_stats["classes"]],
        "train_images": total_stats["train"],
        "val_images": total_stats["val"],
        "test_images": total_stats["test"],
        "total_images": total_stats["train"] + total_stats["val"] + total_stats["test"],
        "split_ratios": {"train": TRAIN_RATIO, "val": VAL_RATIO, "test": TEST_RATIO},
        "random_seed": RANDOM_SEED,
    }

    meta_path = SPLIT_DIR / "dataset_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    # Save class labels
    labels_path = DATASET_ROOT / "class_labels.json"
    with open(labels_path, "w") as f:
        json.dump(meta["classes"], f, indent=2)

    print(f"""
Dataset preparation complete!
================================
Classes: {meta['num_classes']}
Train images: {meta['train_images']}
Val images: {meta['val_images']}
Test images: {meta['test_images']}
Total: {meta['total_images']}

Next step: python ml/scripts/train.py
""")
    return meta


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Prepare PlantVillage dataset")
    parser.add_argument("--dataset", type=str, help="Path to raw dataset directory", default=None)
    args = parser.parse_args()
    prepare_dataset(args.dataset)
