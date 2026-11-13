"""Import the five approved packaging photos, preserving original pixels."""
from pathlib import Path
import json, shutil, struct, importlib.util
from concurrent.futures import ThreadPoolExecutor

BASE = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/gabrielsaco/Desktop/Proyección Social/ASSETS FINALES/COMBINACIONES")
ROOT = BASE / "assets-source/combinaciones-finales-2026-11-12"
spec = importlib.util.spec_from_file_location("product_encoder", BASE / "tools/prepare-product-assets.py")
encoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoder)
encoder.ROOT = ROOT
(ROOT / "originals").mkdir(parents=True, exist_ok=True)
(ROOT / "web").mkdir(exist_ok=True)
metadata = json.loads((SOURCE / "manifest.json").read_text()) if SOURCE.exists() else json.loads((ROOT / "approved-source.json").read_text())
assets=[]
for item in metadata["assets"]:
    original = ROOT / "originals" / item["file"]
    if SOURCE.exists():
        incoming=SOURCE/item["file"]
        assert encoder.digest(incoming)==item["sha256"]
        shutil.copy2(incoming,original)
    width,height=struct.unpack(">II",original.read_bytes()[16:24])
    assets.append({"id":item["id"],"name":item["title"],"original":{"file":str(original.relative_to(ROOT)),"width":width,"height":height,"sha256":encoder.digest(original)},"variants":[]})
(ROOT / "approved-source.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
with ThreadPoolExecutor(max_workers=4) as pool:
    for ident, variants in pool.map(encoder.encode, [(a,w) for a in assets for w in (480,960,1448)]):
        next(a for a in assets if a["id"]==ident)["variants"].extend(variants)
(ROOT/"manifest.json").write_text(json.dumps({"source":"ASSETS FINALES/COMBINACIONES","assets":assets},ensure_ascii=False,indent=2))
print("Five approved photos imported; 30 responsive images created.")
