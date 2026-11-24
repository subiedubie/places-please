# The round event badges for Home, the four in-level booster icons, the coin
# shop pictures and the shut makeup case. Run it like props.py, and AFTER it
# (props.py makes older versions of drill, coinflip and makeupcase-closed):
#   blender -b -P tools/art/badges.py -- <output folder> [name ...]
# A picture is a pile of separate photos, bottom to top: for a badge the enamel
# disc first, then each part of the subject with its own dark rim and a soft
# shadow under it.
import os, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
# Take every helper from props.py, but not its list of pictures to render.
exec(compile(open(os.path.join(HERE, 'props.py'), encoding='utf-8').read().split('# ---- The list')[0], 'props.py', 'exec'))
DEST = out
out = tempfile.mkdtemp()                 # finish_shot() leaves the single photos here

# ---- Picture sandwich -------------------------------------------------------
def load(path):
    im = bpy.data.images.load(path, check_existing=False)
    W, H = im.size
    a = np.empty(W * H * 4, np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(H, W, 4)            # row 0 is the BOTTOM of the picture

def save(a, path):
    H, W = a.shape[:2]
    im = bpy.data.images.new('o', W, H, alpha=True)
    im.pixels.foreach_set(a.astype(np.float32).ravel())
    im.filepath_raw = os.path.abspath(path)
    im.file_format = 'PNG'
    im.save()

def shift(a, dx, dy):                    # dy up
    b = np.zeros_like(a)
    H, W = a.shape[:2]
    b[max(0, dy):min(H, H + dy), max(0, dx):min(W, W + dx)] = a[max(0, -dy):min(H, H - dy), max(0, -dx):min(W, W - dx)]
    return b

def over(a, b):                          # b on top of a
    A, B = a[..., 3:4], b[..., 3:4]
    t = B + A * (1 - B)
    return np.concatenate([(b[..., :3] * B + a[..., :3] * A * (1 - B)) / np.maximum(t, 1e-5), t], 2)

def blur(m, r):
    k = np.ones(2 * r + 1) / (2 * r + 1)
    for _ in range(2):
        m = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 0, m)
        m = np.apply_along_axis(lambda v: np.convolve(v, k, 'same'), 1, m)
    return m

def rgb(h): return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]

def shadowed(a, b, color, k=.5):         # drop b on a, with a soft shadow on a only
    sh = np.zeros_like(a)
    sh[..., :3] = rgb(color)
    sh[..., 3] = blur(shift(b[..., 3], 4, -7), 4) * k
    r = over(a, sh)
    r[..., 3] = a[..., 3]
    return over(r, b)

# One part of the subject. fit: how much of the cell it fills; dx, dy: where its
# middle goes (in hundredths of the picture, up is plus).
def L(fn, *a, rim='#2a1a33', fit=.66, dx=0, dy=0, lean=10, px=4):
    return (fn, a, rim, fit, dx, dy, lean, px)

def photo(fn, a, rim, fit, dx, dy, lean, px):
    reset(1, 1)
    fn(*a)
    finish_shot('part', 1, 1, lean, fit, rim, px)
    return shift(load(os.path.join(out, 'part.png')), round(dx * 2.56), round(dy * 2.56))

def disc(c, dark):
    g = gold('#ffb31a')
    cyl(P(dark, .3, .3), (0, 0, 0), .86, .2, .02)
    ball(P(c, .22, .8), (0, 0, .02), .88, (1, 1, .16))
    torus(g, (0, 0, .06), .885, .075)
    torus(P(dark, .3, .5), (0, 0, .03), .8, .03)
    tube(glow('#ffffff', .5), arc(0, 0, .69, 108, 158, .13), .035)

BADGES, PLAIN = {}, {}
def badge(name, color, dark, *layers, halo=None):
    BADGES['badge-' + name] = (color, dark, layers, halo)

# ---- Badge subjects ---------------------------------------------------------
INK = '#1d2136'
def cup():
    g, d = gold('#ffbe1f'), gold('#d98200')
    lathe([g], rnd([(0, -.24), (.16, -.24), (.4, -.12), (.6, .2), (.64, .78), (.72, .86), (.72, .94), (.58, .94), (.54, .5), (0, .3)], .07, closed=False))
    for q in (-1, 1): tube(g, [(q * x, y, 0) for x, y, _ in bezier((.56, .72, 0), (1.22, .86, 0), (1.06, .14, 0), (.44, .1, 0))], .1)
    lathe(d, rnd([(0, -.2), (.2, -.22), (.12, -.36), (.16, -.5), (.4, -.56), (.4, -.64), (0, -.64)], .05, closed=False))
    lathe(P('#c23a22'), rnd([(0, -.6), (.5, -.6), (.56, -.95), (0, -.95)], .05, closed=False))
    slab(P('#fff3c0', .3, .5), rnd(star(.31, 0, .36, .52), .04), .4, .74, .05)

