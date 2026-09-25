#!/usr/bin/env python3
"""
AgriGuard ML Pipeline — Training Script Runner
Usage: python ml/scripts/train.py [--epochs 25] [--batch-size 32]
"""
import sys
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from ml.training.train import main

if __name__ == "__main__":
    main()
