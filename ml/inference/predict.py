#!/usr/bin/env python3
"""
AgriGuard ML — CLI Inference Utility
Runs standalone prediction on an individual image file or directory of images.

Usage:
    python ml/inference/predict.py --image path/to/leaf.jpg --weights ml/weights/best_model.pth
"""
import os
import sys
import json
import argparse
from pathlib import Path
from PIL import Image

import torch
import torch.nn.functional as F

# Add project root
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ml.models.efficientnet import build_model
from ml.preprocessing.transforms import get_inference_transforms
from backend.app.services.ml_service import DISEASE_INFO_MAP, DISEASE_RECOMMENDATIONS


def parse_args():
    parser = argparse.ArgumentParser(description="Predict crop disease from image")
    parser.add_argument("--image", type=str, required=True, help="Path to input image")
    parser.add_argument("--weights", type=str, default="ml/weights/best_model.pth", help="Model weights path")
    parser.add_argument("--labels", type=str, default="ml/weights/class_labels.json", help="Class labels JSON path")
    parser.add_argument("--top-k", type=int, default=5, help="Number of top predictions to display")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    return parser.parse_args()


def predict(image_path: str, weights_path: str, labels_path: str, top_k: int = 5, device_str: str = "cpu"):
    device = torch.device(device_str)
    
    with open(labels_path, "r") as f:
        class_labels = json.load(f)

    model = build_model(num_classes=len(class_labels), pretrained=False)
    checkpoint = torch.load(weights_path, map_location=device)
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model = model.to(device)
    model.eval()

    transform = get_inference_transforms()
    img = Image.open(image_path).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probs = F.softmax(outputs, dim=1)[0]

    top_probs, top_indices = torch.topk(probs, min(top_k, len(class_labels)))

    predictions = []
    for prob, idx in zip(top_probs.tolist(), top_indices.tolist()):
        class_name = class_labels[idx]
        info = DISEASE_INFO_MAP.get(class_name, {"crop": "Unknown", "disease": class_name, "category": "other"})
        predictions.append({
            "class_name": class_name,
            "crop": info["crop"],
            "disease": info["disease"],
            "category": info["category"],
            "confidence": round(prob, 4),
            "percentage": f"{round(prob * 100, 2)}%"
        })

    top_result = predictions[0]
    category = top_result["category"]
    recommendations = DISEASE_RECOMMENDATIONS.get(category, [])

    return {
        "file": image_path,
        "primary_prediction": top_result,
        "recommendations": recommendations,
        "top_predictions": predictions
    }


if __name__ == "__main__":
    args = parse_args()
    result = predict(args.image, args.weights, args.labels, args.top_k, args.device)
    print(json.dumps(result, indent=2))