def flame():
    sh = rnd([(.06, 1.05), (.34, .5), (.46, .7), (.64, .1), (.46, -.42), (0, -.62), (-.46, -.42), (-.64, .06), (-.46, .44), (-.22, .3)], .16)[::-1]
    for c, k, z, y, e in (('#ff5a0a', 1, 0, 0, .25), ('#ffb300', .64, .16, -.16, .4), ('#fff06a', .36, .28, -.28, .5)):
        slab(mat(c, rough=.3, coat=.4, emit=e), move(sh, 0, y, k), z - .2, z + .22, .08)

def leaves():
    for q in (-1, 1):
        tube(P('#0f8a42'), [(q * x, y, 0) for x, y, _ in arc(0, 0, .74, -88, 62)], .05)
        for i in range(6):
            a = math.radians(-70 + 28 * i)
            for s, m in ((1, '#2fd06a'), (-1, '#17a850')):
                r = .74 + .13 * s
                o = ball(P(m), (q * r * math.cos(a), r * math.sin(a), .06 * s + .1), .23, (.46, 1, .5))
                o.rotation_euler[2] = q * (a - .62 * s)
    bow(P('#f0283c'), 0, -.78, .3, .26)

def medal():
    for c, r, d in (('#e08a00', .5, .18), ('#ffc22e', .48, .26), ('#f09a00', .37, .3)): cyl(gold(c), (0, 0, 0), r, d, .05)
    slab(P('#fff0b0', .3, .5), rnd(star(.36, 0, -.01, .52), .04), .1, .3, .05)

def clapper():
    k, d, w = P('#343d5e'), P('#1b2138'), P('#ffffff')
    panel(d, 0, -.4, .95, .52, -.2, .12, .1)
    panel(k, 0, -.42, .91, .48, -.1, .24, .1, .07)
    slab(gold('#ffbe1f'), rnd(star(.38, 0, -.5, .52), .05), .2, .42, .07)
    def strip(rot, px, py):
        objs = set(bpy.data.objects)
        panel(k, 0, 0, .95, .17, -.1, .3, .05, .04)
        for i in range(4): slab(w, move([(-.02, -.16), (.2, -.16), (.06, .16), (-.16, .16)], -.66 + .45 * i, 0), .2, .34, .02)
        for o in set(bpy.data.objects) - objs:
            o.rotation_euler[2] = rot
            o.location = (px, py, .05)
    strip(0, 0, .05)
    strip(math.radians(16), -.03, .52)
    cyl(gold(), (-.82, .16, .4), .1, .12)

def facepts(s=1, x=0, y=0):
    top = [(-.7 + 1.4 * i / 10, .72 + .22 * (1 - ((i - 5) / 5) ** 2)) for i in range(11)]
    r = [(p[0], p[1]) for p in bezier((.7, .72), (.82, -.2), (.5, -.86), (0, -.92), 14)][1:]
    return move(top + r + [(-a, b) for a, b in r[-2::-1]], x, y, s)[:-1][::-1]

def face(c, happy, s=1, x=0, y=0, z=0):
    m, k = P(c, .25, .7), P(INK, .5, .2)
    slab(m, facepts(s, x, y), z - .3 * s, z + .3 * s, .1 * s)
    def line(pts, r): tube(k, [(x + s * p[0], y + s * p[1], z + .3 * s) for p in pts], r * s)
    for q in (-.34, .34):
        line(arc(q, .12, .19, 15, 165) if happy else arc(q, .4, .19, 195, 345), .085)
    if happy:
        slab(k, move([p[:2] for p in arc(0, -.2, .42, 180, 360)], x, y, s), z + .2 * s, z + .34 * s, .02 * s)
        slab(P('#ff4a5a'), move([p[:2] for p in arc(0, -.74, .3, 40, 140)], x, y, s), z + .3 * s, z + .37 * s, .01 * s)
        for q in (-.52, .52): ball(P('#ff9a4a', .5, .2), (x + s * q, y - .08 * s, z + .28 * s), .13 * s, (1, 1, .3))
    else:
        line(arc(0, -.66, .34, 28, 152), .085)
        ball(P('#bff4ff', .1, 1), (x + .38 * s, y - .06 * s, z + .3 * s), .13 * s, (.8, 1.3, .6))

