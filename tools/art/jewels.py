# The five gems, drawn facet by facet (no Blender):
#   py -3.12 tools/art/jewels.py <output folder>
# Each is cut as three rings: the edge, the crown facets and the flat table.
# Every facet gets one clean tone by the way it faces the light (top left).
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 1024
TAU = math.tau
LIGHT = (-.55, .83)

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
def mix(a, b, t): return a + (b - a) * t

# Five tones of a stone, darkest to palest.
PAL = {
    'topaz':    ['#8a2e00', '#e06a00', '#ff9d0a', '#ffc93a', '#fff3b0'],
    'ruby':     ['#5e0016', '#b8052c', '#f0183f', '#ff5a6c', '#ffc9c4'],
    'sapphire': ['#04135e', '#0a3cc0', '#1c6bff', '#57a6ff', '#cbeaff'],
    'emerald':  ['#01391d', '#037a3c', '#0fb556', '#4fe07f', '#d2ffd9'],
    'amethyst': ['#2f065e', '#6a14b8', '#9a35f5', '#c47bff', '#f2dcff'],
}
def tone(pal, t):
    t = min(max(t, 0), 1) * 4
    i = min(int(t), 3)
    return mix(hexc(pal[i]), hexc(pal[i + 1]), t - i)

def rounded(pts, r, seg=8):
    res, n = [], len(pts)
    for i, p in enumerate(pts):
        p = np.array(p, float)
        a, b = np.array(pts[i - 1]) - p, np.array(pts[(i + 1) % n]) - p
        k = min(r, np.hypot(*a) * .48, np.hypot(*b) * .48)
        a, b = p + a / np.hypot(*a) * k, p + b / np.hypot(*b) * k
        for j in range(seg + 1):
            t = j / seg
            res.append(tuple(a * (1 - t) ** 2 + 2 * p * t * (1 - t) + b * t * t))
    return res
def ngon(n, r, rot=0): return [(r * math.cos(rot + TAU * i / n), r * math.sin(rot + TAU * i / n)) for i in range(n)]
def around(pts, k, c): return [(c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k) for x, y in pts]
def px(p): return (N / 2 + p[0] * N / 2, N / 2 - p[1] * N / 2)
def mask(pts, blur=0):
    im = Image.new('L', (N, N), 0)
    ImageDraw.Draw(im).polygon([px(p) for p in pts], fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(blur)) if blur else im, float)[..., None] / 255

