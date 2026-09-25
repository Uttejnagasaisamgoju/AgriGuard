"""
AgriGuard AI Image Enhancement Service — Real OpenCV-based image preprocessing.
Performs CLAHE contrast adaptation, bilateral edge-preserving denoising,
unsharp mask feature sharpening, and glare mitigation for crop foliage.
"""
import os
import cv2
import numpy as np
import logging
from pathlib import Path
from typing import Dict, Any, Tuple
import uuid
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


def read_upright_bgr(image_path: str) -> np.ndarray:
    """Reads image ensuring EXIF orientation is respected and converted to BGR for OpenCV"""
    try:
        with Image.open(str(image_path)) as pil_img:
            transposed = ImageOps.exif_transpose(pil_img).convert("RGB")
            rgb_arr = np.array(transposed)
            return cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
    except Exception as e:
        logger.debug(f"Pillow orientation read fallback to cv2.imread: {e}")
        return cv2.imread(str(image_path))


class ImageEnhancementService:
    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = Path(upload_dir)
        self.enhanced_dir = self.upload_dir / "enhanced"
        self.enhanced_dir.mkdir(parents=True, exist_ok=True)

    def enhance_crop_image(self, input_path: str) -> Dict[str, Any]:
        """
        Runs real computer-vision enhancements on a crop disease photo:
        1. LAB Color Space CLAHE (Contrast-Limited Adaptive Histogram Equalization)
        2. Bilateral filtering for noise removal while preserving crisp vein/lesion borders
        3. Unsharp masking to accentuate fungal spot margins and pathogen structures
        4. Glare/specular highlight mitigation for leaves
        """
        try:
            p = Path(input_path)
            # Idempotency check: if already enhanced, avoid secondary CLAHE re-processing
            if p.parent.name == "enhanced" or p.stem.startswith("enh_") or p.stem.startswith("enhanced_"):
                logger.info(f"Image already enhanced: {input_path}")
                img = read_upright_bgr(str(input_path))
                h, w = (img.shape[:2]) if img is not None else (0, 0)
                return {
                    "success": True,
                    "original_path": str(input_path),
                    "enhanced_path": str(input_path),
                    "enhanced_url": f"/uploads/enhanced/{p.name}" if p.parent.name == "enhanced" else f"/uploads/{p.name}",
                    "enhancements_applied": [
                        "LAB-CLAHE Lighting & Contrast Equalization",
                        "Bilateral Foliage Denoising",
                        "Unsharp Mask Pathogen Border Sharpening",
                        "Specular Glare Suppression",
                    ],
                    "dimensions": {"width": w, "height": h},
                }

            # Read image ensuring proper upright orientation
            img = read_upright_bgr(str(input_path))
            if img is None:
                raise ValueError(f"Unable to read image at {input_path}")

            h, w = img.shape[:2]

            # 1. LAB CLAHE (Equalizes illumination across leaves without shifting hues)
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)
            
            clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
            cl_channel = clahe.apply(l_channel)
            
            merged_lab = cv2.merge((cl_channel, a_channel, b_channel))
            contrast_enhanced = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)

            # 2. Bilateral Filter (Removes camera sensor grain, keeps lesion boundaries razor-sharp)
            denoised = cv2.bilateralFilter(contrast_enhanced, d=7, sigmaColor=45, sigmaSpace=45)

            # 3. Unsharp Masking (High-pass boost to make disease symptoms easily detectable)
            gaussian = cv2.GaussianBlur(denoised, (0, 0), sigmaX=2.0)
            sharpened = cv2.addWeighted(denoised, 1.35, gaussian, -0.35, 0)
            sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

            # 4. Glare attenuation on waxy leaves
            gray = cv2.cvtColor(sharpened, cv2.COLOR_BGR2GRAY)
            _, glare_mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)
            if cv2.countNonZero(glare_mask) > 0:
                glare_mask_dilated = cv2.dilate(glare_mask, np.ones((3, 3), np.uint8), iterations=1)
                final_img = cv2.inpaint(sharpened, glare_mask_dilated, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
            else:
                final_img = sharpened

            # Generate output filename
            base_name = Path(input_path).stem
            enhanced_filename = f"enh_{uuid.uuid4().hex[:8]}_{base_name}.jpg"
            output_path = self.enhanced_dir / enhanced_filename

            # Save enhanced image with high JPEG quality
            cv2.imwrite(str(output_path), final_img, [cv2.IMWRITE_JPEG_QUALITY, 95])

            logger.info(f"Enhanced crop photo: {input_path} -> {output_path}")

            return {
                "success": True,
                "original_path": str(input_path),
                "enhanced_path": str(output_path),
                "enhanced_url": f"/uploads/enhanced/{enhanced_filename}",
                "enhancements_applied": [
                    "LAB-CLAHE Lighting & Contrast Equalization",
                    "Bilateral Foliage Denoising",
                    "Unsharp Mask Pathogen Border Sharpening",
                    "Specular Glare Suppression",
                ],
                "dimensions": {"width": w, "height": h},
            }

        except Exception as e:
            logger.error(f"Image enhancement error on {input_path}: {e}")
            return {
                "success": False,
                "error": str(e),
                "original_path": str(input_path),
                "enhanced_path": str(input_path),
                "enhanced_url": f"/uploads/{Path(input_path).name}",
            }