def chest():
    b, l, k, g = P('#b0561c', .35, .5), P('#e08236', .35, .5), P('#5a2408'), gold('#ffbe1f')
    panel(b, 0, -.42, .98, .5, -.5, .36, .08, .07)
    slab(l, rnd([(-.98, .02), (.98, .02), (.98, .42), (.7, .74), (-.7, .74), (-.98, .42)], .2), -.5, .4, .12)
    cube(k, (0, .04, .4), (1.9, .06, .1), .01)
    panel(g, 0, .13, 1.0, .1, -.4, .47, .04, .04)
    for q in (-1, 1):
        panel(g, q * .64, -.4, .1, .53, 0, .44, .05, .04)
        slab(g, rnd([(q * .54, .1), (q * .74, .1), (q * .74, .64), (q * .54, .78)][::q], .06), 0, .5, .05)

def crown():
    g, d = gold('#ffbe1f'), gold('#e08a00')
    slab(g, rnd([(-.74, -.5), (-.98, .42), (-.44, .04), (0, .74), (.44, .04), (.98, .42), (.74, -.5)], .08), -.2, .28, .1)
    for x, y in ((-.98, .46), (0, .8), (.98, .46)): ball(g, (x, y, .06), .17)
    panel(d, 0, -.58, .82, .2, -.3, .4, .1, .07)
    for x, c, r in ((0, '#f0183c', .16), (-.44, '#1e8bff', .12), (.44, '#1e8bff', .12)): ball(P(c, .1, 1), (x, -.58, .4), r, (1, 1, .6))
    slab(P('#ff3d6e', .1, 1), rnd(move([(0, .24), (.15, 0), (0, -.24), (-.15, 0)], 0, .05), .03), .2, .38, .06)

def dagger():
    slab(steel('#e4edf8'), [(-.2, -.1), (-.2, .84), (0, 1.16), (.2, .84), (.2, -.1)], -.1, .14, .09)
    panel(gold(), 0, -.18, .46, .12, -.18, .22, .1, .06)
    panel(P('#e0286a'), 0, -.5, .13, .3, -.14, .2, .06, .06)
    ball(gold(), (0, -.86, 0), .2)

def ghostlamp():
    k, s = P('#4a5680'), steel('#c3cede')
    ball(mat('#ffd93a', rough=.15, coat=.6, emit=.55), (0, .5, .1), .46)
    ball(glow('#fffbe0', 1), (-.14, .64, .42), .13, (1, 1, .5))
    lathe(s, rnd([(0, .16), (.24, .16), (.26, -.06), (.14, -.14), (0, -.14)], .04, closed=False))
    for y in (.1, 0): torus(P('#7d8aa0'), (0, y, 0), .235, .04, (90, 0, 0))
    tube(s, [(0, -.1, 0), (0, -.8, 0)], .1)
    lathe(k, rnd([(0, -.7), (.34, -.7), (.66, -.86), (.66, -1.0), (0, -1.0)], .05, closed=False))

def rays():
    m = glow('#ffc81c', .7)
    for i in range(7):
        a = math.radians(-24 + 38 * i)
        tube(m, [(r * math.cos(a), r * math.sin(a), 0) for r in (.74, 1.02)], .085)
        for r in (.74, 1.02): ball(m, (r * math.cos(a), r * math.sin(a), 0), .085)

def stopwatch():
    b, d, w = P('#1550e0'), gold('#ffbe1f'), P('#ffffff', .4, .3, emit=.12)
    panel(d, 0, .96, .16, .16, -.15, .2, .05, .05)
    panel(b, 0, 1.12, .28, .13, -.2, .25, .1, .07)
    for q in (-1, 1): slab(d, rnd(move(rect(.14, .16, .05), q * .66, .66, 1, -q * math.pi / 4), .03), -.12, .18, .05)
    cyl(b, (0, 0, 0), .92, .4, .14)
    cyl(w, (0, 0, .16), .67, .16, .03)
    for i in range(4): ball(P('#8ba0c8'), (.54 * math.cos(TAU * i / 4), .54 * math.sin(TAU * i / 4), .24), .05)
    slab(mat('#ffb000', rough=.25, coat=.4, emit=.15), rnd([(.16, .5), (-.36, -.08), (-.04, -.08), (-.16, -.52), (.36, .1), (.06, .1)], .03), .2, .42, .05)

