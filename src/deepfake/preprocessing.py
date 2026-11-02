"""Input preprocessing for the DF40 CLIP image detector."""
from pathlib import Path
from PIL import Image


def load_image(path: str | Path) -> Image.Image:
    image = Image.open(path)
    return image.convert("RGB")
