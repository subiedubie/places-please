# Every obstacle, floor, collectible and booster picture. Run it like gems.py
# (see rig.py). Each prop is a small function that builds the shapes facing the
# camera; the list at the bottom says which pictures exist.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *
import numpy as np

out, only = args()
TAU = math.tau

# ---- Paint pots ------------------------------------------------------------
def P(c, rough=.3, coat=.4, **k):      # glossy plastic / lacquer
    m = mat(c, rough=rough, coat=coat * .6, **k)
    m.node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = .28   # less milky edges
    return m

def gold(c='#ffb81c'): return mat(c, rough=.24, metal=.4, coat=.4, emit=.1)
def steel(c='#b9c6d8'): return mat(c, rough=.28, metal=.45, coat=.4)
def glow(c, e=1.0): return mat(c, rough=.3, emit=e)

GEMS = ['#ff9a08', '#f0183c', '#1464ff', '#06b34c', '#9a3cff']
DEEP = ['#a04a00', '#8a0420', '#062f96', '#02602a', '#4c0f96']   # the same, dark

# ---- Outlines (lists of x, y) ----------------------------------------------
# Round off every corner of an outline; closed=False leaves the two ends alone.
def rnd(pts, r, seg=5, closed=True):
    n, res = len(pts), []
    for i, p in enumerate(pts):
        if not closed and i in (0, n - 1):
            res.append(p)
            continue
        p = Vector(p)
        a, b = Vector(pts[i - 1]) - p, Vector(pts[(i + 1) % n]) - p
        k = min(r, a.length * .48, b.length * .48)
        a, b = p + a.normalized() * k, p + b.normalized() * k
        for j in range(seg + 1):
            t = j / seg
            q = a * (1 - t) ** 2 + p * 2 * t * (1 - t) + b * t * t
            res.append((q.x, q.y))
    return res

def rect(w, h, r=.1, x=0, y=0):         # w, h are half sizes
    return rnd([(x - w, y - h), (x + w, y - h), (x + w, y + h), (x - w, y + h)], r)

def ngon(n, r, rot=0, sx=1, sy=1, x=0, y=0):
    return [(x + r * sx * math.cos(rot + TAU * i / n), y + r * sy * math.sin(rot + TAU * i / n)) for i in range(n)]

def star(R, x=0, y=0, k=.5, n=5, rot=math.pi / 2):
    return [(x + (R if i % 2 == 0 else R * k) * math.cos(rot + math.pi * i / n),
             y + (R if i % 2 == 0 else R * k) * math.sin(rot + math.pi * i / n)) for i in range(2 * n)]

def move(pts, x=0, y=0, s=1, rot=0):
    c, n = math.cos(rot) * s, math.sin(rot) * s
    return [(x + a * c - b * n, y + a * n + b * c) for a, b in pts]

# ---- Solids ----------------------------------------------------------------
def panel(m, x, y, w, h, z0, z1, r=.1, bevel=.05):
    return slab(m, rect(w, h, r, x, y), z0, z1, bevel)

# Spin a profile of (radius, y) round the upright axis. With several materials
# they alternate in `bands` stripes round the body.
def lathe(mats, prof, x=0, y=0, z=0, n=96, bands=0, rz=1.0):
    if not isinstance(mats, (list, tuple)): mats = [mats]
    V = [(x + r * math.sin(TAU * j / n), y + h, z + rz * r * math.cos(TAU * j / n)) for r, h in prof for j in range(n)]
    F = [[i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j] for i in range(len(prof) - 1) for j in range(n)]
    o = obj(V, F, mats[0], smooth=True)
    for m in mats[1:]: o.data.materials.append(m)
    if len(mats) > 1:
        for f in o.data.polygons:
            c = f.center
            a = math.atan2(c.x - x, (c.z - z) / rz) + TAU / bands / 2
            f.material_index = int(math.floor(a / (TAU / bands))) % len(mats)
    return o

# A round rope / wire / bar through a list of (x, y, z) points.
def tube(m, pts, r, closed=False):
    cu = bpy.data.curves.new('t', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    s = cu.splines.new('POLY')
    s.points.add(len(pts) - 1)
    for p, q in zip(s.points, pts): p.co = (*q, 1)
    s.use_cyclic_u = closed
    s.use_smooth = True
    o = bpy.data.objects.new('t', cu)
    bpy.context.scene.collection.objects.link(o)
    cu.materials.append(m)
    return o

def arc(x, y, r, a0, a1, z=0, n=24, sx=1, sy=1):
    return [(x + sx * r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), y + sy * r * math.sin(math.radians(a0 + (a1 - a0) * i / n)), z) for i in range(n + 1)]

def bezier(a, b, c, d, n=20):
    res = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        res.append(tuple(u ** 3 * p + 3 * u * u * t * q + 3 * u * t * t * r + t ** 3 * s for p, q, r, s in zip(a, b, c, d)))
    return res

# A soft white highlight mark.
def streak(p, q, r, e=.6):
    m = glow('#ffffff', e)
    tube(m, [p, q], r)
    for c in (p, q): ball(m, c, r)

# A jagged dark (or glowing) split lying on a surface at height z.
def crack(m, pts, z, w=.07):
    L, R = [], []
    for i, (x, y) in enumerate(pts):
        k = 0.005 if i in (0, len(pts) - 1) else w
        L.append((x - k, y)); R.append((x + k, y + .02))
    slab(m, L + R[::-1], z - .06, z + .015, bevel=0)

def five(m, mid, x, y, z, r, petals=5):    # a chunky flower
    for i in range(petals):
        a = TAU * i / petals + math.pi / 2
        ball(m, (x + .58 * r * math.cos(a), y + .58 * r * math.sin(a), z), .48 * r, (1, 1, .6))
    ball(mid, (x, y, z + .2 * r), .34 * r, (1, 1, .8))

def bow(m, x, y, z, s):                    # a ribbon bow
    for d in (-1, 1):
        slab(m, rnd(move([(0, 0), (d * 1, .62), (d * 1.05, -.45)], x, y, s), .18 * s), z - .1 * s, z + .22 * s, .08 * s)
        slab(m, move([(0, 0), (d * .75, -1.1), (d * .4, -1.15), (d * .12, -.4)], x, y, s), z - .14 * s, z + .05 * s, .04 * s)
    ball(m, (x, y, z + .18 * s), .3 * s)

