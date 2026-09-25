import os
import io
import uuid
import imghdr
import logging
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException
from PIL import Image, ImageOps
from app.core.config import settings

logger = logging.getLogger(__name__)

VALID_IMAGE_SIGNATURES = {
    "jpeg": b"\xff\xd8\xff",
    "png": b"\x89PNG",
    "webp": b"RIFF",
}


class StorageService:
    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / "images").mkdir(exist_ok=True)
        (self.upload_dir / "disease_detection").mkdir(exist_ok=True)
        (self.upload_dir / "profiles").mkdir(exist_ok=True)
        (self.upload_dir / "models").mkdir(exist_ok=True)

    async def save_upload(self, file: UploadFile, subfolder: str = "images") -> str:
        """Validate and save uploaded file, return file path with EXIF orientation corrected"""
        # Read content
        content = await file.read()

        # Validate file signature (magic bytes)
        self._validate_image_signature(content, file.filename)

        # Normalize EXIF orientation (handles phone camera landscape/portrait tags)
        try:
            with Image.open(io.BytesIO(content)) as pil_img:
                transposed = ImageOps.exif_transpose(pil_img)
                out_buf = io.BytesIO()
                img_fmt = pil_img.format or "JPEG"
                if img_fmt.upper() in ["JPEG", "JPG"]:
                    transposed.save(out_buf, format="JPEG", quality=95, optimize=True)
                    content = out_buf.getvalue()
                elif img_fmt.upper() == "PNG":
                    transposed.save(out_buf, format="PNG", optimize=True)
                    content = out_buf.getvalue()
                elif img_fmt.upper() == "WEBP":
                    transposed.save(out_buf, format="WEBP", quality=95)
                    content = out_buf.getvalue()
        except Exception as exif_err:
            logger.debug(f"EXIF transpose skipped or not needed for {file.filename}: {exif_err}")

        # Generate safe filename
        ext = self._get_extension(file.content_type, file.filename)
        safe_name = f"{uuid.uuid4().hex}{ext}"
        save_dir = self.upload_dir / subfolder
        save_dir.mkdir(parents=True, exist_ok=True)
        file_path = save_dir / safe_name

        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        return str(file_path)

    def _validate_image_signature(self, content: bytes, filename: str):
        """Check file magic bytes to prevent disguised executable uploads"""
        if len(content) < 4:
            raise HTTPException(status_code=400, detail=f"Invalid file: {filename}")

        header = content[:4]
        is_valid = (
            header[:3] == VALID_IMAGE_SIGNATURES["jpeg"] or
            header[:4] == VALID_IMAGE_SIGNATURES["png"] or
            header[:4] == VALID_IMAGE_SIGNATURES["webp"]
        )
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {filename}. Must be a real JPEG, PNG, or WEBP image."
            )

    def _get_extension(self, content_type: str, filename: str) -> str:
        ext_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }
        if content_type in ext_map:
            return ext_map[content_type]
        # Fallback: from filename
        if filename and "." in filename:
            return "." + filename.rsplit(".", 1)[-1].lower()
        return ".jpg"

    def get_url(self, file_path: str) -> str:
        """Convert file path to URL"""
        name = Path(file_path).name
        parent = Path(file_path).parent.name
        return f"/uploads/{parent}/{name}"
