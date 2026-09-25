#!/usr/bin/env python3
"""
AgriGuard ML — Model Export Utility
Exports PyTorch weights to TorchScript and ONNX formats for low-latency production deployment.
"""
import os
import sys
import json
import argparse
from pathlib import Path

import torch

# Add project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.models.efficientnet import build_model


def export_models(weights_path: str, labels_path: str, output_dir: str):
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(labels_path, "r") as f:
        labels = json.load(f)
    num_classes = len(labels)

    model = build_model(num_classes=num_classes, pretrained=False)
    checkpoint = torch.load(weights_path, map_location="cpu")
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224)

    # 1. TorchScript Export
    ts_path = out_dir / "model.torchscript.pt"
    try:
        traced_script_module = torch.jit.trace(model, dummy_input)
        traced_script_module.save(str(ts_path))
        print(f"[OK] Exported TorchScript model to: {ts_path}")
    except Exception as e:
        print(f"[WARN] TorchScript export failed: {e}")

    # 2. ONNX Export
    onnx_path = out_dir / "model.onnx"
    try:
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
        )
        print(f"[OK] Exported ONNX model to: {onnx_path}")
    except Exception as e:
        print(f"[WARN] ONNX export failed: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default="ml/weights/best_model.pth")
    parser.add_argument("--labels", default="ml/weights/class_labels.json")
    parser.add_argument("--out-dir", default="ml/weights/exported")
    args = parser.parse_args()
    export_models(args.weights, args.labels, args.out_dir)