# ---- Studio ----------------------------------------------------------------
# Lean everything back so its top shows, fit it to the cell, render, and draw
# a dark rim round the silhouette so it stands off the board.
# fit: how much of the cell to fill. pin: a point that must land in the middle.
def finish_shot(name, w, h, lean, fit, rim, px, pin=None, small=None):
    sc = bpy.context.scene
    k = max(w, h)
    for o in sc.objects:                    # bigger pictures need the lights further out
        if o.type == 'LIGHT' and k > 1:
            o.location = Vector(o.location) * k
            o.data.size *= k
            o.data.energy *= k * k
    things = [o for o in sc.objects if o.type in ('MESH', 'CURVE')]
    lean, turn = lean if isinstance(lean, tuple) else (lean, 0)
    e = bpy.data.objects.new('root', None)
    sc.collection.objects.link(e)
    for o in things: o.parent = e
    e.rotation_euler = (math.radians(lean), 0, math.radians(turn))
    if fit:
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        xs, ys = [], []
        for o in things:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            for v in me.vertices:
                q = ev.matrix_world @ v.co
                xs.append(q.x); ys.append(q.y)
            ev.to_mesh_clear()
        if pin:
            q = e.matrix_world @ Vector(pin)
            rx, ry = max(max(xs) - q.x, q.x - min(xs)), max(max(ys) - q.y, q.y - min(ys))
            xs, ys = [q.x - rx, q.x + rx], [q.y - ry, q.y + ry]
        s = min(2 * w * fit / (max(xs) - min(xs)), 2 * h * fit / (max(ys) - min(ys)))
        e.scale = (s, s, s)
        e.location = (-s * (max(xs) + min(xs)) / 2, -s * (max(ys) + min(ys)) / 2, 0)
    elif small: e.scale = (small, small, small)
    path = os.path.abspath(f'{out}/{name}.png')
    shoot(path)
    edge(path, rim or '#000000', px if rim else 0)