def jewel(pal, poly, r, centre=(0, 0), table=.56, half=True):
    pal = PAL[pal]
    n = len(poly)
    Y, X = np.mgrid[0:N, 0:N]
    x, y = (X - N / 2) / (N / 2), (N / 2 - Y) / (N / 2)
    img = np.zeros((N, N, 3))
    al = np.zeros((N, N, 1))
    def put(pts, col, a=1, blur=0):
        nonlocal img, al
        m = mask(pts, blur) * a
        img = img * (1 - m) + col * m
        al = np.maximum(al, m) if not blur else al
    whole = rounded(poly, r)
    put(around(whole, 1.0, centre), hexc(pal[0]) * .78)                       # the dark outline
    body = rounded(around(poly, .915, centre), r * .915)
    put(body, tone(pal, .34))
    inside = mask(body)
    # Crown facets.
    ring = around(poly, .915, centre)
    mid = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(ring, ring[1:] + ring[:1])]
    mid = around(mid, .83, centre)
    tab = around(ring, table, centre)
    keep = (img.copy(), al.copy())
    def facet(pts, k=0):
        gx = sum(p[0] for p in pts) / len(pts) - centre[0]
        gy = sum(p[1] for p in pts) / len(pts) - centre[1]
        d = math.hypot(gx, gy) or 1
        lit = (gx * LIGHT[0] + gy * LIGHT[1]) / d
        # (the far side of a stone glows a little where light comes out again)
        t = .43 + .4 * lit + k + (.16 * max(0, -lit - .55) / .45)
        base = tone(pal, t)
        edge = tone(pal, t + .14)
        g = np.clip(((x - centre[0]) * gx / d + (y - centre[1]) * gy / d), 0, 1)[..., None]
        m = mask(pts)
        nonlocal img
        img = img * (1 - m) + (edge * (1 - g) + base * g) * m
    for i in range(n):
        j = (i + 1) % n
        if half:
            facet([ring[i], ring[j], mid[i]], -.1)
            facet([tab[i], mid[i], tab[j]], .1)
            facet([ring[j], tab[j], mid[i]], -.02 if i % 2 else .05)
            facet([ring[i], mid[i], tab[i]], .05 if i % 2 else -.02)
        else:
            a, b = around([ring[i], ring[j]], .8, centre)
            facet([ring[i], ring[j], b, a], -.08)
            facet([a, b, tab[j], tab[i]], .1)
    m = inside
    img = keep[0] * (1 - m) + img * m
    # Fine bright lines where facets meet.
    lines = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(lines)
    for i in range(n):
        j = (i + 1) % n
        seg = [(tab[i], tab[j])] + ([(ring[i], mid[i]), (mid[i], ring[j]), (mid[i], tab[i]), (mid[i], tab[j]), (ring[i], tab[i])] if half else [(ring[i], tab[i]), (around([ring[i]], .8, centre)[0], around([ring[j]], .8, centre)[0])])
        for a, b in seg: d.line([px(a), px(b)], fill=255, width=6)
    L = np.asarray(lines.filter(ImageFilter.GaussianBlur(2.2)), float)[..., None] / 255 * m * .42
    img = img * (1 - L) + hexc(pal[4]) * L
    # The table: dark at the top, glowing toward the bottom.
    tr = rounded(tab, r * table * .5)
    tm = mask(tr, 2)
    ys = [p[1] for p in tr]
    v = np.clip((y - min(ys)) / (max(ys) - min(ys)), 0, 1)[..., None]
    tcol = np.where(v < .45, mix(tone(pal, .86), tone(pal, .62), v / .45), mix(tone(pal, .62), tone(pal, .4), (v - .45) / .55))
    img = img * (1 - tm * .9) + tcol * tm * .9
    # Seen through the table, the cut of the underside: a star of light and dark.
    for i in range(n):
        j = (i + 1) % n
        q = around([((tr_a[0] + tr_b[0]) / 2, (tr_a[1] + tr_b[1]) / 2) for tr_a, tr_b in ((tab[i], tab[j]),)], .96, centre)[0]
        c0 = (centre[0], centre[1] - .03)
        for tri, t in (([c0, tab[i], q], .3 if i % 2 else .72), ([c0, q, tab[j]], .66 if i % 2 else .36)):
            f = mask(tri, 1) * tm * .42
            img = img * (1 - f) + tone(pal, t + .1 * (tri[1][1] > 0)) * f
    # Two flat glints that cross the table.
    for sx, w, a in ((-.1, .16, .26), (.2, .07, .2)):
        band = [(centre[0] + sx - .5, centre[1] + .8), (centre[0] + sx - .5 + w, centre[1] + .8), (centre[0] + sx + .3 + w, centre[1] - .8), (centre[0] + sx + .3, centre[1] - .8)]
        b = mask(band, 3) * tm * a
        img = img * (1 - b) + 255 * b
    # A bright lip round the top left of the edge, a dark one round the bottom right.
    inner = mask(around(body, .955, centre), 5)
    lip = np.clip(inside - inner, 0, 1)
    lit = np.clip(((x - centre[0]) * LIGHT[0] + (y - centre[1]) * LIGHT[1]) * 1.2, -1, 1)[..., None]
    a = lip * np.clip(lit, 0, 1) * .85
    img = img * (1 - a) + hexc(pal[4]) * a
    a = lip * np.clip(-lit, 0, 1) * .55
    img = img * (1 - a) + hexc(pal[0]) * a
    # The gloss: a soft curved highlight over the upper part, and a spark.
    cy = centre[1]
    top = max(p[1] for p in body)
    gl = np.clip(1 - (((x - centre[0] + .04) / .62) ** 2 + ((y - top + .17) / .26) ** 2), 0, 1)[..., None] ** .6 * inside
    gl *= np.clip((y - (top - .42)) / .3, 0, 1)[..., None] * .6
    img = img * (1 - gl) + 255 * gl
    sx, sy = centre[0] - .34, cy + .34
    rr = np.hypot(x - sx, y - sy)[..., None]
    sp = np.clip(1 - rr / .075, 0, 1) ** .5 * .95 + np.clip(1 - rr / .2, 0, 1) ** 2 * .5
    sp = np.clip(sp, 0, 1) * inside
    img = img * (1 - sp) + 255 * sp
    out = np.concatenate([np.clip(img, 0, 255), al * 255], 2).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    # Richer colour, and a little more light and dark.
    c = np.asarray(im, float)
    g = (c[..., :3] @ np.array([.3, .59, .11]))[..., None]
    v = g + (c[..., :3] - g) * 1.3
    v = v + .12 * (v - 118)
    im = Image.fromarray(np.dstack([np.clip(v + 5, 0, 255), c[..., 3]]).astype(np.uint8), 'RGBA')
    # Its own small shadow, so it sits on the board.
    sh = Image.new('RGBA', (N, N), (20, 16, 60, 0))
    sh.putalpha(Image.fromarray((np.roll(al[..., 0], 26, 0) * 90).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14)))
    return Image.alpha_composite(sh, im).resize((256, 256), Image.Resampling.LANCZOS)

def heart():
    h = [(0, .58), (.34, .88), (.74, .82), (.95, .42), (.84, -.04), (.46, -.5), (0, -.9)]
    return h + [(-x, y) for x, y in h[-2:0:-1]]

if __name__ == '__main__':
    out = sys.argv[1]
    jewel('topaz', [(-.2, .92), (.2, .92), (.95, -.5), (.78, -.8), (-.78, -.8), (-.95, -.5)], .16, (0, -.14), .5).save(out + '/gem0.png')
    jewel('ruby', heart(), .1, (0, .08), .52).save(out + '/gem1.png')
    jewel('sapphire', ngon(10, .88, TAU / 20), .1, (0, 0), .56).save(out + '/gem2.png')
    jewel('emerald', [(-.44, -.88), (.44, -.88), (.72, -.6), (.72, .6), (.44, .88), (-.44, .88), (-.72, .6), (-.72, -.6)], .1, (0, 0), .54, half=False).save(out + '/gem3.png')
    jewel('amethyst', [(0, .93), (.78, .26), (.62, -.2), (0, -.93), (-.62, -.2), (-.78, .26)], .08, (0, .04), .5).save(out + '/gem4.png')
