# The last touch every picture but the gems gets before it is packed (pack.py):
# richer colour, light from the top left wrapping round the edges, shade at the
# bottom, a crisp outline and a small shadow.
import numpy as np
from PIL import Image, ImageFilter

# Pictures that tile with a neighbour or lie flat get only the colour.
FLAT = ('ice-', 'vine-', 'rack-', 'truss', 'turntable', 'confetti', 'petals', 'dust', 'goo', 'velvet', 'curtain', 'carpet')
SKIP = ('gem',)

def blur(a, r):
    p = int(r * 3) + 1
    b = np.pad(a, p, mode='edge')                # (what runs off the picture carries on)
    im = Image.fromarray((np.clip(b, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.asarray(im, float)[p:-p, p:-p] / 255

def polish(im, name):
    if name.startswith(SKIP): return im
    flat = name.startswith(FLAT)
    if not flat:                                  # a little room for the outline and the shadow
        k = .965
        small = im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS)
        im = Image.new('RGBA', im.size)
        im.paste(small, ((im.width - small.width) // 2, (im.height - small.height) // 2 - 2))
    a = np.asarray(im, float) / 255
    rgb, al = a[..., :3], a[..., 3]
    H, W = al.shape
    # Richer colour, deeper middle tones, and whites that are not bare white.
    grey = (rgb @ np.array([.3, .59, .11]))[..., None]
    rgb = np.clip(grey + (rgb - grey) * 1.12, 0, 1)
    rgb = rgb + .16 * (rgb - .5) * (1 - np.abs(2 * rgb - 1))
    y = np.linspace(0, 1, H)[:, None, None]
    cells = max(1, round(H / 256))
    light = 1.06 - .2 * y if not flat else np.ones_like(y)
    rgb = rgb * light + np.array([.16, .06, .36]) * (np.clip(y - .5, 0, 1) * (.22 if not flat else 0)) * (.3 + .7 * grey)
    if not flat:
        # Edges: treat the silhouette as a rounded pillow and light it.
        for r, up, down in ((5, .55, .3), (14, .3, .26)):
            h = blur(al, r)
            gy, gx = np.gradient(h)
            lit = (gx * .5 + gy * .86) * r * 1.6                 # > 0 faces the light
            inner = np.clip((blur(al, 2.5) - .72) / .28, 0, 1)   # (not on the dark outline itself)
            hi = (np.clip(lit, 0, 1) * up * inner)[..., None]
            lo = (np.clip(-lit, 0, 1) * down * inner)[..., None]
            rgb = 1 - (1 - rgb) * (1 - hi)
            rgb = rgb * (1 - lo) + rgb * np.array([.35, .16, .5]) * lo
        # Shading from the picture's own light and dark: crisper forms.
        soft = np.stack([blur(np.where(al > .5, rgb[..., c], grey[..., 0]), 7) for c in range(3)], -1)
        rgb = np.clip(rgb + (rgb - soft) * .35, 0, 1)
        # One more outline round the outside, in a dark shade of the picture's colour.
        big = np.clip(blur(al, 3) * 2.6, 0, 1)
        m = (al[..., None] * rgb).sum((0, 1)) / max(al.sum(), 1)
        dark = np.clip(m * .22, 0, 1) * .6 + np.array([.05, .02, .12]) * .7
        tot = np.maximum(al, big)
        rgb = (rgb * al[..., None] + dark * (tot - al)[..., None]) / np.maximum(tot, 1e-4)[..., None]
        al = tot
        sh = np.roll(blur(al, 5), 6, 0)
        sh[:6] = 0
        t2 = np.maximum(al, sh * .38)
        rgb = (rgb * al[..., None] + np.array([.08, .05, .22]) * (t2 - al)[..., None]) / np.maximum(t2, 1e-4)[..., None]
        al = t2
    return Image.fromarray((np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype(np.uint8), 'RGBA')
