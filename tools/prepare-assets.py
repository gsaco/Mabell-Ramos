#!/usr/bin/env python3
"""Build public derivatives without changing source images or the catalogue.

Requirements: Pillow, fonttools[woff], Brotli (only needed for font conversion).
Run from any directory: python3 tools/prepare-assets.py
Originals are retained under assets-source/originals and never overwritten.
"""

from __future__ import annotations

import base64
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "assets-source" / "originals"
VECTORS = REPO / "assets-source" / "vectors"
OUT = REPO / "docs" / "assets" / "web"
INK = "#432653"
SOFT = "#E8DDF2"
CANVAS = "#FBF8F4"

ENTRIES: list[dict] = []


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def register(path: Path, *, kind: str, source: str, alt: str = "", use: str,
             status: str = "ready", notes: str = "", **extra) -> None:
    entry = {
        "file": path.relative_to(REPO).as_posix(), "kind": kind,
        "source": source, "alt": alt, "usage": use, "status": status,
        "bytes": path.stat().st_size, "sha256": sha256(path), "notes": notes,
        **extra,
    }
    if path.suffix.lower() in {".png", ".webp", ".jpg", ".avif"}:
        with Image.open(path) as image:
            entry.update(width=image.width, height=image.height,
                         transparency=image.mode in {"RGBA", "LA"})
    ENTRIES.append(entry)


def responsive_image(stem: str, widths: list[int], *, alt: str) -> None:
    path = SOURCE / f"{stem}.png"
    with Image.open(path) as original:
        original.load()
        for width in widths:
            if width > original.width:
                raise ValueError(f"Upscaling is forbidden: {stem} {width}px")
            height = round(original.height * width / original.width)
            image = original.resize((width, height), Image.Resampling.LANCZOS)
            destination = OUT / f"{stem}-{width}.webp"
            image.save(destination, "WEBP", quality=96, method=6,
                       exact=True, minimize_size=False)
            register(destination, kind="illustration-reference", source=str(path.relative_to(REPO)),
                     alt=alt, use="editorial decoration with visible reference caption",
                     notes="Built-in image generation, catalogue-inspired editorial series v2. Not a verified photograph or proof of package contents. Native master preserved; separate responsive derivative.",
                     source_sha256=sha256(path))
            avif = OUT / f"{stem}-{width}.avif"
            image.save(avif, "AVIF", quality=85, speed=6)
            register(avif, kind="illustration-reference", source=str(path.relative_to(REPO)),
                     alt=alt, use="high-quality responsive editorial image; WebP fallback retained",
                     notes="Separate AVIF derivative at quality 85. Native PNG master remains unchanged. Not a verified merchandise photograph.",
                     source_sha256=sha256(path))


