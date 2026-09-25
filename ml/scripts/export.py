#!/usr/bin/env python3
"""
AgriGuard ML Pipeline — Model Export Script
Exports trained PyTorch model to TorchScript and ONNX format.
Usage: python ml/scripts/export.py [--weights ml/weights/best_model.pth] [--format all|torchscript|onnx]
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from ml.scripts.export_model import main

if __name__ == "__main__":
    main()
