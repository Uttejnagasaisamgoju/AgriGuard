"""
AgriGuard ML — Model Architecture
EfficientNet-B0 transfer learning architecture for Plant Disease Detection.
"""
import torch
import torch.nn as nn
from torchvision import models


class PlantDiseaseEfficientNet(nn.Module):
    """
    EfficientNet-B0 adapted for Plant Disease Classification.
    Uses pretrained weights on ImageNet with custom dropout and linear classification head.
    """
    def __init__(self, num_classes: int = 38, pretrained: bool = True, dropout_rate: float = 0.3):
        super(PlantDiseaseEfficientNet, self).__init__()
        
        # Load backbone
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        self.backbone = models.efficientnet_b0(weights=weights)
        
        # Replace classifier
        in_features = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate, inplace=True),
            nn.Linear(in_features, 512),
            nn.SiLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=dropout_rate / 2),
            nn.Linear(512, num_classes)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)

    def freeze_backbone(self):
        """Freeze feature extraction layers for initial transfer learning epoch"""
        for param in self.backbone.features.parameters():
            param.requires_grad = False

    def unfreeze_backbone(self):
        """Unfreeze all layers for full fine-tuning"""
        for param in self.backbone.features.parameters():
            param.requires_grad = True


def build_model(num_classes: int = 38, pretrained: bool = True, dropout_rate: float = 0.3) -> PlantDiseaseEfficientNet:
    """Helper factory function to instantiate model"""
    return PlantDiseaseEfficientNet(num_classes=num_classes, pretrained=pretrained, dropout_rate=dropout_rate)
