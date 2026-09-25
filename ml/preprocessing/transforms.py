"""
AgriGuard ML — Data Preprocessing & Augmentation Pipeline
Transforms designed for robust leaf disease classification under varying lighting, orientation, and resolution.
"""
from typing import Tuple
from torchvision import transforms


def get_train_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Data augmentation pipeline for training:
    - Random resized crop to handle different zoom levels
    - Random horizontal and vertical flips
    - Random affine rotation and perspective for natural leaf angles
    - Color jitter for varying field sunlight/cloud conditions
    - ImageNet normalization
    """
    return transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(degrees=25),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])


def get_val_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Validation and test evaluation transform pipeline:
    - Deterministic resize to 256
    - Center crop to target input dimension
    - ImageNet normalization
    """
    return transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])


def get_inference_transforms(image_size: int = 224) -> transforms.Compose:
    """Inference transform for single images submitted via mobile or web client"""
    return get_val_transforms(image_size=image_size)
