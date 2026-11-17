#!/usr/bin/env python3
"""Build non-destructive high-density copies of the existing Christmas artwork.

Usage: python tools/generate-christmas-hd.py
Requires: python -m pip install Pillow>=10
This does not alter the original files or activate the generated files.
"""
from pathlib import Path
from PIL import Image
import argparse

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "themes"
SCALES = {
    "background": 3,
    "sideRail": 4,
    "buttonChain": 2,
    "note": 3,
    **{f"prop-{name}": 3 for name in (
        "medical", "drug", "booster", "casino", "addiction", "shopping",
        "flight", "racing", "education", "stocks", "oc", "market"
    )},
}

def tiled_resize(image, scale):
    """Repeat the source before resampling so vertical tile boundaries wrap."""
    width, height = image.size
    padded = Image.new(image.mode, (width, height * 3))
    for row in range(3):
        padded.paste(image, (0, row * height))
    enlarged = padded.resize((width * scale, height * scale * 3), Image.Resampling.LANCZOS)
    return enlarged.crop((0, height * scale, width * scale, height * scale * 2))

def generate(src, dest, scale, vertical_tile=False):
    with Image.open(src) as im:
        im.load()
        before = im.size
        # Pillow correctly resamples RGBA using premultiplied alpha internally.
        image = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        if vertical_tile:
            enlarged = tiled_resize(image, scale)
        else:
            enlarged = image.resize((im.width * scale, im.height * scale), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        enlarged.save(dest, "WEBP", quality=95, method=6, exact=True)
        return before, enlarged.size

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, default=ASSETS)
    args = p.parse_args()
    report = []
    for name, scale in SCALES.items():
        stem = f"christmas2026-{name}"
        source = ASSETS / f"{stem}.webp"
        destination = args.out / f"{stem}-hd.webp"
        if not source.is_file():
            raise SystemExit(f"Missing original: {source}")
        before, after = generate(source, destination, scale,
                                 vertical_tile=name in ("sideRail", "background"))
        report.append((name, before, after, destination))
    for name, before, after, dest in report:
        print(f"{name}: {before[0]}x{before[1]} -> {after[0]}x{after[1]} {dest}")
    print(f"Generated {len(report)} HD images. Original artwork remains unchanged.")
    print("Review the HD images visually before updating theme asset mappings.")

if __name__ == "__main__":
    main()