def authentic_logo() -> Image.Image:
    """Extract exactly the original mark, preserving lettering and native color.

    The source page is 1138×1526. Its original badge is at 827,584–1125,879.
    Crop has 298×295 native pixels; no enlargement or AI reconstruction is used.
    A circular alpha mask removes the page's outer paper only.
    """
    original = Image.open(SOURCE / "fuente-logo-mabell.png").convert("RGBA")
    if original.size != (1138, 1526):
        raise ValueError("Logo source dimensions changed: review crop before use")
    logo = original.crop((827, 584, 1125, 879))
    scale = 4
    mask = Image.new("L", (logo.width * scale, logo.height * scale), 0)
    ImageDraw.Draw(mask).ellipse((3 * scale, 3 * scale, 294 * scale, 290 * scale), fill=255)
    mask = mask.resize(logo.size, Image.Resampling.LANCZOS)
    logo.putalpha(mask)
    logo.save(OUT / "logo.png", optimize=True)
    register(OUT / "logo.png", kind="brand-original-crop",
             source="assets-source/originals/fuente-logo-mabell.png",
             alt="Mabell Ramos", use="header and footer",
             notes="Native-size deterministic crop of the original badge; letters and interior colors preserved. Compare original rather than using reconstructed sello_mabell.png.",
             crop=[827, 584, 1125, 879])
    for width in [128, 256]:
        image = logo.resize((width, round(logo.height * width / logo.width)), Image.Resampling.LANCZOS)
        destination = OUT / f"logo-{width}.webp"
        image.save(destination, "WEBP", lossless=True, method=6, exact=True)
        register(destination, kind="brand-original-crop", source="docs/assets/web/logo.png",
                 alt="Mabell Ramos", use="responsive header and footer",
                 notes="Losslessly encoded derivative; original native logo remains available.")
    for size, name in [(32, "favicon-32.png"), (180, "apple-touch-icon.png")]:
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        image = logo.copy()
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        canvas.alpha_composite(image, ((size-image.width)//2, (size-image.height)//2))
        destination = OUT / name
        canvas.save(destination, optimize=True)
        register(destination, kind="brand-original-crop", source="docs/assets/web/logo.png",
                 alt="", use="browser icon")
    encoded = base64.b64encode((OUT / "logo-128.webp").read_bytes()).decode()
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><image width="128" height="127" y=".5" href="data:image/webp;base64,{encoded}"/></svg>\n'
    (OUT / "favicon.svg").write_text(svg)
    register(OUT / "favicon.svg", kind="brand-original-crop", source="docs/assets/web/logo-128.webp",
             use="browser favicon; PNG fallback supplied")
    return logo


def fonts() -> None:
    for weight in [400, 600]:
        destination = OUT / f"inter-{weight}.woff2"
        shutil.copyfile(SOURCE / f"inter-latin-{weight}.woff2", destination)
        register(destination, kind="font", source=f"assets-source/originals/inter-latin-{weight}.woff2",
                 use="body, labels and controls", license="SIL OFL 1.1", weight=weight,
                 notes="Inter latin subset includes accented Spanish glyphs; local hosting.")
    try:
        from fontTools.ttLib import TTFont
        font = TTFont(SOURCE / "bodoni-moda-600.ttf", recalcTimestamp=False)
        font.flavor = "woff2"
        font.save(OUT / "bodoni-moda-600.woff2")
    except ImportError as error:
        existing = OUT / "bodoni-moda-600.woff2"
        if not existing.exists():
            raise RuntimeError("Install fonttools[woff] and Brotli to create Bodoni WOFF2") from error
    register(OUT / "bodoni-moda-600.woff2", kind="font", source="assets-source/originals/bodoni-moda-600.ttf",
             use="editorial headings, 28px and larger", license="SIL OFL 1.1", weight=600,
             notes="Local WOFF2 conversion preserves glyph shapes and kerning.")
    for name in ["Inter-OFL.txt", "BodoniModa-OFL.txt"]:
        shutil.copyfile(SOURCE / name, OUT / name)


def svg_assets() -> None:
    branch_paths = '''<path d="M52 226C67 190 79 151 119 113C142 91 166 61 194 27"/>
<path d="M69 186C41 180 24 157 31 132C58 132 77 150 69 186Z"/>
<path d="M92 150C98 123 122 108 148 116C145 143 124 156 92 150Z"/>
<path d="M120 112C91 103 76 80 84 56C111 61 127 82 120 112Z"/>
<path d="M154 75C159 48 180 30 205 34C204 59 186 78 154 75Z"/>
<path d="M190 31C170 20 162 9 166 0C183 2 193 13 190 31Z"/>
<path d="M68 182L42 144M95 147L136 125M118 108L94 68M157 72L193 46M189 28L172 8" opacity=".55"/>'''
    branch = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="{INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{branch_paths}</svg>\n'
    pattern = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" fill="none">
<defs><g id="branch" stroke="{SOFT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{branch_paths}</g></defs>
<use href="#branch" transform="translate(24 14) rotate(-13 85 105) scale(.56)"/>
<use href="#branch" transform="translate(217 205) rotate(167 42 53) scale(.46)"/>
</svg>\n'''
    arc = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" fill="none" stroke="{INK}" stroke-width="1.25">
<path d="M20 469V211C20 99 101 19 200 19C299 19 380 99 380 211V469"/>
<path d="M37 454V211C37 109 111 37 200 37C289 37 363 109 363 211V454" opacity=".35"/>
</svg>\n'''
    native = {"rama-marca.svg": branch, "patron-botanico.svg": pattern, "marco-arco.svg": arc,
              "editorial-rule.svg": f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 24" fill="none"><path d="M0 12H207M273 12H480" stroke="{INK}" stroke-width="1" opacity=".3"/><path d="M230 12C233 4 240 3 246 4C245 11 239 15 230 12ZM242 14C246 8 253 8 258 10C256 16 250 18 242 14Z" stroke="{INK}" stroke-width="1.2"/></svg>\n'}
    symbols = {
        "arrow-right": '<path d="M4 12h16M14 6l6 6-6 6"/>',
        "arrow-left": '<path d="M20 12H4M10 6l-6 6 6 6"/>',
        "chevron-down": '<path d="m6 9 6 6 6-6"/>',
        "gift": '<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3ZM12 8h4a3 3 0 1 0-3-3l-1 3Z"/>',
        "box": '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5 17 9"/>',
        "leaf": '<path d="M5 20c0-8 5-15 16-16 0 11-5 16-11 16-4 0-6-4-5-7M5 20 16 9"/>',
        "tray": '<path d="M3 18h18M5 15a7 7 0 0 1 14 0H5ZM12 8V5M10.5 5h3M7 21h10"/>',
        "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h2M7 17h2"/>',
        "message": '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v4ZM7 8h10M7 12h7"/>',
        "share": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
        "check": '<path d="m5 12 4 4L19 6"/>',
        "close": '<path d="m6 6 12 12M18 6 6 18"/>',
        "instagram": '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor" stroke="none"/>',
        "whatsapp": '<path d="M21 11.5a9 9 0 0 1-13.3 8L3 21l1.5-4.6A9 9 0 1 1 21 11.5Z"/><path d="M8 7c-1 1-1.5 3 1 6s4.5 3.5 6 2l1-1-3-2-1 1c-1-.5-2-1.5-2.5-2.5l1-1L9 7H8Z"/>',
        "download": '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
        "expand": '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
        "plus": '<path d="M12 5v14M5 12h14"/>',
        "minus": '<path d="M5 12h14"/>',
        "map-pin": '<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
        "heart": '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
        "external": '<path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
        "spark": '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/>',
    }
    icons = '<svg xmlns="http://www.w3.org/2000/svg">\n' + '\n'.join(
        f'<symbol id="{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{paths}</symbol>'
        for name, paths in symbols.items()) + '\n</svg>\n'
    native["iconos-ui.svg"] = icons
    for name, body in native.items():
        master = VECTORS / name
        master.write_text(body)
        destination = OUT / name
        shutil.copyfile(master, destination)
        register(destination, kind="vector-native", source=master.relative_to(REPO).as_posix(),
                 use="UI icons" if name == "iconos-ui.svg" else "decoration, aria-hidden=true",
                 notes="Deterministic editable native SVG. No cultural-historical symbolism claimed.")


def catalogue_thumbnail() -> None:
    path = REPO / "docs" / "assets" / "pagina-01.webp"
    with Image.open(path) as original:
        for width in [320, 640]:
            image = original.resize((width, round(original.height * width / original.width)), Image.Resampling.LANCZOS)
            destination = OUT / f"catalogo-portada-{width}.webp"
            image.save(destination, "WEBP", quality=96, method=6)
            register(destination, kind="catalogue-preview", source="docs/assets/pagina-01.webp",
                     alt="Portada del catálogo Mabell Ramos", use="catalogue entry link",
                     notes="Faithful resized preview. Full-resolution catalogue page and original PDF are not modified.")


def fair_photo() -> None:
    """Use the supplied real table photo without people or implied service scope."""
    source = SOURCE / "feria-mesa-original.jpg"
    if not source.exists():
        return
    with Image.open(source) as original:
        image = original.crop((0, 320, original.width, original.height))
        for width in [640, 1200]:
            output = image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
            destination = OUT / f"feria-mesa-{width}.webp"
            output.save(destination, "WEBP", quality=96, method=6)
            register(destination, kind="photograph-provided", source="assets-source/originals/feria-mesa-original.jpg",
                     alt="Presentación de productos Mabell Ramos sobre bandejas y un expositor de madera",
                     use="brand context: presentation of products, not proof of a catering service",
                     notes="Supplied project photograph. Upper crop removes unrelated floor/foot; no identifiable person shown. Does not confirm quantities, variants, current packages or included services.",
                     crop=[0, 320, original.width, original.height])


def social_image(logo: Image.Image) -> None:
    """Compose an accurate share card with native text and reference illustration."""
    scale = 1
    image = Image.new("RGB", (1200 * scale, 630 * scale), CANVAS)
    hero = Image.open(SOURCE / "hero-editorial-v2.png").convert("RGB")
    # A separate share thumbnail, fitted below native dimensions without upscaling.
    hero = ImageOps.fit(hero, (620, 630), Image.Resampling.LANCZOS, centering=(.5, .65))
    image.paste(hero, (580, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 580*scale, 630*scale), fill=CANVAS)
    badge = logo.copy()
    badge.thumbnail((100*scale, 100*scale), Image.Resampling.LANCZOS)
    image.paste(badge, (48*scale, 42*scale), badge)
    font = ImageFont.truetype(str(SOURCE / "bodoni-moda-600.ttf"), 61*scale)
    small = ImageFont.truetype(str(SOURCE / "bodoni-moda-600.ttf"), 23*scale)
    for text, y in [("Dulces para", 188), ("disfrutar, regalar", 270), ("y descubrir.", 352)]:
        draw.text((48*scale, y*scale), text, font=font, fill=INK)
    draw.line((48*scale, 474*scale, 450*scale, 474*scale), fill="#D8CDE0", width=2*scale)
    draw.text((48*scale, 505*scale), "Mabell Ramos · Catálogo y catering", font=small, fill=INK)
    draw.text((48*scale, 551*scale), "Ilustración editorial de referencia", font=small, fill="#6B5B73")
    image = image.resize((1200, 630), Image.Resampling.LANCZOS)
    destination = OUT / "social-inicio-v2.jpg"
    image.save(destination, "JPEG", quality=95, subsampling=0, optimize=True)
    register(destination, kind="editorial-composition-reference", source="assets-source/originals/hero-editorial-v2.png + original logo crop",
             alt="Mabell Ramos: dulces para disfrutar, regalar y descubrir", use="Open Graph share image",
             notes="Native typesetting with original mark. Illustration is explicitly identified; no price or package promise.")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    VECTORS.mkdir(parents=True, exist_ok=True)
    imagery = json.loads((REPO / "site-src/content/editorial-images.json").read_text())
    for spec in imagery.values():
        with Image.open(SOURCE / f'{spec["stem"]}.png') as master:
            if master.size != (spec["width"], spec["height"]):
                raise ValueError(f'Image metadata differs from native master: {spec["stem"]}')
        responsive_image(spec["stem"], spec["widths"], alt=spec["alt"])
    logo = authentic_logo()
    fonts()
    svg_assets()
    catalogue_thumbnail()
    fair_photo()
    social_image(logo)
    originals = [{"file": p.relative_to(REPO).as_posix(), "bytes": p.stat().st_size,
                  "sha256": sha256(p), "preserved": True}
                 for p in sorted(SOURCE.iterdir()) if p.is_file()]
    manifest = {
        "schemaVersion": 1,
        "createdOn": "2026-09-29",
        "brand": "Mabell Ramos",
        "policy": {
            "sourceQuality": "Original masters retained byte-for-byte. Web derivatives are separate.",
            "images": "Generated editorial illustrations are references, not verified photographs of merchandise or services.",
            "logo": "Deterministic crop from authentic source; original type/color retained. No generated badge substitution.",
            "videos": "No local verified videos supplied. UI must omit video blocks until authorized real clips exist.",
            "catalogue": "Original full-resolution catalogue images and PDF remain untouched.",
            "approval": "Ready means technically prepared; illustration availability does not approve a product or package for sale.",
        },
        "originals": originals,
        "assets": ENTRIES,
        "missingRealMedia": ["six confirmed purchase-option photos", "portraits authorized by Mabel and Ana", "real catering gallery", "real production and catering videos"],
    }
    (REPO / "assets-source" / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Prepared {len(ENTRIES)} derivatives/vectors/fonts; original assets preserved.")
    for entry in ENTRIES:
        print(f'{entry["file"]}: {entry["bytes"]:,} bytes')


if __name__ == "__main__":
    main()
