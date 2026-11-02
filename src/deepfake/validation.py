"""Safe input validation for DeepGuard image uploads."""
from io import BytesIO
from typing import Any
from PIL import Image, UnidentifiedImageError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_MAX_BYTES = 10 * 1024 * 1024

class ImageValidationError(ValueError):
    pass


def validate_image_bytes(content: bytes, filename: str, content_type: str | None = None, max_bytes: int = DEFAULT_MAX_BYTES) -> dict[str, Any]:
    if not content:
        raise ImageValidationError("Uploaded image is empty.")
    if len(content) > max_bytes:
        raise ImageValidationError(f"Image exceeds the maximum allowed size of {max_bytes // (1024 * 1024)} MB.")
    suffix = "." + filename.rsplit(".", 1)[1].lower() if "." in filename else ""
    if suffix not in ALLOWED_EXTENSIONS:
        raise ImageValidationError("Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.")
    allowed_mime = {"image/jpeg", "image/png", "image/webp"}
    if content_type and content_type not in allowed_mime:
        raise ImageValidationError("Unsupported MIME type. Allowed types: image/jpeg, image/png, image/webp.")
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
        with Image.open(BytesIO(content)) as image:
            image.load()
            width, height, fmt = image.width, image.height, (image.format or "").upper()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageValidationError("The uploaded file is not a valid readable image.") from exc
    if width <= 0 or height <= 0:
        raise ImageValidationError("Image dimensions are invalid.")
    return {"filename": filename, "content_type": content_type, "format": fmt, "width": width, "height": height, "size_bytes": len(content)}
