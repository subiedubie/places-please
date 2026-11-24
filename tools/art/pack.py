# Packs the rendered pictures into one image (art/atlas.webp) and a list of
# where each sits (art/atlas.js).   py -3.12 tools/art/pack.py <folder of PNGs>
import glob, json, os, sys
from PIL import Image

CELL = 148  # pixels per board cell; enough for the sharpest iPhone
src = sys.argv[1]
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
items = []
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    im = Image.open(f).convert('RGBA')
    w, h = round(im.width / 256), round(im.height / 256)
    items.append((os.path.splitext(os.path.basename(f))[0], im.resize((w * CELL, h * CELL), Image.Resampling.LANCZOS), w, h))
items.sort(key=lambda i: (-i[3], -i[2], i[0]))
W = 12 * (CELL + 2)
frames, x, y, row = {}, 0, 0, 0
for name, im, w, h in items:
    if x + im.width + 2 > W:
        x, y, row = 0, y + row, 0
    frames[name] = [x, y, im.width, im.height]
    x += im.width + 2
    row = max(row, im.height + 2)
sheet = Image.new('RGBA', (W, y + row))
for name, im, w, h in items:
    sheet.paste(im, tuple(frames[name][:2]))
os.makedirs(dst, exist_ok=True)
sheet.save(os.path.join(dst, 'atlas.webp'), quality=88, method=6)
with open(os.path.join(dst, 'atlas.js'), 'w', newline='\n') as f:
    f.write('// Made by tools/art/pack.py. Name: [x, y, width, height] in atlas.webp.\nexport const FRAMES = {\n')
    for k, v in frames.items():
        f.write(f"  '{k}': {v},\n")
    f.write('};\n')
print(len(items), 'pictures', sheet.size, os.path.getsize(os.path.join(dst, 'atlas.webp')) // 1024, 'KB')