def flag():
    w, k, p = P('#ffffff', .35, .3), P('#252b40', .35, .3), P('#b0561c')
    nx, ny, S = 4, 3, 10
    f = lambda u: (.13 * math.sin(u * 5.6 + .3), .12 * math.cos(u * 5.6 + .3))
    V, F, M = [], [], []
    for j in range(ny * S + 1):
        for i in range(nx * S + 1):
            u = i / (nx * S)
            V.append((-.7 + 1.6 * u, .88 - 1.14 * j / (ny * S) + f(u)[0], .1 + f(u)[1]))
    n = nx * S + 1
    for j in range(ny * S):
        for i in range(nx * S):
            F.append([j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i])
            M.append((i // S + j // S) % 2)
    o = obj(V, F, w, smooth=True)
    o.data.materials.append(k)
    for q, pl in enumerate(o.data.polygons): pl.material_index = M[q]
    s = o.modifiers.new('s', 'SOLIDIFY')
    s.thickness, s.offset = .14, 0
    tube(p, [(-.76, -1.0, .1), (-.76, 1.0, .1)], .1)
    ball(p, (-.76, -1.0, .1), .1)
    ball(gold(), (-.76, 1.08, .1), .19)

def ladder():
    a, b = P('#e08a36', .35, .5), P('#b8561a', .35, .5)
    for y in (.56, .16, -.24, -.62):
        x = .5 - (y + .9) * .1
        tube(a, [(-x, y, .05), (x, y, .05)], .095)
    for q in (-1, 1):
        tube(b, [(q * .56, -.9, .1), (q * .36, .9, .1)], .13)
        for x, y in ((.56, -.9), (.36, .9)): ball(b, (q * x, y, .1), .13)

def ticket():
    R, Y = P('#ff6a2a', .28, .6), P('#fff0b4', .35, .4)
    bite = lambda x, t: [(x + .2 * math.cos(t + math.pi * i / 12), .2 * math.sin(t + math.pi * i / 12)) for i in range(13)]
    slab(R, [(-1, -.6), (1, -.6)] + bite(1, math.pi / 2)[::-1] + [(1, .6), (-1, .6)] + bite(-1, -math.pi / 2)[::-1], -.12, .16, .06)
    panel(Y, -.2, 0, .5, .44, .1, .22, .08, .03)
    slab(P('#f0283c'), rnd(star(.4, -.2, -.02, .52), .04), .16, .36, .06)
    for y in (-.38, -.13, .13, .38): ball(Y, (.52, y, .16), .07, (1, 1, .5))

def clipboard():
    b, w, s, g = P('#b8621c', .35, .5), P('#ffffff', .5, .2, emit=.08), steel('#b4c0d6'), P('#0fae4e')
    panel(b, 0, -.06, .76, .94, -.2, .16, .16, .08)
    panel(w, 0, -.12, .6, .76, .1, .24, .06, .03)
    panel(s, 0, .82, .36, .16, .1, .4, .1, .07)
    cyl(s, (0, .98, .2), .17, .24, .06)
    cyl(P('#4a566b'), (0, .98, .34), .07, .04)
    for y in (.36, -.1, -.56):
        tube(g, [(-.44, y, .26), (-.32, y - .13, .26), (-.1, y + .15, .26)], .08)
        for p in ((-.44, y), (-.1, y + .15)): ball(g, (*p, .26), .08)
        panel(P('#9fb0cc'), .24, y, .22, .06, .2, .28, .05, .02)

def giftbase(c, dk, r):
    panel(P(dk), 0, -.34, .78, .56, -.4, .2, .08)
    panel(P(c), 0, -.34, .74, .52, -.3, .34, .08, .06)
    panel(r, 0, -.34, .17, .53, 0, .42, .03, .03)

def lidbow(l, r):
    panel(l, 0, .12, .86, .2, -.4, .46, .08, .07)
    panel(r, 0, .12, .18, .21, 0, .54, .03, .03)
    for d in (-1, 1): tube(r, bezier((0, .36, .2), (d * .3, .95, .3), (d * 1.0, .9, .3), (d * .1, .36, .2)), .13)
    ball(r, (0, .4, .4), .2)

def giftbox():
    g = gold('#ffbe1f')
    giftbase('#7a22e0', '#3c0c80', g)
    lidbow(P('#a95cff'), g)

def presbox():
    giftbase('#e8182e', '#80081a', P('#ffe9a8'))
    panel(glow('#fff07a', .9), 0, .22, .7, .1, -.3, .25, .04)

def preslid(): lidbow(P('#ff3a4a'), P('#ffe9a8'))
def spark(): slab(mat('#ffffff', rough=.25, coat=.4, emit=.3), rnd(star(.9, 0, 0, .4, 4), .06), -.1, .3, .1)

def booklet():
    w, y, k = P('#f4f6ff', .5, .2), P('#ffc61a'), P(INK)
    panel(P('#c8cfe2'), .16, -.08, .7, .9, -.3, -.1, .05)
    panel(w, .1, -.04, .7, .9, -.2, .0, .05)
    panel(y, 0, 0, .72, .92, -.1, .16, .08, .06)
    panel(k, 0, .58, .6, .21, .1, .24, .05, .03)
    panel(y, 0, .58, .4, .06, .2, .28, .04, .02)
    slab(P('#f0183c'), rnd(star(.56, 0, -.2, .52), .05), .1, .36, .08)
    panel(gold('#d98200'), 0, -.78, .46, .05, .1, .2, .04, .02)

def bigstar():
    slab(gold('#ffbe1f'), rnd(star(1, 0, 0, .56), .12), -.2, .3, .16)
    slab(gold('#ffe06a'), rnd(star(.62, 0, 0, .56), .08), .2, .44, .1)

# ---- The four in-level boosters ---------------------------------------------
def drill():                             # points down into the board, to the right
    o, d, k, s = P('#ff8a12', .25, .7), P('#ffb84a', .25, .7), P('#2b2f45'), steel('#e2eaf5')
    slab(o, rnd([(-.72, .64), (.16, .64), (.3, .5), (.3, -.1), (.16, -.24), (-.16, -.24), (-.24, -.7), (-.74, -.7), (-.62, -.16), (-.8, 0), (-.8, .54)], .12), -.3, .34, .12)
    panel(k, -.5, -.8, .42, .22, -.36, .4, .1, .07)
    slab(P('#f0283c'), rnd(move(rect(.12, .2, .06), -.02, -.36, 1, .2), .04), -.15, .24, .05)
    panel(d, -.28, .38, .38, .1, .2, .4, .08, .04)
    cyl(gold('#ffbe1f'), (.36, .2, 0), .44, .22, .07, rot=(0, 90, 0))
    cyl(k, (.52, .2, 0), .38, .22, .05, rot=(0, 90, 0), r2=.3)
    cyl(s, (.94, .2, 0), .32, .7, 0, rot=(0, 90, 0), r2=.02)
    for q in range(4):                   # twist of the bit
        x, r = .66 + .14 * q, .31 - .065 * q
        tube(P('#6f7d98'), [(x, .2 - r, .1), (x + .04, .2, .02 + r), (x + .1, .2 + r, .1)], .045)

def row(down):                           # the row or column of cells it clears
    m = [P('#ffc21c', .3, .6), P('#ff9a1c', .3, .6)]
    for i in (-1, 0, 1):
        x, y = (0, i * .68) if down else (i * .68, 0)
        panel(m[i % 2], x, y, .31 + .13 * down, .44 - .13 * down, -.2, .1, .1, .08)

def sweep(down):                         # a fat arrow
    c, l = ('#1e7bff', '#7cc0ff') if down else ('#f0283c', '#ff8a7c')
    r = math.pi / 2 if down else 0
    slab(P(c, .25, .7), rnd(move([(-1, 0), (-.14, .92), (-.14, .3), (.86, .3), (.86, -.3), (-.14, -.3), (-.14, -.92)], rot=r), .1), -.2, .3, .11)
    slab(P(l, .25, .7), rnd(move([(-.76, .02), (-.28, .54), (-.28, .14), (.7, .12), (.7, .05), (-.62, .03)], rot=r), .03), .2, .34, .03)

def swap(c, l, q):                       # one of the two crossing shuffle arrows
    def ribbon(m, w, head, z0, z1, b, x1):
        mid = [(-1, .6 * q)] + [p[:2] for p in bezier((-.72, .6 * q), (-.1, .6 * q), (-.14, -.6 * q), (x1 - .06, -.6 * q), 20)] + [(x1, -.6 * q)]
        A, B = [], []
        for i, (x, y) in enumerate(mid):
            p, n = mid[max(0, i - 1)], mid[min(len(mid) - 1, i + 1)]
            t = Vector((n[0] - p[0], n[1] - p[1])).normalized()
            A.append((x - t.y * w, y + t.x * w)); B.append((x + t.y * w, y - t.x * w))
        y = -.6 * q
        tip = [(x1, y - head), (x1 + head * 1.05, y), (x1, y + head)] if head else []
        slab(m, rnd(B + tip + A[::-1], .05), z0, z1, b)
    ribbon(P(c, .25, .7), .2, .46, -.2, .24, .08, .52)
    ribbon(P(l, .25, .6), .06, 0, .15, .3, .02, .5)

def chip(): coin()                       # the gold coin tucked between the arrows

# ---- The coin shop ----------------------------------------------------------
def pile():
    a, b = gold('#ffc22e'), gold('#f09a00')
    def stack(x, z, n, seed):
        random.seed(seed)
        for i in range(n):
            y = -.8 + .21 * i
            lathe(a if i % 2 == 0 else gold('#ffb01a'), rnd([(0, y), (.46, y), (.46, y + .2), (.36, y + .2), (.35, y + .17), (0, y + .17)], .035, closed=False), x=x + random.uniform(-.04, .04), z=z)
            lathe(b, [(.455, y + .07), (.478, y + .08), (.478, y + .12), (.455, y + .13)], x=x, z=z)
    stack(0, -.45, 8, 3)
    stack(-.56, .1, 5, 4)
    stack(.58, .1, 3, 5)

def shopstall():
    r, w, g, wd = P('#f0283c'), P('#ffffff'), gold('#ffbe1f'), P('#c0661c', .35, .5)
    panel(P('#4a1030', .6, .1), 0, 0, .82, .7, -.4, -.1, .05)
    panel(glow('#ffd27a', .55), 0, .06, .7, .4, -.2, 0, .04, .01)
    for x in (-.8, .8): panel(g, x, -.1, .09, .7, -.3, .3, .05, .04)
    panel(P('#8a2be8'), 0, -.62, .86, .36, -.4, .36, .06, .06)
    slab(g, rnd(star(.24, 0, -.64, .52), .03), .3, .46, .04)
    panel(wd, 0, -.26, .98, .1, -.4, .5, .06, .05)
    for x, c in ((-.46, '#1e7bff'), (.46, '#17c060')):      # goods on the counter
        slab(P(c, .1, 1), ngon(6, .19, math.pi / 6, x=x, y=-.02), .1, .34, .06)
    ball(gold('#ffc22e'), (0, .0, .25), .22, (1, 1, .4))
    for i in range(5):                   # striped awning with a scalloped hem
        x = -.88 + .44 * i
        m = r if i % 2 == 0 else w
        slab(m, [(x - .22, .42), (x + .22, .42), (x * .78 + .17, .92), (x * .78 - .17, .92)], -.4, .5, .04)
        cyl(m, (x, .42, .42), .22, .3, .05)

def shopsign():
    cyl(gold('#e08a00'), (0, 0, 0), .5, .2, .05)
    cyl(gold('#ffc22e'), (0, 0, .06), .46, .2, .05)
    slab(gold('#fff0a0'), rnd(star(.36, 0, -.01, .52), .04), .1, .26, .04)

def pack():
    p, l, g = P('#8a1fe0', .2, .8), P('#b65cff', .2, .7), gold('#ffbe1f')
    slab(p, rnd([(-.66, -.86), (.66, -.86), (.7, 0), (.66, .86), (-.66, .86), (-.7, 0)], .04), -.2, .2, .12)
    slab(l, [(-.5, .7), (-.5, -.2), (-.1, .7)], .1, .22, .01)
    for q in (-1, 1):                    # the crimped foil ends
        z = [(-.7 + 1.4 * i / 14, q * (1.06 if i % 2 else .98)) for i in range(15)]
        pts = [(-.7, q * .78)] + z + [(.7, q * .78)]
        slab(g, pts[::-1] if q > 0 else pts, -.16, .24, .02)
        for i in range(9): panel(gold('#d98200'), -.6 + .15 * i, q * .88, .022, .08, .2, .26, .01, 0)
    cyl(g, (0, -.02, .2), .54, .1, .04)
    cyl(P('#ff4fa0', .25, .7), (0, -.02, .24), .46, .1, .03)
def packface(): face('#ffe06a', True)

def playcard(c):                         # a card peeking out behind the pack
    panel(P('#ffffff'), 0, 0, .56, .86, -.1, .1, .1, .04)
    panel(P(c), 0, 0, .46, .74, 0, .14, .07, .03)
    slab(P('#ffffff'), rnd(star(.2, 0, .5, .52), .03), .1, .2, .02)

def signboard():
    panel(P('#5a1a9a'), 0, 0, 1.0, .8, -.3, .06, .24, .06)
    panel(gold('#ffb31a'), 0, 0, .98, .78, -.1, .2, .24, .09)
    panel(P('#8a2cf0', .25, .7), 0, 0, .78, .58, 0, .26, .14, .05)
    b = glow('#fff6c8', .9)
    for x, y in [(-.88 + .293 * i, q * .68) for i in range(1, 6) for q in (-1, 1)] + [(q * .88, -.44 + .44 * i) for i in range(3) for q in (-1, 1)]: ball(b, (x, y, .2), .07)

def plusfive():
    m = P('#ffd21c', .2, .8, emit=.12)
    r = .2
    for p, q in (((-1.12, 0), (-.28, 0)), ((-.7, -.42), (-.7, .42))):
        tube(m, [(*p, 0), (*q, 0)], r)
        for e in (p, q): ball(m, (*e, 0), r)
    pts = [(1.0, .68), (.36, .68), (.3, .06)] + [p[:2] for p in arc(.62, -.22, .43, 128, -140, n=40)]
    tube(m, [(*p, 0) for p in pts], r)
    for p in pts[:3] + pts[-1:]: ball(m, (*p, 0), r)

# ---- The shut makeup case ---------------------------------------------------
def shutcase():
    b, l, k = P('#a63a78', .6, .1), P('#b85490', .6, .1), P('#5a1440', .5, .1)
    panel(k, 0, -.36, .92, .5, -.3, .3, .16)
    panel(b, 0, -.36, .88, .46, 0, .44, .16, .1)
    panel(P('#e0a3c4', .5, .1), 0, -.42, .68, .22, .4, .5, .1, .03)
    for x, c in ((-.42, '#a83a4e'), (0, '#c0963c'), (.42, '#8050b0')): cyl(P(c, .5, .1), (x, -.42, .52), .16, .1, .04)
    slab(k, rnd([(-.96, .02), (.96, .02), (.94, .42), (.6, .72), (-.6, .72), (-.94, .42)], .24), -.3, .36, .06)
    slab(l, rnd([(-.92, .06), (.92, .06), (.9, .4), (.58, .68), (-.58, .68), (-.9, .4)], .22), -.2, .52, .14)
    slab(P('#d8a0c0', .5, .1), rnd(star(.2, -.46, .4, .3, 4), .02), .4, .56, .02)
    t = [TAU * i / 40 for i in range(40)]
    slab(P('#d8b45a', .4, .2), move([(.16 * math.sin(a) ** 3, .01 * (13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))) for a in t][::-1], 0, .06, 1.5), .4, .7, .06)

# ---- The list ---------------------------------------------------------------
G, B = '#5a2a00', '#1b1230'
badge('trophy', '#ff4038', '#8a0a18', L(cup, rim='#5a1400', fit=.68, lean=14))
badge('trophyFlame', '#b00a4c', '#560024', L(cup, rim='#4a1000', fit=.66, lean=14, dx=-4, dy=3), L(flame, rim='#6a0a00', fit=.36, dx=24, dy=-20, lean=0))
badge('laurel', '#5a6cff', '#1e2a9a', L(leaves, rim='#063a1c', fit=.74, lean=0), L(medal, rim=G, fit=.4, lean=0, dy=2))
badge('clapper', '#ff9412', '#9a4200', L(clapper, rim='#0c0f1c', fit=.64, lean=8))
badge('chest', '#14b45c', '#04582a', L(chest, rim='#3a1404', fit=.64, lean=16), L(face, '#ffd23a', True, rim='#4a2400', fit=.34, dy=-9, lean=0, px=3))
badge('crown', '#8a2cf0', '#3c0a86', L(dagger, rim=B, fit=.8, lean=(0, -42)), L(crown, rim=G, fit=.66, dy=-4, lean=8))
badge('ghostlight', '#26427c', '#0a1638', L(rays, rim='#7a4a00', fit=.7, dy=14, lean=0, px=2), L(ghostlamp, rim='#0a1024', fit=.72, dy=-2, lean=8), halo=(0, 14, 34, '#ffdf5a'))
badge('stopwatch', '#35b0ff', '#0a4c94', L(stopwatch, rim='#06185a', fit=.68, dx=-5, dy=4, lean=6))
badge('flag', '#14cfa4', '#04705c', L(flag, rim='#151a30', fit=.72, dx=2, lean=0))
badge('ladder', '#ffdd9a', '#c8862c', L(ladder, rim='#4a1a04', fit=.76, dy=-4, lean=0))
badge('masks', '#ff58a8', '#9a0a5c', L(face, '#4f9cff', False, rim='#0c1c5a', fit=.5, dx=15, dy=-9, lean=(0, -13)), L(face, '#ffcf2a', True, rim='#5a2a00', fit=.54, dx=-13, dy=7, lean=(0, 13)))
badge('ticket', '#12c8e4', '#04688a', L(ticket, rim='#5a1400', fit=.74, lean=(0, 14)))
badge('clipboard', '#98d420', '#447800', L(clipboard, rim='#3a1a04', fit=.7, lean=6))
badge('gift', '#d0a0ff', '#6a34b0', L(giftbox, rim='#2a0660', fit=.64, dy=2, lean=12))
badge('present', '#ffd21c', '#a86a00', L(presbox, rim='#4a0410', fit=.5, dy=-12, lean=12), L(preslid, rim='#4a0410', fit=.56, dy=14, lean=(0, 12)), L(spark, rim='#7a4a00', fit=.17, dx=-31, dy=14, lean=0, px=3), L(spark, rim='#7a4a00', fit=.2, dx=32, dy=4, lean=0, px=3))
badge('booklet', '#1c62f0', '#06247c', L(booklet, rim='#141830', fit=.68, lean=(6, -8)))
badge('star', '#8ea6cc', '#3c5078', L(bigstar, rim=G, fit=.7, lean=0))

PLAIN['drill'] = (L(drill, rim='#3a1a08', fit=.94, lean=(0, -56), px=6),)
PLAIN['stageleft'] = (L(row, False, rim='#6a3a00', fit=.95, lean=0), L(sweep, False, rim='#5a0414', fit=.86, dx=-2, lean=0, px=5))
PLAIN['trapdoor'] = (L(row, True, rim='#6a3a00', fit=.95, lean=0), L(sweep, True, rim='#06246a', fit=.86, dy=-2, lean=0, px=5))
PLAIN['coinflip'] = (L(swap, '#9a3cff', '#cf9cff', -1, rim='#2e0a6a', fit=.9, lean=0, px=6), L(swap, '#12b85a', '#7cf0a8', 1, rim='#033a1c', fit=.9, lean=0, px=6), L(chip, rim=G, fit=.3, dx=-25, lean=0, px=5))
PLAIN['coin-stack'] = (L(pile, rim=G, fit=.88, lean=24, px=5), L(chip, rim=G, fit=.42, dx=1, dy=-21, lean=(0, 10), px=5))
PLAIN['shop'] = (L(shopstall, rim='#3a0a20', fit=.84, dy=-7, lean=8, px=5), L(shopsign, rim=G, fit=.34, dy=30, lean=0, px=5))
PLAIN['cardpack'] = (L(playcard, '#1e9bff', rim=B, fit=.74, dx=-15, dy=3, lean=(0, 16)), L(playcard, '#ff4038', rim=B, fit=.74, dx=15, dy=3, lean=(0, -16)), L(pack, rim='#2a0660', fit=.88, lean=0, px=5), L(packface, rim=G, fit=.3, lean=0, px=3))
PLAIN['moves5'] = (L(signboard, rim='#2a0660', fit=.94, lean=8, px=5), L(plusfive, rim='#5a1400', fit=.62, lean=0, px=5))
PLAIN['makeupcase-closed'] = (L(shutcase, rim='#4a0a30', fit=.86, lean=8, px=5),)

def halo(a, dx, dy, r, color):           # a soft light on the disc behind the subject
    H, W = a.shape[:2]
    y, x = np.mgrid[0:H, 0:W]
    d = np.hypot(x - W / 2 - dx * 2.56, y - H / 2 - dy * 2.56) / (r * 2.56)
    g = np.zeros_like(a)
    g[..., :3] = rgb(color)
    g[..., 3] = np.clip(1 - d, 0, 1) ** 1.2 * .85 * a[..., 3]
    return over(a, g)

for name, (color, dark, layers, hl) in BADGES.items():
    if only and name not in only: continue
    a = photo(disc, (color, dark), '#4a2400', .93, 0, 0, 0, 4)
    if hl: a = halo(a, *hl)
    for l in layers: a = shadowed(a, photo(*l), dark)
    save(a, f'{DEST}/{name}.png')
for name, layers in PLAIN.items():
    if only and name not in only: continue
    a = photo(*layers[0])
    for l in layers[1:]: a = shadowed(a, photo(*l), '#1a0a3a')
    save(a, f'{DEST}/{name}.png')
