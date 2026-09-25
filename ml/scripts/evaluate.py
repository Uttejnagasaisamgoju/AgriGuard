#!/usr/bin/env python3
"""
AgriGuard ML Pipeline — Evaluation Script Runner
Usage: python ml/scripts/evaluate.py [--weights ml/weights/best_model.pth] [--test-dir ml/datasets/split/test]
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from ml.evaluation.evaluate import main

if __name__ == "__main__":
    main()
