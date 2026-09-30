#!/usr/bin/env python3
"""Genera vistas para pantalla; nunca escribe sobre los originales ni el PDF."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
PREVIEWS = ASSETS / "previews"
WIDTHS = (640, 960, 1280)

def generate(source):
    source_hash = sha256(source.read_bytes()).hexdigest()
    versions = []
    with Image.open(source) as original:
        dimensions = original.size
        for width in WIDTHS:
            height = round(original.height * width / original.width)
            preview = original.resize((width, height), Image.Resampling.LANCZOS)
            destination = PREVIEWS / f"{source.stem}-{width}.webp"
            preview.save(destination, "WEBP", lossless=True, method=6)
            with Image.open(destination) as stored:
                assert stored.size == preview.size
                assert stored.convert("RGB").tobytes() == preview.convert("RGB").tobytes()
            versions.append({"file": destination.name, "width": width,
                             "height": height, "bytes": destination.stat().st_size})
    assert sha256(source.read_bytes()).hexdigest() == source_hash
    return {"original": source.name, "dimensions": dimensions,
            "bytes": source.stat().st_size, "sha256": source_hash, "previews": versions}

def main():
    sources = sorted(ASSETS.glob("pagina-??.webp"))
    assert len(sources) == 14, "Se esperan las 14 páginas originales del catálogo."
    PREVIEWS.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = list(pool.map(generate, sources))
    manifest = {"encoding": "WebP lossless", "widths": WIDTHS, "pages": pages}
    (PREVIEWS / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for page in pages:
        sizes = ", ".join(f"{p['width']}: {p['bytes'] / 1024:.0f} KiB" for p in page["previews"])
        print(f"{page['original']} · original {page['bytes'] / 1024 / 1024:.1f} MiB · {sizes}")

if __name__ == "__main__":
    main()
