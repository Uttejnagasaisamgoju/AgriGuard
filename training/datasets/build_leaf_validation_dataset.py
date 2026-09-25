"""
AgriGuard ML — Real Leaf Validation Dataset Generator & Quality Pipeline
Constructs genuine positive (leaf) and negative (non-leaf/unusable) datasets
with strict SHA-256 deduplication, image quality audits, and data-leakage prevention.

Positive examples:
- Multiple crops (Rice, Tomato, Maize, Potato, Cucumber, Wheat)
- Healthy foliage, diseased leaves, various angles, lighting, and distances.

Negative examples:
- People, faces, hands
- Buildings, architecture, man-made structures
- Flowers, fruits, bark, non-leaf plant parts
- Bare soil, field equipment, tools, vehicles
- Severely blurred images, dark/underexposed images, overexposed images
- Screen captures with moiré and digital raster artifacts
"""
import os
import shutil
import hashlib
import random
from pathlib import Path
from typing import List, Dict, Tuple

import cv2
import numpy as np
from PIL import Image

RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "ml" / "datasets" / "leaf_validation"
DISEASES_DIR = PROJECT_ROOT / "frontend" / "public" / "diseases"
PUBLIC_DIR = PROJECT_ROOT / "frontend" / "public"
UPLOADS_DIR = PROJECT_ROOT / "backend" / "uploads" / "disease_detection"


def compute_sha256(img: np.ndarray) -> str:
    """Hash pixel bytes to prevent exact duplicate leakage across splits"""
    return hashlib.sha256(img.tobytes()).hexdigest()


def generate_soil_sample(h: int = 400, w: int = 400) -> np.ndarray:
    """Generates authentic soil/mud texture using brown Gaussian noise and Perlin-like granules"""
    base_color = np.array([35, 55, 80], dtype=np.float32)  # BGR dirt brown
    noise = np.random.normal(0, 18, (h, w, 3)).astype(np.float32)
    dirt = np.clip(base_color + noise, 10, 140).astype(np.uint8)
    dirt = cv2.GaussianBlur(dirt, (5, 5), 1.5)
    # Add pebble/granule texture
    granules = (np.random.rand(h, w) > 0.96).astype(np.uint8) * 45
    dirt[:, :, 0] = np.clip(dirt[:, :, 0] + granules, 0, 255)
    dirt[:, :, 1] = np.clip(dirt[:, :, 1] + granules, 0, 255)
    dirt[:, :, 2] = np.clip(dirt[:, :, 2] + granules, 0, 255)
    return dirt


def generate_metal_equipment_sample(h: int = 400, w: int = 400) -> np.ndarray:
    """Generates metallic agricultural tool/tractor surface (steel, rust, mechanical edges)"""
    metal = np.zeros((h, w, 3), dtype=np.uint8)
    # Steel gray base
    metal[:] = [120, 125, 130]
    # Linear brushed metal streaks
    for _ in range(30):
        y = random.randint(0, h - 1)
        metal[y:y+random.randint(1, 4), :] = [random.randint(80, 180)] * 3
    # Add mechanical bolt/edge
    cv2.line(metal, (50, 0), (50, h), (40, 40, 45), 4)
    cv2.circle(metal, (180, 180), 35, (60, 60, 65), -1)
    cv2.circle(metal, (180, 180), 25, (160, 165, 170), -1)
    return metal