def edge(path, color, r):
    im = bpy.data.images.load(path, check_existing=False)
    W, H = im.size
    a = np.empty(W * H * 4, np.float32)
    im.pixels.foreach_get(a)
    a = a.reshape(H, W, 4)
    n = int(r) + 2
    al = np.pad(a[..., 3], n)
    big = np.zeros_like(al)
    for dy in range(-n, n + 1):
        for dx in range(-n, n + 1):
            k = min(1, max(0, r + .5 - math.hypot(dx, dy)))
            if k: big = np.maximum(big, np.roll(al, (dy, dx), (0, 1)) * k)
    big = big[n:-n, n:-n]
    c = np.array([int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    A = a[..., 3:4]
    grey = a[..., :3] @ np.array([.3, .59, .11], np.float32)
    a[..., :3] = np.clip(grey[..., None] + (a[..., :3] - grey[..., None]) * 1.22, 0, 1)   # a little richer
    tot = np.maximum(A, big[..., None])
    rgb = (a[..., :3] * A + c * (tot - A)) / np.maximum(tot, 1e-5)
    a = np.concatenate([rgb, tot], 2).astype(np.float32)
    im.pixels.foreach_set(a.ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()

JOBS = []
def add(name, fn, *a, w=1, h=1, lean=16, fit=.86, rim='#2a1a33', px=5, pin=None, small=None):
    JOBS.append((name, fn, a, w, h, lean, fit, rim, px, pin, small))

# ---- Batch 1 ---------------------------------------------------------------
def crate():
    lt, md, dk = P('#f0a84e', .4, .4), P('#a8581a', .45, .3), P('#6d3208', .5, .2)
    cube(dk, (0, 0, -.05), (1.7, 1.7, .9))
    for i in range(3): cube(md, (-.46 + .46 * i, 0, .36), (.43, 1.4, .2), .04)
    cube(lt, (0, 0, .5), (1.7, .3, .2), .05, (0, 0, 45))
    for d in (-1, 1):
        cube(lt, (0, d * .72, .52), (1.8, .36, .34), .07)
        cube(lt, (d * .72, 0, .5), (.36, 1.2, .3), .07)
    n = steel('#5b3a22')
    for x in (-.72, .72):
        for y in (-.72, .72): ball(n, (x, y, .68), .09, (1, 1, .5))
    cube(lt, (0, .8, -.05), (1.7, .2, .9), .05)

def hatbox(hp):
    w, k, pk, dp = P('#ffffff'), P('#3a2a52'), P('#ff5fa2'), P('#c01f68')
    lathe([w, k], rnd([(0, -.75), (.82, -.75), (.82, .35), (.7, .35), (.7, -.3), (0, -.3)], .08, closed=False), bands=14)
    lathe(dp, rnd([(.8, -.75), (.88, -.75), (.88, -.58), (.8, -.58)], .04, closed=False))
    if hp == 2:
        lathe(pk, rnd([(0, .3), (.96, .22), (.96, .58), (.86, .68), (0, .68)], .07, closed=False))
        lathe(dp, rnd([(.94, .2), (1.0, .2), (1.0, .33), (.94, .33)], .03, closed=False))
        bow(w, 0, .72, .62, .44)
    else:
        lathe(dp, rnd([(.7, .26), (.87, .26), (.87, .4), (.7, .4)], .05, closed=False))
        lathe(P('#1d1230', .7, 0), [(0, .3), (.72, .3)])                # the dark inside
        for x, z, r in ((-.4, .25, .2), (.02, .42, .22), (.42, .2, .2), (-.1, .0, .2)):
            ball(P('#ffd9ea', .5, .2), (x, .36, z), r, (1, .6, 1))      # tissue paper
        cyl(dp, (-.42, -.34, 1.0), .58, .16, .05, rot=(-16, 0, 0))      # the lid, leaning on the front
        cyl(pk, (-.42, -.34, 1.1), .5, .12, .05, rot=(-16, 0, 0))
        bow(w, -.42, -.3, 1.2, .26)

def dryice():
    c, l = P('#36bdf2', .12, 1), P('#a5ecff', .1, 1)
    panel(P('#0f7fc4'), 0, .1, .84, .8, -.4, .1, .22)
    panel(c, 0, .12, .8, .76, 0, .42, .2, .14)
    panel(l, 0, .16, .55, .5, .3, .5, .12, .08)
    for p, q in (((-.3, .02), (.12, .44)), ((-.06, -.16), (.3, .2))):
        streak((*p, .5), (*q, .5), .07, .25)
    fog = P('#f2f8ff', .7, 0)
    for x, y, r in ((-.72, -.6, .27), (-.34, -.7, .32), (.1, -.66, .34), (.5, -.72, .28), (.8, -.6, .22)):
        ball(fog, (x, y, .45), r)

def trunk(hp):
    br, dk, st, g = P('#8c3a1e', .35, .6), P('#4a1a0c', .4, .4), P('#ffd98a', .35, .5), gold()
    body = rnd([(-.9, -.8), (.9, -.8), (.9, .0), (-.9, .0)], .08)
    lid = rnd([(-.9, .0), (.9, .0), (.9, .45), (.62, .78), (-.62, .78), (-.9, .45)], .22)
    slab(br, body, -.45, .4, .07)
    o = slab(br, lid, -.45, .42, .1)
    if hp == 1:                              # the lid has sprung open
        o.rotation_euler[2] = math.radians(9); o.location = (0, .16, 0)
        panel(glow('#ffc94a', .6), 0, .04, .78, .2, -.3, .2, .03)
    else:
        cube(dk, (0, .02, .42), (1.82, .12, .1), .02)
    for d, need in ((-1, 2), (1, 3)):
        if hp >= need:
            panel(st, d * .5, -.01, .15, .84, -.4, .52, .06, .05)
            panel(g, d * .5, -.4, .19, .12, .4, .6, .04)
        else:                                # a torn stump of the strap
            slab(st, [(d * .5 - .15, -.8), (d * .5 + .15, -.8), (d * .5 + .15, -.5), (d * .5 + .05, -.6), (d * .5 - .03, -.44), (d * .5 - .15, -.56)], .3, .5, .03)
    for d in (-1, 1):
        panel(g, d * .8, -.7, .16, .16, .2, .5, .06)
        if hp > 1: panel(g, d * .82, .14, .12, .12, .2, .5, .05)
    panel(g, 0, -.02, .2, .24, .4, .6, .07)
    cyl(dk, (0, -.06, .6), .08, .06)
    if hp <= 2: crack(dk, [(.3, -.12), (.16, -.34), (.34, -.46), (.12, -.78)], .41, .07)
    if hp == 1: crack(dk, [(-.36, -.1), (-.2, -.32), (-.4, -.5), (-.16, -.8)], .41, .08)

def paint(c):
    col, deep, tin = P(GEMS[c]), P(DEEP[c]), steel('#dfe6f0')
    lathe(col, rnd([(0, -.98), (.84, -.98), (.84, .66), (0, .66)], .06, closed=False))
    for y in (-.94, .62): lathe(tin, rnd([(.78, y - .1), (.95, y - .1), (.95, y + .1), (.7, y + .1), (.68, y - .02), (0, y - .02)], .06, closed=False))
    cyl(col, (0, .68, 0), .68, .04, rot=(90, 0, 0))
    for x, l, r in ((-.7, .66, .17), (.72, .42, .16)):   # drips over the rim
        z = math.sqrt(1 - x * x)
        tube(col, [(x * .7, .74, z * .7), (x, .74, z), (x, .72 - l, z)], r)
        ball(col, (x, .72 - l, z), r)
        ball(col, (x, .72, z), r)
    tube(steel('#8c9ab0'), arc(0, .5, .86, 5, 175, -.3, sy=.56), .08)
    cyl(deep, (0, .06, .92), .62, .1)
    cyl(P('#ffffff', .5, .2, emit=.12), (0, .06, .98), .55, .1)

def cashbox():
    b, l, d, g = P('#4f7fae'), P('#8fbbe0'), P('#1d3550'), gold()
    cyl(g, (.22, .42, 0), .5, .2, .05)
    cyl(gold('#ffe08a'), (.22, .42, .1), .34, .06, .02)
    panel(d, 0, -.3, .9, .62, -.5, .3, .12)
    panel(b, 0, -.28, .86, .56, -.4, .42, .12, .09)
    panel(l, 0, .2, .9, .16, -.45, .48, .08, .06)
    panel(d, .22, .31, .58, .06, .1, .5, .03, .01)
    cyl(g, (0, -.36, .46), .32, .16, .05)
    cyl(d, (0, -.3, .55), .1, .06, .01)
    panel(d, 0, -.42, .05, .13, .5, .58, .02, .01)

def flat(hp):
    s = [P('#a9a0c6', .6, .15), P('#948ab4', .6, .15), P('#bdb5d6', .6, .15)]
    k = P('#453d5e', .7, 0)
    gone = [[], [1, 4], [0, 1, 2, 4]][3 - hp]        # which stones have been knocked out
    B = [(0, -.45, .4), (0, .45, .4), (1, -.67, .19), (1, 0, .4), (1, .67, .19), (2, -.45, .4), (2, .45, .4)]
    for i, (row, x, w) in enumerate(B):
        y = .6 - .6 * row
        if i not in gone:
            panel(k, x, y, w + .06, .32, -.4, .12, .03)
            panel(s[i % 3], x, y, w, .26, 0, .46, .07, .09)
    def rubble(x, y, r, t):
        slab(k, ngon(6, r + .06, t, x=x, y=y), -.3, .1, .02)
        slab(s[t % 3], ngon(6, r, t, x=x, y=y), 0, .5, .06)
    if hp == 2:
        rubble(.32, .4, .13, 0); rubble(.74, -.12, .17, 2)
        crack(k, [(-.7, .85), (-.5, .62), (-.62, .5), (-.4, .36)], .46, .06)
    if hp == 1:
        rubble(-.66, -.12, .17, 0); rubble(.62, -.1, .2, 2); rubble(-.2, .4, .12, 1)
        crack(k, [(-.2, .25), (.04, .08), (-.1, -.06), (.14, -.25)], .46, .06)
        crack(k, [(-.7, -.36), (-.46, -.56), (-.6, -.66), (-.3, -.86)], .46, .07)

def strongbox(hp):
    d, m, l, g, k = P('#333b52'), P('#4c5876'), P('#7d8cb0'), gold(), P('#161a28')
    for x in (-.6, .6): cube(k, (x, -.88, 0), (.34, .2, .6))
    panel(d, 0, 0, .9, .88, -.5, .3, .16, .1)
    if hp == 2:
        panel(l, 0, 0, .74, .72, .2, .4, .12, .06)
        panel(m, 0, 0, .66, .64, .3, .46, .1, .05)
        for x in (-.52, .52):
            for y in (-.5, .5): ball(l, (x, y, .46), .07)
        for y in (-.4, .4): cyl(g, (-.8, y, .36), .1, .34, rot=(90, 0, 0))
        cyl(k, (0, 0, .5), .46, .1)
        torus(g, (0, 0, .62), .36, .1)
        for i in range(3):
            a = TAU * i / 3 + math.pi / 2
            tube(g, [(0, 0, .64), (.5 * math.cos(a), .5 * math.sin(a), .64)], .07)
            ball(g, (.52 * math.cos(a), .52 * math.sin(a), .64), .11)
        ball(g, (0, 0, .66), .17)
    else:
        panel(P('#0d1020', .6, 0), -.14, 0, .64, .72, .2, .36, .08, .02)
        for x, y in ((-.5, -.46), (.06, -.46), (-.48, -.1), (.04, -.1), (-.22, .26)):
            slab(g, rnd(move([(-.27, -.15), (.27, -.15), (.2, .15), (-.2, .15)], x, y), .04), .3, .62, .06)
        panel(l, .78, 0, .17, .88, .1, .75, .08, .06)      # the door, swung open
        panel(m, .8, 0, .1, .72, .6, .82, .06, .04)
        for y in (-.4, .4): cyl(g, (.6, y, .6), .09, .3, rot=(90, 0, 0))
        slab(glow('#fff3b0', 1.2), star(.18, -.46, .5, .28, 4), .6, .66, .01)

def costume(hp):
    t, dk, g = P('#12a8a0', .35, .6), P('#075e60'), gold()
    V = [(0, -.86), (.5, -.84), (.78, -.6), (.84, -.2), (.7, .12), (.42, .36), (.3, .46)]
    lathe(t, rnd(V, .25, closed=False), rz=.6)
    for i in range(5):                       # the ruffled top above the cord
        x = math.sin(math.radians(-60 + 30 * i))
        tube(t, [(x * .24, .44, .12), (x * .62, .86 - .1 * abs(x), .12)], .17)
    lathe(g, [(.3 + .1 * math.cos(q * TAU / 16), .46 + .1 * math.sin(q * TAU / 16)) for q in range(17)], rz=.75)
    ball(g, (.2, .44, .32), .14)
    tube(g, bezier((.2, .44, .34), (.36, .4, .4), (.5, .3, .4), (.46, .08, .46)), .045)
    ball(g, (.46, .06, .48), .1)
    y = glow('#ffe84a', 1.6)
    # a rip with ragged edges and gold light inside
    def rip(x, y0, w, h, rot):
        o = [(0, h), (-.5 * w, .55 * h), (-.35 * w, .35 * h), (-w, 0), (-.6 * w, -.25 * h), (-.6 * w, -.5 * h), (0, -h),
             (.5 * w, -.6 * h), (.4 * w, -.35 * h), (w, -.05 * h), (.55 * w, .25 * h), (.65 * w, .5 * h)]
        slab(dk, move(o, x, y0, 1.3, rot), .52, .58, 0)
        slab(y, move(o, x, y0, .92, rot), .3, .6, 0)
    if hp > 1: slab(gold('#ffc93a'), rnd(star(.44, .16 if hp == 2 else .02, -.3, .5), .06), .3, .6, .06)
    if hp == 2: rip(-.48, -.24, .19, .38, .2)
    if hp == 1:
        rip(0, -.3, .42, .42, .15)
        slab(gold('#ff9a00'), rnd(star(.3, 0, -.3, .5), .04), .5, .66, .04)
        rip(-.62, -.3, .1, .22, .3)
        rip(.62, -.26, .1, .22, -.3)

def padlock():
    s, d, g, k = steel('#c9d3e2'), steel('#6d7a92'), gold('#ffb01c'), P('#4a2400')
    def chain(flip, dz):
        pts = [(flip * x, y, dz) for x, y, _ in bezier((-.92, .92, 0), (-.86, .2, 0), (-.6, -.3, 0), (.92, -.86, 0), 400)]
        L = [0]
        for p, q in zip(pts, pts[1:]): L.append(L[-1] + math.dist(p, q))
        n = 11
        for i in range(n):
            t = L[-1] * (i + .5) / n
            j = min(range(len(L)), key=lambda q: abs(L[q] - t))
            p, q = pts[max(0, j - 3)], pts[min(len(pts) - 1, j + 3)]
            a = math.atan2(q[1] - p[1], q[0] - p[0])
            x, y, z = pts[j]
            if i % 2 == 0:                   # links lie flat and on edge in turn
                ring = move([(u, v) for u, v, _ in arc(.07, 0, .085, -90, 90) + arc(-.07, 0, .085, 90, 270)], x, y, 1.1, a)
                tube(s, [(u, v, z) for u, v in ring], .06, True)
            else:
                tube(d, [(x - .1 * math.cos(a), y - .1 * math.sin(a), z), (x + .1 * math.cos(a), y + .1 * math.sin(a), z)], .06)
    chain(1, 0); chain(-1, .14)
    tube(s, [(-.2, -.5, .35)] + [(x, y, .35) for x, y, _ in arc(0, -.3, .2, 180, 0)] + [(.2, -.5, .35)], .075)
    panel(P('#8a4a00'), 0, -.66, .38, .27, .05, .4, .1)
    panel(g, 0, -.64, .35, .25, .2, .56, .1, .08)
    cyl(k, (0, -.6, .56), .085, .04, .01)
    panel(k, 0, -.7, .04, .1, .5, .58, .02, 0)

def sandbag():
    t, r = P('#e0aa62', .6, .2), P('#e8402a', .4, .4)
    lathe(t, rnd([(0, -.88), (.56, -.88), (.84, -.66), (.82, -.2), (.62, .16), (.26, .4), (.24, .46)], .24, closed=False), rz=.65)
    for i in range(5):
        x = math.sin(math.radians(-56 + 28 * i))
        tube(t, [(x * .2, .46, .1), (x * .46, .72 - .06 * abs(x), .1)], .13)
    lathe(r, [(.28 + .1 * math.cos(q * TAU / 16), .44 + .1 * math.sin(q * TAU / 16)) for q in range(17)], rz=.85)
    torus(steel(), (0, .86, .1), .17, .06)
    # a big arrow: this one has to come down
    slab(P('#24408e'), rnd(move([(-.14, .34), (.14, .34), (.14, 0), (.38, 0), (0, -.4), (-.38, 0), (-.14, 0)], 0, -.26, 1.2), .03), .4, .6, .03)

# ---- Batch 2 ---------------------------------------------------------------
def planter(hp):
    pot, rim, dk = P('#d95f2e', .4, .4), P('#f5864a', .4, .4), P('#7a2c10')
    lf = [P('#2fae3f', .4, .3), P('#1f8a35', .4, .3), P('#53c94f', .4, .3)]
    lathe(pot, rnd([(0, -1.7), (1.02, -1.7), (1.3, -.5), (0, -.5)], .15, closed=False), rz=.7)
    lathe(rim, rnd([(0, -.62), (1.5, -.66), (1.54, -.2), (0, -.2)], .12, closed=False), rz=.7)
    random.seed(7)
    for i, (x, y, z, r) in enumerate([(-1.05, .25, .1, .6), (1.05, .25, .1, .6), (-.8, .95, .05, .58), (.8, .95, .05, .58), (0, 1.25, 0, .6),
                                      (-.45, .6, .3, .52), (.5, .55, .3, .52), (0, .1, .4, .5), (.05, .95, .35, .44), (-.75, .1, .35, .36), (.75, .1, .35, .36)]):
        ball(lf[(i * 2 + i // 3) % 3], (x, y, z), r, (1, 1, .7))
    mid = P('#ffd21c')
    spots = [(-.9, .3), (.9, .3), (0, .3), (-.48, 1.0), (.5, 1.0)]
    cols = [P('#ff4f93'), P('#ffffff'), P('#ff4f93'), P('#ffffff'), P('#ff4f93')]
    for i in range(hp): five(cols[i], mid, *spots[i], .95, .46)
    if hp <= 3: crack(dk, [(-.6, -.75), (-.4, -1.0), (-.62, -1.2), (-.4, -1.5)], .83, .06)
    if hp <= 1: crack(dk, [(.6, -.72), (.4, -1.0), (.66, -1.2), (.5, -1.6)], .83, .07)

def bouquet(hp):
    gr, wr, we, mid = P('#2fae3f', .4, .3), P('#fff0cf', .45, .3), P('#e6c88e', .45, .2), P('#ffd21c')
    for x in ((-.5, 0, .5) if hp == 2 else (0, -.3, .3)): tube(gr, [(0, -.5, 0), (x, .3, .1)], .06)
    for d in (-1, 1):
        o = ball(gr, (d * .66, .0, .0), .3, (1, .5, .4)); o.rotation_euler[2] = d * .6
    if hp == 2:
        five(P('#ff4f93'), mid, -.48, .3, .3, .44)
        five(P('#ff7a2a'), mid, .48, .3, .3, .44)
        five(P('#b04cff'), mid, 0, .56, .42, .46)
    else:
        five(P('#b04cff'), mid, 0, .5, .42, .46)
        for x in (-.42, .42): ball(gr, (x, .22, .1), .1)
    slab(we, rnd([(-.74, .12), (0, -.3), (.74, .12), (.22, -.9), (-.22, -.9)], .06), -.1, .24, .05)
    slab(wr, rnd([(-.78, .16), (-.1, -.2), (.1, -.5), (.2, -.9), (-.22, -.9)], .06), .2, .4, .05)
    slab(wr, rnd([(.78, .16), (.0, -.28), (-.2, -.9), (.22, -.9)], .06), .16, .34, .05)
    bow(P('#ff3d7f'), 0, -.5, .5, .36)

def tophat():
    b, r, g = P('#2b2440', .2, 1), P('#e8213c', .25, .8), gold()
    lathe(b, rnd([(0, .82), (.66, .82), (.56, -.4), (.6, -.52), (.98, -.48), (.98, -.6), (0, -.66)], .07, closed=False), rz=.85)
    lathe(r, rnd([(.57, -.42), (.63, -.4), (.63, -.08), (.58, -.06)], .03, closed=False), rz=.87)
    slab(g, rnd(star(.24, 0, -.22), .03), .5, .62, .03)
    streak((-.4, .56, .46), (-.36, .1, .42), .055, 0)

def kernels(pts, z, r):
    c = [P('#fff3c4', .6, .2), P('#ffd95a', .5, .3), P('#ffe894', .6, .2)]
    for i, (x, y) in enumerate(pts):
        ball(c[i % 3], (x, y, z), r)
        for j in range(4):
            a = TAU * j / 4 + i
            ball(c[(i + j) % 3 if j else 0], (x + r * .6 * math.cos(a), y + r * .6 * math.sin(a), z + r * .4), r * .6)

def popper():
    r, w, g, gl = P('#e8213c'), P('#ffffff'), gold(), P('#bfeaff', .1, 1)
    for x in (-.42, .42):
        torus(g, (x, -.68, .3), .2, .07)
        cyl(P('#5a3210'), (x, -.68, .25), .18, .1)
        ball(g, (x, -.68, .34), .08)
    panel(r, 0, -.34, .78, .3, -.4, .36, .08, .07)
    panel(w, 0, -.3, .44, .17, .3, .42, .06, .03)
    slab(g, rnd(star(.17, 0, -.31, .5), .02), .4, .48, .02)
    panel(P('#2f8fc4'), 0, .2, .7, .4, -.3, .0, .04)
    panel(gl, 0, .22, .6, .36, -.1, .06, .04, .02)
    kernels([(-.42, .06), (-.14, .02), (.16, .04), (.44, .06), (-.26, .24), (.04, .28), (.3, .22)], .2, .17)
    for x in (-.68, .68): panel(g, x, .2, .06, .36, 0, .36, .03, .02)
    for i in range(6):                       # striped roof with a scalloped hem
        x = -.75 + .3 * i
        m = r if i % 2 == 0 else w
        slab(m, [(x - .16, .56), (x + .16, .56), (x * .74 + .12, .92), (x * .74 - .12, .92)], -.4, .42, .03)
        cyl(m, (x, .56, .3), .16, .3, .04)

def candyjar(hp):
    r, gl = P('#e8213c'), mat('#e8f8ff', rough=.1, coat=.2, alpha=.09)
    prof = rnd([(0, -.88), (.7, -.88), (.82, -.6), (.82, .16), (.56, .42), (.56, .52)], .16, closed=False)
    lathe(P('#8fcbee', .2, .6), prof, z=-.2, rz=.35)
    cols = [P(c, .2, 1) for c in ('#ff3d8b', '#ffd21c', '#18c6a0', '#2f9bff', '#a04cff', '#ff7a1c')]
    k = 0
    for row in range(hp):
        for x in (-.45, 0, .45):
            ball(cols[k % 6], (x, -.58 + .4 * row + (.05 if x == 0 else 0), .12), .245)
            k += 1
    lathe(gl, prof, rz=.6)
    streak((-.66, .12, .5), (-.67, -.3, .5), .055)
    lathe(r, rnd([(0, .46), (.68, .46), (.68, .78), (.6, .86), (0, .86)], .06, closed=False), rz=.7)
    lathe(gold(), rnd([(.6, .4), (.64, .4), (.64, .5), (.6, .5)], .02, closed=False), rz=.8)
    ball(gold(), (0, .92, 0), .17)

def dovebird(x, y, z, s, look=1):
    w, sh, o, k = P('#ffffff', .4, .4, emit=.1), P('#c3d4f2', .4, .3), P('#ff8a1c'), P('#1c2033')
    ball(w, (x, y, z), .3 * s, (1.3, 1, .9))
    ball(w, (x + look * .28 * s, y + .3 * s, z + .05 * s), .22 * s)
    cyl(o, (x + look * .52 * s, y + .26 * s, z + .05 * s), .08 * s, .18 * s, rot=(0, 90 * look, 0), r2=.005)
    ball(k, (x + look * .34 * s, y + .35 * s, z + .24 * s), .05 * s)
    slab(sh, rnd(move([(0, .1), (-look * .5, .16), (-look * .62, -.02), (-look * .1, -.14)], x, y, s), .06 * s), z + .22 * s, z + .36 * s, .04 * s)

def dovecote(hp):
    w = [P('#fff7e8', .45, .3), P('#f0e2c8', .45, .3)]
    rf = [P('#2f7fe0'), P('#4c9cf5')]
    dk, wd = P('#2a1c3a', .7, 0), P('#a8672f', .4, .3)
    slab(dk, [(-1.16, -1.5), (1.16, -1.5), (1.16, .3), (0, 1.4), (-1.16, .3)], -.5, .3, .05)
    gone = {5: [], 4: [], 3: [0], 2: [0, 4], 1: [0, 4, 1]}[hp]
    for i in range(5):                       # wall boards; broken ones leave a stub
        x = -.96 + .48 * i
        if i not in gone: panel(w[i % 2], x, -.5, .225, 1.02, .1, .5, .05, .05)
        else: slab(w[i % 2], [(x - .22, -1.52), (x + .22, -1.52), (x + .22, -1.1), (x + .08, -1.25), (x - .06, -1.0), (x - .22, -1.2)], .1, .46, .04)
    panel(wd, 0, -1.52, 1.4, .16, -.5, .72, .08, .06)
    cyl(gold('#e8a020'), (0, -.1, .48), .56, .16)
    cyl(dk, (0, -.1, .54), .44, .12, .01)
    tube(wd, [(0, -.75, .3), (0, -.75, 1.1)], .1)
    cyl(wd, (0, -.78, .62), .14, .7, rot=(0, 90, 0))
    dovebird(-.06, -.3, .7, .78)
    # roof shingles, three a side; they come off with the hits
    lost = {5: [], 4: [(1, 0)], 3: [(1, 0), (-1, 2)], 2: [(1, 0), (1, 1), (-1, 2)], 1: [(1, 0), (1, 1), (-1, 2), (-1, 1)]}[hp]
    for d in (-1, 1):
        for k in range(3):
            if (d, k) in lost: continue
            t0, t1 = k / 3, (k + 1) / 3
            lo, hi = Vector((d * 1.6, 0)), Vector((0, 1.55))
            p0, p1 = lo.lerp(hi, t0), lo.lerp(hi, t1 + .03)
            n = Vector((-d * 1.55, -1.6)).normalized() * .44
            slab(rf[k % 2], rnd([tuple(p0), tuple(p1), tuple(p1 + n), tuple(p0 + n)], .05), -.5, .8 + .04 * k, .06)
    slab(P('#1b5ec0'), rnd([(0, 1.72), (.5, 1.22), (.28, 1.0), (0, 1.26), (-.28, 1.0), (-.5, 1.22)], .06), -.4, .98, .06)
    cr = P('#6b5640', .7, 0)
    if hp <= 4: crack(cr, [(.5, .3), (.66, .0), (.46, -.3), (.62, -.5)], .5, .07)
    if hp <= 2: crack(cr, [(-.4, -.7), (-.56, -1.0), (-.4, -1.2), (-.5, -1.4)], .5, .07)

def footlights():
    d, g, k = P('#4a3fb4'), gold(), P('#0f0e28', .5, .2)
    panel(P('#1a1840'), 0, 0, 1.84, 1.84, -.5, .1, .3)
    panel(g, 0, 0, 1.82, 1.82, -.1, .2, .3, .08)
    panel(d, 0, 0, 1.66, 1.66, 0, .28, .24, .06)
    for x in (-1, 1):
        for y in (-1, 1):
            torus(g, (x, y, .3), .62, .1)
            cyl(k, (x, y, .25), .6, .1, .01)
    b = glow('#fff2b0', 1.0)
    for p in ((0, 0), (0, 1.1), (0, -1.1), (1.1, 0), (-1.1, 0)): ball(b, (*p, .32), .15)

def fireworks():
    r, dk, g, k = P('#e8213c'), P('#8a0c20'), gold(), P('#2a0610', .5, .2)
    # the fuse, already burning
    tube(P('#6b4a2a', .7, 0), bezier((.2, .5, 0), (.2, 1.1, 0), (.7, .5, .1), (.82, .76, .1)), .07)
    slab(glow('#ff8a00', 1.2), star(.24, .84, .67, .5, 8), .1, .2, .01)
    slab(glow('#fff27a', 1.6), star(.14, .84, .67, .5, 8), .15, .26, .01)
    panel(dk, 0, -.1, 1.86, .76, -.5, .2, .12)
    panel(r, 0, -.1, 1.82, .72, -.2, .3, .12, .08)
    panel(P('#ffa01c'), 0, -.74, 1.86, .13, -.2, .42, .06, .05)
    for x in (-1.2, 0, 1.2):
        cyl(g, (x, 0, .32), .56, .2, .06)
        cyl(k, (x, 0, .4), .46, .08, .01)
    for x in (-.6, .6):
        for q in (.26, -.36): slab(glow('#ffd21c', .3), star(.17, x, q, .45, 5), .3, .42, .02)

def truss(n, hp):
    s, d, dk = steel('#dfe8f5'), steel('#6f80a0'), P('#3f4b63')
    a = n - .1
    for x in (-a + .8, a - .8) + ((0,) if n > 3 else ()):    # stage lamps
        lit = not (hp == 1 and x > .1)
        cyl(P('#38405a'), (x, -.12, 0), .24, .4, .04, rot=(90, 0, 0))
        lathe(P('#3a4272'), rnd([(0, -.02), (.34, -.02), (.52, -.6), (0, -.6)], .06, closed=False), x=x)
        lathe(glow('#ffe26a', .9) if lit else P('#20242f', .6, .1), rnd([(0, -.58), (.54, -.58), (.54, -.74), (0, -.86)], .06, closed=False), x=x)
    spans = [(-a, a)] if hp == 2 else [(-a, -.22), (.22, a)]
    for i, (x0, x1) in enumerate(spans):
        dy = -.1 * i
        for y in (.72, .12):
            tube(s, [(x0, y + dy, .25), (x1, y + dy, .25)], .13)
            tube(d, [(x0, y + dy, -.25), (x1, y + dy, -.25)], .12)
        m = max(2, round((x1 - x0) / .6))
        for j in range(m):
            p, q = x0 + (x1 - x0) * j / m, x0 + (x1 - x0) * (j + 1) / m
            u, v = (.14, .7) if j % 2 == 0 else (.7, .14)
            tube(d, [(p, u + dy, .16), (q, v + dy, .16)], .08)
    for x in (-a, a): panel(gold(), x * .985, .42 - (.1 if hp == 1 and x > 0 else 0), .12, .46, -.4, .5, .06)
    if hp == 1:                              # bent, broken rail ends and sparks
        for q, y in ((-1, .72), (-1, .12), (1, .62), (1, .02)):
            tube(s, [(q * .22, y, .25), (q * .1, y + q * .1 - .1, .3)], .12)
        slab(glow('#ffd21c', 1.5), star(.32, 0, .4, .4, 6), .3, .4, .02)
        slab(glow('#ff7a1c', 1), star(.16, 0, .4, .5, 6), .4, .46, .01)

def ticketbooth(hp):
    r, w, g, st = P('#e8213c'), P('#fff3dc', .4, .4), gold(), steel('#aeb9cb')
    panel(P('#6b0f1e'), 0, -.15, 2.8, .72, -.5, .1, .1)
    for i in range(15):
        panel(r if i % 2 == 0 else w, -2.59 + .37 * i, -.12, .18, .68, -.3, .22, .03, .03)
    panel(P('#c0182e'), 0, -.78, 2.84, .12, -.4, .6, .06, .05)
    for i, x in enumerate((-1.86, 0, 1.86)):               # three windows, one per cell
        panel(g, x, -.2, .72, .52, .0, .34, .12, .06)
        if hp == 4:
            for q in range(4): panel(st, x, .12 - .21 * q, .6, .1, .2, .44, .04, .05)
            cyl(P('#4a566b'), (x, -.4, .46), .1, .06)
        else:                                # one more window lights up with each hit
            lit = i < 3 - hp
            panel(glow('#fff0a0', .7) if lit else P('#2a3f86', .15, 1), x, -.2, .6, .42, .2, .38, .08, .02)
            slab(gold('#ffb000') if lit else P('#6d86cf'), rnd(star(.36, x, -.22, .5), .04), .36, .52, .05)
    panel(P('#8a5200'), 0, .6, 1.9, .28, -.2, .4, .14)
    panel(g, 0, .6, 1.84, .25, 0, .52, .12, .07)
    b = glow('#ffffff', 1.0)
    for i in range(7): ball(b, (-1.5 + .5 * i, .6, .52), .12)

def makeupcase(op):
    k = P('#b0146a') if op else P('#4a4560')
    b, l = (P('#ff4fa8'), P('#ff9ccf')) if op else (P('#8f87a6', .5, .2), P('#a9a2bd', .5, .2))
    if op:
        panel(k, 0, .42, .8, .46, -.4, -.05, .16)
        panel(b, 0, .42, .76, .42, -.2, .14, .14, .08)
        panel(P('#7fd8ff', .06, 1), 0, .44, .58, .3, .1, .2, .08, .02)
        slab(glow('#ffffff', 1), star(.24, .22, .48, .28, 4), .2, .26, .01)
        streak((-.36, .36, .2), (-.18, .58, .2), .045)
        panel(k, 0, -.42, .9, .44, -.3, .3, .16)
        panel(b, 0, -.4, .86, .4, 0, .5, .16, .1)
        panel(P('#ffe0ef'), 0, -.34, .68, .24, .4, .58, .1, .03)
        for x, c in ((-.42, '#e8213c'), (0, '#ffb81c'), (.42, '#a04cff')): cyl(P(c), (x, -.34, .6), .17, .12, .04)
    else:
        tube(k, arc(0, .2, .34, 0, 180, .0, sy=1.2), .1)
        panel(k, 0, -.28, .9, .58, -.3, .3, .16)
        panel(b, 0, -.3, .86, .52, 0, .46, .16, .1)
        panel(l, 0, .02, .88, .22, .1, .54, .14, .08)
        panel(k, 0, -.2, .86, .04, .4, .56, .02, .01)
        panel(steel('#d8dde8'), 0, -.2, .17, .2, .45, .66, .06, .04)
        cyl(k, (0, -.24, .67), .06, .03, .01)

def curtain(c):
    # The drape is one wavy sheet: folds stand toward the camera.
    nx, ny = 120, 24
    V, F = [], []
    for j in range(ny + 1):
        t = j / ny                           # 0 top, 1 hem
        for i in range(nx + 1):
            u = i / nx
            f = math.cos(TAU * 4 * u + math.pi)
            V.append((-.97 + 1.94 * u, .84 - 1.64 * t - .1 * t * (f * .5 + .5), .22 + f * .2))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            F.append([a, a + 1, a + nx + 2, a + nx + 1])
    obj(V, F, mat(GEMS[c], rough=.5, coat=.15), smooth=True)
    panel(P(DEEP[c]), 0, .05, .95, .8, -.3, -.15, .04, .01)
    cyl(gold(), (0, .84, .3), .12, 1.94, rot=(0, 90, 0))
    for x in (-.72, -.24, .24, .72): torus(gold('#ffd75a'), (x, .82, .3), .12, .05, (0, 90, 0))
    cyl(gold(), (0, 0, .42), .6, .12, .04)
    cyl(P('#ffffff', .5, .2, emit=.12), (0, 0, .48), .53, .12, .03)

# ---- Floors ----------------------------------------------------------------
def confetti():
    panel(P('#f0a800', .5, .2), 0, 0, .97, .97, -.2, -.04, .18, .03)
    panel(P('#ffd84a', .5, .2), 0, 0, .9, .9, -.1, .02, .14, .03)
    random.seed(11)
    cols = [P(c, .4, .4) for c in ('#f0183c', '#1464ff', '#06a848', '#9a3cff', '#ffffff')]
    k = 0
    for side in range(4):
        for i in range(4):
            x, y = -.74 + .4 * i + random.uniform(-.04, .04), .76 + random.uniform(-.05, .05)
            p = move([(x, y)], rot=side * math.pi / 2)[0]
            s = cols[k % 5]
            if k % 3 == 0: slab(s, ngon(16, .12, x=p[0], y=p[1]), 0, .07, .02)
            else: slab(s, move(rect(.15, .075, .02), *p, rot=random.random() * TAU), 0, .07, .02)
            k += 1
    for i in range(6):
        a = TAU * i / 6
        slab(cols[i % 5], move(rect(.09, .05, .02), .42 * math.cos(a), .42 * math.sin(a), rot=a + i), 0, .05, .01)

def petals():
    panel(P('#d81b78', .5, .2), 0, 0, .97, .97, -.2, -.04, .18, .03)
    panel(P('#ffa6cf', .5, .2), 0, 0, .9, .9, -.1, .02, .14, .03)
    a, b = P('#ff3d8f', .4, .4), P('#e0186f', .4, .4)
    sh = rnd([(0, -.22), (.17, -.02), (.16, .17), (.02, .15), (0, .1), (-.02, .15), (-.16, .17), (-.17, -.02)], .09)
    for side in range(4):
        for i in range(4):
            x, y = -.7 + .38 * i, .72 + (.03 if i % 2 else -.03)
            p = move([(x, y)], rot=side * math.pi / 2)[0]
            slab(a if i % 2 else b, move(sh, *p, 1.05, side * math.pi / 2 + (i * 1.1 - 1)), 0, .08, .03)
    for x, y, r in ((-.3, .25, .6), (.32, -.05, 2.2), (-.1, -.36, 4)): slab(a, move(sh, x, y, .8, r), 0, .06, .02)

# ---- Collectibles, coin, gift, boosters ------------------------------------
def dove():
    w, sh, o, k = P('#ffffff', .4, .4, emit=.08), P('#b9d0f5', .4, .3), P('#ff8a1c'), P('#1c2033')
    slab(sh, rnd([(-.3, -.1), (-.95, .1), (-.82, -.12), (-.98, -.22), (-.76, -.34), (-.2, -.4)], .06), -.1, .2, .06)
    body = ball(w, (.02, -.2, .1), .46, (1.25, .8, .7)); body.rotation_euler[2] = .35
    ball(w, (.5, .16, .16), .3)
    cyl(o, (.84, .1, .16), .12, .28, rot=(0, 90, 0), r2=.01)
    ball(k, (.6, .22, .4), .07)
    for i, (a, l) in enumerate(((112, 1.0), (134, .98), (156, .86))):   # raised wing feathers
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        m = [w, sh, w][i]
        z = .3 + .08 * i
        tube(m, [(.1, -.16, z), (.1 + c * l * .6, -.16 + s * l * .6, z), (.1 + c * l, -.16 + s * l, z)], .16)
        ball(m, (.1 + c * l, -.16 + s * l, z), .16)
    ball(w, (.1, -.14, .42), .24)

def popcorn():
    r, w = P('#e8213c'), P('#ffffff')
    kernels([(-.52, .28), (-.2, .36), (.16, .34), (.5, .28), (-.34, .6), (.02, .68), (.36, .58)], .1, .24)
    lathe([r, w], rnd([(0, -.9), (.54, -.9), (.76, .26), (0, .26)], .06, closed=False), bands=12, rz=.6)
    lathe(gold(), rnd([(.74, .18), (.8, .18), (.8, .3), (.74, .3)], .03, closed=False), rz=.6)

def candy():
    p, w = P('#ff3d8b', .15, 1), P('#ffffff', .2, .8)
    for d in (-1, 1):
        slab(P('#18c6b0', .25, .8), rnd(move([(0, .1), (.44, .42), (.36, .14), (.5, 0), (.36, -.14), (.44, -.42), (0, -.1)], d * .5, 0, 1, 0 if d > 0 else math.pi), .05), -.1, .14, .05)
        torus(gold(), (d * .56, 0, .1), .12, .07, (0, 90, 0))
    R, n, m = .56, 96, 48                    # a ball with swirled stripes
    V = [(R * math.sin(math.pi * i / m) * math.cos(TAU * j / n + 2.2 * i / m), R * math.sin(math.pi * i / m) * math.sin(TAU * j / n + 2.2 * i / m), .2 + R * math.cos(math.pi * i / m)) for i in range(m + 1) for j in range(n)]
    F = [[i * n + j, i * n + (j + 1) % n, (i + 1) * n + (j + 1) % n, (i + 1) * n + j] for i in range(m) for j in range(n)]
    o = obj(V, F, p, smooth=True)
    o.data.materials.append(w)
    for q, f in enumerate(o.data.polygons): f.material_index = ((q % n) // 8) % 2

def coin():
    cyl(gold('#e08a00'), (0, 0, -.05), .9, .3, .06)
    cyl(gold('#ffc22e'), (0, 0, .08), .88, .24, .07)
    cyl(gold('#f09a00'), (0, 0, .2), .68, .04, .02)
    slab(gold('#ffdf6a'), rnd(star(.56, 0, -.02, .52), .06), .15, .36, .07)

def gift():
    b, l, r = P('#19b4d8'), P('#4fd6f2'), P('#ff3d6e')
    panel(P('#0a5f80'), 0, -.34, .78, .56, -.4, .2, .08)
    panel(b, 0, -.34, .74, .52, -.3, .34, .08, .06)
    panel(l, 0, .12, .86, .2, -.4, .46, .08, .07)
    panel(r, 0, -.34, .17, .53, 0, .42, .03, .03)
    panel(r, 0, .12, .18, .21, 0, .54, .03, .03)
    for d in (-1, 1):
        tube(r, bezier((0, .36, .2), (d * .3, .95, .3), (d * 1.0, .9, .3), (d * .1, .36, .2)), .12)
    ball(r, (0, .4, .4), .19)

def drill():
    o, k, s = P('#ff8a1c'), P('#2b2f45'), steel('#d5deea')
    slab(o, rnd([(-.62, .62), (.2, .62), (.34, .5), (.34, .1), (.2, -.02), (-.16, -.02), (-.28, -.5), (-.68, -.5), (-.5, 0), (-.72, .12), (-.72, .5)], .1), -.3, .3, .1)
    panel(k, -.52, -.64, .32, .2, -.34, .36, .08, .06)
    slab(k, rnd(move([(-.06, .16), (.1, .16), (.02, -.16), (-.12, -.16)], -.1, -.2), .04), -.15, .2, .04)
    for q in range(3): panel(k, -.5 + .17 * q, .32, .045, .14, .2, .36, .04, .02)
    cyl(k, (.42, .3, 0), .26, .26, .05, rot=(0, 90, 0), r2=.17)
    cyl(s, (.8, .3, 0), .14, .56, 0, rot=(0, 90, 0), r2=.01)
    for q in range(4):                       # twist of the bit
        x, r = .56 + .12 * q, .15 - .03 * q
        tube(P('#7d8aa0'), [(x, .3 - r, .06), (x + .07, .3 + r, .06)], .035)

def coinflip():
    g = P('#19b36b')
    for c, r, d, b in (('#e08a00', .5, .18, .05), ('#ffc22e', .48, .22, .05), ('#f09a00', .36, .26, .02)): cyl(gold(c), (0, 0, 0), r, d, b)
    slab(gold('#ffe27a'), rnd(star(.32, 0, 0, .52), .04), .1, .24, .04)
    for q in (0, math.pi):                   # two arrows chasing round it
        pts = [(x, y, 0) for x, y in move([(x, y) for x, y, _ in arc(0, 0, .74, 20, 130)], rot=q)]
        tube(g, pts, .12)
        e = move([(-.28, -.02), (.28, -.02), (0, .36)], *pts[-1][:2], 1, q + math.radians(130))
        slab(g, rnd(e, .05), -.14, .16, .05)

# ---- The list --------------------------------------------------------------
add('crate-1', crate, rim='#4a2006')
for n in (2, 1): add(f'hatbox-{n}', hatbox, n, lean=24)
add('dryice-1', dryice, lean=8, rim='#0a4f86')
for n in (3, 2, 1): add(f'trunk-{n}', trunk, n, lean=22, rim='#2e0e06')
for n in range(5): add(f'paint-{n}', paint, n, lean=12, pin=(0, .06, 1), rim='#2a2238')
add('cashbox-1', cashbox, lean=18, rim='#12233a')
for n in (3, 2, 1): add(f'costume-{n}', costume, n, lean=10, rim='#04383c')
for n in (2, 1): add(f'strongbox-{n}', strongbox, n, lean=14, rim='#0c0f1c')
for n in (3, 2, 1): add(f'flat-{n}', flat, n, lean=6, fit=None, small=.94, rim='#2c2640')
add('padlock', padlock, lean=0, fit=.94, rim='#33240f', px=4)
add('sandbag', sandbag, lean=8, rim='#4a2c10')
for n in range(5, 0, -1): add(f'planter-{n}', planter, n, w=2, h=2, lean=12, fit=.9, rim='#0c3a18', px=6)
for n in (2, 1): add(f'bouquet-{n}', bouquet, n, lean=0, rim='#3a1a3a')
for n in (3, 2, 1): add(f'candyjar-{n}', candyjar, n, lean=3, rim='#1a4a78')
add('tophat', tophat, lean=20, rim='#0f0a1e')
add('popper', popper, rim='#4a0a18')
for n in range(5, 0, -1): add(f'dovecote-{n}', dovecote, n, w=2, h=2, lean=12, fit=.9, rim='#1c2a52', px=6)
add('footlights', footlights, w=2, h=2, lean=0, fit=None, rim='#0f0e28', px=6)
add('fireworks', fireworks, w=2, lean=0, fit=None, rim='#4a0610')
for k in (3, 4, 5):
    add(f'truss{k}', truss, k, 2, w=k, lean=12, fit=.92, rim='#1c2436')
    add(f'truss{k}-1', truss, k, 1, w=k, lean=12, fit=.92, rim='#1c2436')
for n in (4, 3, 2, 1): add(f'ticketbooth-{n}', ticketbooth, n, w=3, lean=10, fit=.92, rim='#3a0610')
add('makeupcase-open', makeupcase, True, lean=8, rim='#5c0838')
add('makeupcase-closed', makeupcase, False, lean=8, rim='#262238')
for n in range(5): add(f'curtain-{n}', curtain, n, lean=0, fit=None, rim=DEEP[n], px=3)
add('confetti', confetti, lean=0, fit=None, rim=None)
add('petals', petals, lean=0, fit=None, rim=None)
add('dove', dove, lean=0, rim='#24407a', px=6)
add('popcorn', popcorn, lean=12, rim='#4a1a0a')
add('candy', candy, lean=(0, 28), rim='#5c0838')
add('coin', coin, lean=0, rim='#6b3200')
add('gift', gift, lean=12, rim='#083a52')
add('drill', drill, lean=(0, 18), rim='#1c1a2a')
add('coinflip', coinflip, lean=0, rim='#083a24')

for name, fn, a, w, h, lean, fit, rim, px, pin, small in JOBS:
    if only and name not in only:
        continue
    reset(w, h)
    fn(*a)
    finish_shot(name, w, h, lean, fit, rim, px, pin, small)
