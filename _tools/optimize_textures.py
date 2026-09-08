"""
Phase 2 — Texture optimization
Resize 2K PBR textures to 1024 and compress for web.
  - diff:   1024 RGB PNG (optimize)
  - normal: 1024 RGB PNG (optimize)
  - rough:  1024 L (grayscale) PNG (optimize)
Writes to assets/textures/ and prints before/after sizes.
"""
import os
from PIL import Image

SRC = r"D:/CODE/30 DAYS/DAY 4/chess_set_2k.blend/textures"
DST = r"D:/CODE/30 DAYS/DAY 4/assets/textures"
os.makedirs(DST, exist_ok=True)

TARGET = 1024

def process(name, kind):
    src = os.path.join(SRC, name)
    base = os.path.splitext(name)[0]
    # drop _2k suffix for output name
    base = base.replace("_2k", "")
    dst = os.path.join(DST, base + ".png")
    img = Image.open(src)
    before = os.path.getsize(src)
    img = img.resize((TARGET, TARGET), Image.LANCZOS)
    if kind == "rough":
        img = img.convert("L")
    elif kind == "diff":
        img = img.convert("RGB")
    elif kind == "nor":
        img = img.convert("RGB")
    img.save(dst, "PNG", optimize=True)
    after = os.path.getsize(dst)
    print(f"{name:42s} {before/1e6:8.2f}MB -> {after/1e6:7.2f}MB  ({after/before*100:5.1f}%)")
    return after

files = sorted(os.listdir(SRC))
total_after = 0
for f in files:
    lf = f.lower()
    if "nor" in lf:
        kind = "nor"
    elif "rough" in lf:
        kind = "rough"
    elif "diff" in lf:
        kind = "diff"
    else:
        continue
    total_after += process(f, kind)

print(f"\nTOTAL optimized: {total_after/1e6:.1f} MB  (was 121.8 MB)")
print("TEXTURES_DONE")