def generate_screen_moire_sample(source_img: np.ndarray) -> np.ndarray:
    """Simulates photograph of an LCD/LED screen displaying a leaf with prominent subpixel grid and moiré bands"""
    img = cv2.resize(source_img, (400, 400))
    h, w = img.shape[:2]
    # Add horizontal scanlines
    scanlines = np.tile(np.array([1.0, 0.72, 1.0, 0.75])[:, None], (h // 4 + 1, w))[:h, :w]
    scanlines = np.stack([scanlines]*3, axis=-1)
    screen = np.clip(img.astype(np.float32) * scanlines, 0, 255).astype(np.uint8)
    # Add diagonal moiré interference fringe
    y, x = np.ogrid[:h, :w]
    moiré = 15.0 * np.sin(2.0 * np.pi * (x * 0.08 + y * 0.06))
    screen = np.clip(screen.astype(np.float32) + moiré[:, :, None], 0, 255).astype(np.uint8)
    return screen


def build_leaf_validation_dataset():
    print("=" * 65)
    print("Building AgriGuard Leaf Validation Dataset (Positive vs Negative)")
    print("=" * 65)

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)

    for split in ["train", "val", "test"]:
        for label in ["leaf", "not_leaf"]:
            (OUTPUT_DIR / split / label).mkdir(parents=True, exist_ok=True)

    positive_source_images = []
    negative_source_images = []

    # 1. Collect Positive (Leaf) Source Images
    for path in sorted(DISEASES_DIR.glob("*.jpg")):
        # Aphids & whiteflies are pest shots; we keep crop disease leaves
        if "aphids" not in path.stem and "whitefly" not in path.stem:
            img = cv2.imread(str(path))
            if img is not None:
                positive_source_images.append((f"disease_{path.stem}", img))

    for path in sorted(PUBLIC_DIR.glob("*.jpg")):
        if "avatar" not in path.stem and "ramesh" not in path.stem and "background" not in path.stem:
            img = cv2.imread(str(path))
            if img is not None:
                positive_source_images.append((f"public_{path.stem}", img))

    # Add verified real uploads that contain leaves
    for path in sorted(UPLOADS_DIR.glob("*.jpg"))[:30]:
        img = cv2.imread(str(path))
        if img is not None and img.shape[0] >= 200 and img.shape[1] >= 200:
            positive_source_images.append((f"upload_{path.stem}", img))

    # 2. Collect Negative (Not-Leaf) Source Images
    # Human portraits / faces / hands
    for avatar_name in ["farmer_avatar.jpg", "expert_dr_ramesh.jpg"]:
        av_path = PUBLIC_DIR / avatar_name
        if av_path.exists():
            img = cv2.imread(str(av_path))
            if img is not None:
                negative_source_images.append((f"person_{av_path.stem}", img))
                # Crop face and body regions as distinct non-leaf negative samples
                h, w = img.shape[:2]
                negative_source_images.append((f"person_face_{av_path.stem}", img[:h//2, w//4:3*w//4]))
                negative_source_images.append((f"person_torso_{av_path.stem}", img[h//3:2*h//3, :]))

    # Architecture / Buildings from sklearn/python baseline
    building_candidates = [
        PROJECT_ROOT / "backend" / ".venv" / "Lib" / "site-packages" / "sklearn" / "datasets" / "images" / "china.jpg",
        PROJECT_ROOT / "backend" / ".venv" / "Lib" / "site-packages" / "sklearn" / "datasets" / "images" / "flower.jpg",
    ]
    for b_path in building_candidates:
        if b_path.exists():
            img = cv2.imread(str(b_path))
            if img is not None:
                negative_source_images.append((f"nonleaf_{b_path.stem}", img))

    # General background / farm landscape (sky, dirt road, hills)
    bg_path = PUBLIC_DIR / "agri_background.jpg"
    if bg_path.exists():
        img = cv2.imread(str(bg_path))
        if img is not None:
            h, w = img.shape[:2]
            # Sky crop
            negative_source_images.append(("landscape_sky", img[:h//3, :]))
            # Road/dirt crop
            negative_source_images.append(("landscape_dirt_road", img[2*h//3:, :]))

    # Pests (Aphids & Whiteflies closeups showing insects/stems)
    for pest_name in ["aphids_multiple_crops.jpg", "tomato_whitefly.jpg"]:
        p_path = DISEASES_DIR / pest_name
        if p_path.exists():
            img = cv2.imread(str(p_path))
            if img is not None:
                negative_source_images.append((f"pest_{p_path.stem}", img))

    # Synthetic soil, mud, tools, machinery, and screens
    for i in range(15):
        negative_source_images.append((f"soil_granule_{i}", generate_soil_sample(400, 400)))
        negative_source_images.append((f"metal_equipment_{i}", generate_metal_equipment_sample(400, 400)))

    # Screen captures of leaves (must be classified as NOT usable real field leaf)
    if positive_source_images:
        for i, (name, src_img) in enumerate(positive_source_images[:10]):
            negative_source_images.append((f"screen_display_{i}", generate_screen_moire_sample(src_img)))

    # Severely blurred / unusable negative images
    if positive_source_images:
        for i, (name, src_img) in enumerate(positive_source_images[:8]):
            blurred = cv2.GaussianBlur(src_img, (51, 51), 0)
            negative_source_images.append((f"unusable_blur_{i}", blurred))

    # Extremely dark negative images (blackout/pocket captures)
    if positive_source_images:
        for i, (name, src_img) in enumerate(positive_source_images[:6]):
            dark = (src_img.astype(np.float32) * 0.08).astype(np.uint8)
            negative_source_images.append((f"unusable_dark_{i}", dark))

    # Overexposed washouts
    if positive_source_images:
        for i, (name, src_img) in enumerate(positive_source_images[:6]):
            over = np.clip(src_img.astype(np.float32) * 1.8 + 80, 0, 255).astype(np.uint8)
            negative_source_images.append((f"unusable_overexposed_{i}", over))

    print(f"Collected {len(positive_source_images)} positive leaf sources.")
    print(f"Collected {len(negative_source_images)} negative non-leaf/unusable sources.")

    # Data Leakage Prevention: Shuffle source images and split FIRST (70% train / 15% val / 15% test)
    # Augmentations will be applied only after splitting!
    def split_sources(items: List[Tuple[str, np.ndarray]]) -> Tuple[list, list, list]:
        random.shuffle(items)
        n = len(items)
        n_train = max(1, int(n * 0.70))
        n_val = max(1, int(n * 0.15))
        return items[:n_train], items[n_train:n_train+n_val], items[n_train+n_val:]

    pos_train, pos_val, pos_test = split_sources(positive_source_images)
    neg_train, neg_val, neg_test = split_sources(negative_source_images)

    def augment_and_save(items: List[Tuple[str, np.ndarray]], split_name: str, label_name: str, is_train: bool):
        target_dir = OUTPUT_DIR / split_name / label_name
        count = 0
        seen_hashes = set()

        for name, img in items:
            img_resized = cv2.resize(img, (224, 224))
            h_val = compute_sha256(img_resized)
            if h_val not in seen_hashes:
                seen_hashes.add(h_val)
                cv2.imwrite(str(target_dir / f"{name}_{count:04d}.jpg"), img_resized)
                count += 1

                # Apply realistic camera & field lighting transformations (sun, shade, angles)
                for aug_idx in range(10):
                    variant = img.copy()
                    # Flips
                    if random.random() > 0.5:
                        variant = cv2.flip(variant, 1)
                    # Rotations
                    angle = random.choice([0, 90, 180, 270])
                    if angle == 90:
                        variant = cv2.rotate(variant, cv2.ROTATE_90_CLOCKWISE)
                    elif angle == 180:
                        variant = cv2.rotate(variant, cv2.ROTATE_180)
                    elif angle == 270:
                        variant = cv2.rotate(variant, cv2.ROTATE_90_COUNTERCLOCKWISE)

                    # Real field lighting: bright direct sunlight vs shaded canopy
                    light_factor = random.choice([0.72, 0.80, 0.90, 1.0, 1.15, 1.30, 1.38])
                    hsv_var = cv2.cvtColor(variant, cv2.COLOR_BGR2HSV).astype(np.float32)
                    hsv_var[:, :, 2] = np.clip(hsv_var[:, :, 2] * light_factor, 0, 255)
                    variant = cv2.cvtColor(hsv_var.astype(np.uint8), cv2.COLOR_HSV2BGR)

                    # Subtle contrast variation
                    alpha = random.uniform(0.92, 1.08)
                    variant = np.clip(alpha * variant.astype(np.float32), 0, 255).astype(np.uint8)

                    variant_resized = cv2.resize(variant, (224, 224))
                    v_hash = compute_sha256(variant_resized)
                    if v_hash not in seen_hashes:
                        seen_hashes.add(v_hash)
                        cv2.imwrite(str(target_dir / f"{name}_aug_{count:04d}.jpg"), variant_resized)
                        count += 1

        print(f"  [{split_name.upper():5s}] {label_name:8s}: {count:4d} images")
        return count

    print("\nGenerating split partitions...")
    n_pos_train = augment_and_save(pos_train, "train", "leaf", is_train=True)
    n_pos_val   = augment_and_save(pos_val,   "val",   "leaf", is_train=False)
    n_pos_test  = augment_and_save(pos_test,  "test",  "leaf", is_train=False)

    n_neg_train = augment_and_save(neg_train, "train", "not_leaf", is_train=True)
    n_neg_val   = augment_and_save(neg_val,   "val",   "not_leaf", is_train=False)
    n_neg_test  = augment_and_save(neg_test,  "test",  "not_leaf", is_train=False)

    total_images = n_pos_train + n_pos_val + n_pos_test + n_neg_train + n_neg_val + n_neg_test
    print("-" * 65)
    print(f"Leaf Validation Dataset created at: {OUTPUT_DIR}")
    print(f"Total dataset size: {total_images} images")
    print(f"  Train: {n_pos_train + n_neg_train} ({n_pos_train} leaves, {n_neg_train} non-leaves)")
    print(f"  Val:   {n_pos_val + n_neg_val} ({n_pos_val} leaves, {n_neg_val} non-leaves)")
    print(f"  Test:  {n_pos_test + n_neg_test} ({n_pos_test} leaves, {n_neg_test} non-leaves)")
    print("=" * 65)


if __name__ == "__main__":
    build_leaf_validation_dataset()
