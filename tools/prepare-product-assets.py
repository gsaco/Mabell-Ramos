"""Import approved final PNGs and encode responsive assets without cropping."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from tempfile import TemporaryDirectory
import argparse
import hashlib
import json
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1] / 'assets-source/productos-finales-2026-11-12'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def encode(job):
    asset, width = job
    source = ROOT / asset['original']['file']
    height = round(width * asset['original']['height'] / asset['original']['width'])
    assert width <= asset['original']['width']
    stem = f"{asset['id']}-final-{width}"
    webp, avif = [ROOT / 'web' / f'{stem}.{ext}' for ext in ('webp', 'avif')]
    subprocess.run(['cwebp', '-quiet', '-q', '96', '-m', '6', '-sharp_yuv', '-resize', str(width), str(height), str(source), '-o', str(webp)], check=True)
    with TemporaryDirectory() as temp:
        reduced = source
        if width != asset['original']['width']:
            reduced = Path(temp) / 'reduced.png'
            subprocess.run(['sips', '-z', str(height), str(width), str(source), '--out', str(reduced)], check=True, capture_output=True)
        subprocess.run(['avifenc', '-q', '85', '-s', '6', '-j', '1', '-y', '444', str(reduced), str(avif)], check=True, capture_output=True)
    return asset['id'], [{'file': str(p.relative_to(ROOT)), 'format': p.suffix[1:], 'width': width, 'height': height, 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in (webp, avif)]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, help='Folder containing the approved final PNGs and manifest.json')
    args = parser.parse_args()
    (ROOT / 'originals').mkdir(parents=True, exist_ok=True)
    (ROOT / 'web').mkdir(exist_ok=True)
    if args.source:
        metadata = json.loads((args.source / 'manifest.json').read_text())
        for item in metadata['assets']:
            source = args.source / item['file']
            assert digest(source) == item['sha256'], f"Changed approved source: {source}"
            shutil.copy2(source, ROOT / 'originals' / f"{item['id']}.png")
        (ROOT / 'approved-source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
    metadata = json.loads((ROOT / 'approved-source.json').read_text())
    assets = []
    for item in metadata['assets']:
        source = ROOT / 'originals' / f"{item['id']}.png"
        width, height = struct.unpack('>II', source.read_bytes()[16:24])
        assets.append({'id': item['id'], 'name': item['name'], 'family': item['family'], 'original': {'file': str(source.relative_to(ROOT)), 'width': width, 'height': height, 'sha256': digest(source)}, 'illustrative_cut': item['cut_illustrative'], 'variants': []})
    jobs = [(asset, width) for asset in assets for width in sorted({480, 960, asset['original']['width']})]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for ident, variants in pool.map(encode, jobs):
            next(a for a in assets if a['id'] == ident)['variants'].extend(variants)
    (ROOT / 'manifest.json').write_text(json.dumps({'source': 'ASSETS FINALES', 'date': '2026-11-12', 'upscaled': False, 'assets': assets}, ensure_ascii=False, indent=2))
    print(f'{len(assets)} approved originals; {sum(len(a["variants"]) for a in assets)} responsive derivatives.')

if __name__ == '__main__':
    main()
