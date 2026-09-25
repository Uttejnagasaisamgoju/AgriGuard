#!/usr/bin/env python3
"""
AgriGuard ML Pipeline — CLI Test Inference Script
Tests inference on one or more leaf images using the trained PyTorch model.
Usage:
    python ml/scripts/test_inference.py --images path/to/leaf1.jpg [path/to/leaf2.jpg ...]
"""
import sys
import argparse
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AgriGuard-TestInference")


def main():
    parser = argparse.ArgumentParser(description="Test AgriGuard Disease Detection Inference")
    parser.add_argument("--images", nargs="+", required=True, help="List of image paths to test")
    parser.add_argument("--weights", type=str, default="ml/weights/best_model.pth", help="Path to model weights")
    args = parser.parse_args()

    weights_path = Path(args.weights)
    if not weights_path.exists():
        logger.warning(f"Weights file not found at {weights_path}.")
        print("\n=======================================================")
        print("STATUS: MODEL TRAINING PENDING")
        print("Model checkpoint 'best_model.pth' has not been trained yet.")
        print("To train the model on PlantVillage dataset, run:")
        print("    python ml/scripts/prepare_dataset.py")
        print("    python ml/scripts/train.py --epochs 25")
        print("=======================================================\n")
        return

    try:
        from ml.inference.predict import Predictor
        predictor = Predictor(str(weights_path))
        print(f"\nLoaded model: {predictor.model_name} (Version: {predictor.model_version})")
        print(f"Testing {len(args.images)} image(s)...\n")

        for img_path in args.images:
            if not Path(img_path).exists():
                print(f"[-] Image not found: {img_path}")
                continue
            res = predictor.predict(img_path)
            print(f"[+] Image: {img_path}")
            print(f"    Crop: {res.get('crop')} | Disease: {res.get('disease')}")
            print(f"    Confidence: {res.get('confidence') * 100:.1f}% ({res.get('confidence_level')})")
            print(f"    Model Version: {res.get('model_version')}")
            print("-------------------------------------------------------")

    except Exception as e:
        logger.error(f"Inference execution failed: {e}")


if __name__ == "__main__":
    main()
