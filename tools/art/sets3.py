# Batch 5 of the set pieces, and the power-ups. Run like sets.py:
#   blender -b -P tools/art/sets3.py -- <output folder> [name ...]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(compile(open(os.path.join(HERE, 'sets2.py'), encoding='utf-8').read().split('\n# ---- The list')[0], 'sets2.py', 'exec'))

def squib(hp):
    for i, x in enumerate((-.5, 0, .5)):
        y = .1 * (i == 1)
        lathe([P('#ff3f5a'), P('#ff8a3a')], [(a, b + y) for a, b in rnd([(0, -.8), (.28, -.8), (.28, .42), (0, .42)], .06, closed=False)], x=x, bands=8)
        for k in (-.5, .1): torus(gold(), (x, k + y, 0), .29, .06, rot=(90, 0, 0))
        tube(P('#f2d9a0', .6, .1), bezier((x, .42 + y, 0), (x, .7 + y, 0), (x + .1, .7 + y, 0), (x + .12, .86 + y, .1)), .05)
        if i < 3 - hp:
            for c, r, e in (('#ff9a18', .2, .6), ('#fff3a0', .11, 1.2)): slab(glow(c, e), rnd(star(r, x + .12, .84 + y, .5, 7), .02), .2, .3 + .1 * e, .03)
    panel(P('#5a2ad0'), 0, -.2, .86, .2, -.1, .46, .08, .06)
    slab(gold('#ffd21f'), rnd(star(.24, 0, -.2, .5), .03), .4, .6, .04)
def cobweb():
    w = P('#eef2ff', .4, .3, emit=.15)
    for i in range(8):
        a = TAU * i / 8
        tube(w, [(0, 0, 0), (.94 * math.cos(a), .94 * math.sin(a), 0)], .045)
    for r in (.3, .58, .86):
        for i in range(8):
            a, b = TAU * i / 8, TAU * (i + 1) / 8
            m = (a + b) / 2
            p, q = (r * math.cos(a), r * math.sin(a)), (r * math.cos(b), r * math.sin(b))
            tube(w, bezier((*p, .04), (r * .84 * math.cos(m - .1), r * .84 * math.sin(m - .1), .04), (r * .84 * math.cos(m + .1), r * .84 * math.sin(m + .1), .04), (*q, .04)), .04)
def spider():
    k = P('#6a3ad0')
    for q in (-1, 1):
        for i in range(4):
            y = .22 - .16 * i
            tube(P('#3a1a8a'), bezier((q * .16, y * .5, .2), (q * .5, y + .2, .4), (q * .6, y, .4), (q * .72, y - .12, .2)), .05)
    ball(k, (0, -.12, .25), .34); ball(k, (0, .26, .28), .22)
    for q in (-1, 1): ball(glow('#ffffff', .6), (q * .1, .32, .48), .09); ball(P('#14162a'), (q * .1, .32, .55), .045)
def dustback():
    panel(P('#b9a6d8', .6, .1), 0, 0, .9, .9, -.2, 0, .16, .06)
    for x, y, r in ((-.4, .4, .16), (.42, .36, .12), (-.3, -.42, .13), (.36, -.4, .17), (0, 0, .12), (.02, .62, .08), (-.64, 0, .08), (.66, -.02, .09)):
        ball(P('#d8caee', .6, .1), (x, y, 0), r, (1, 1, .5))
def straw(hp):
    random.seed(4 + hp)
    cs = [P(c, .5, .2) for c in ('#f2b632', '#ffd25a', '#d8931e', '#ffe08a')]
    panel(P('#a8640e'), 0, 0, .94, .94, -.6, -.2, .12, .08)
    for i in range(90 if hp == 2 else 34):
        a = random.uniform(0, 3.14)
        x, y = random.uniform(-.6, .6), random.uniform(-.6, .6)
        l = random.uniform(.2, .36)
        c, s = math.cos(a) * l, math.sin(a) * l
        z = random.uniform(-.1, .35)
        tube(cs[i % 4], bezier((x - c, y - s, z), (x - c * .3, y - s * .3 + .1, z + .1), (x + c * .3, y + s * .3 + .1, z + .1), (x + c, y + s, z)), .035)
def gallery(hp):
    panel(P('#b01232'), 0, 0, 2.8, 2.8, -.8, 0, .4, .2)
    panel(P('#1464d8'), 0, -.1, 2.4, 2.2, -.3, .12, .3, .1)
    for i in range(9):
        x = -2.56 + .64 * i
        slab(P(['#ffd21f', '#fff4dc'][i % 2]), rnd([(x - .33, 2.84), (x + .33, 2.84), (x + .33, 2.0), (x, 1.72), (x - .33, 2.0)], .08), .3, .6, .07)
    n = {5: 4, 4: 3, 3: 2, 2: 1, 1: 0}[hp]
    for i in range(4):
        x, y = (-1.1 if i % 2 == 0 else 1.1), (.75 if i < 2 else -1.1)
        if i < n:
            for r, c in ((.82, '#ffffff'), (.6, '#f0183c'), (.38, '#ffffff'), (.18, '#f0183c')): cyl(P(c), (x, y, .5 - r * .3), r, .16 + (.9 - r) * .5, .03, n=64)
        elif hp > 1:
            cyl(P('#0a3a8a'), (x, y, .16), .6, .06, .02)
    if hp == 1:
        for r, c in ((1.5, '#ffd21f'), (1.2, '#f0183c'), (.86, '#ffffff'), (.52, '#f0183c')): cyl(P(c), (0, -.3, .6 - r * .25), r, .2 + (1.6 - r) * .4, .05, n=96)
        slab(gold('#ffd21f'), rnd(star(.44, 0, -.3, .5), .04), .9, 1.1, .05)
def painttube():
    slab(P('#eef3fb'), rnd([(-.5, -.86), (.5, -.86), (.36, .36), (-.36, .36)], .06), -.3, .36, .18)
    panel(P('#c2cbdc'), 0, -.84, .56, .1, -.3, .4, .04, .05)
    slab(P('#b02af0'), rnd([(-.44, -.5), (.44, -.5), (.38, .02), (-.38, .02)], .04), .1, .44, .1)
    cyl(P('#5a1a8a'), (0, .5, 0), .26, .3, .05, rot=(90, 0, 0))
    ball(P('#e04bff', .1, 1), (0, .8, .05), .2, (1, 1.1, 1))
    slab(gold('#ffd21f'), rnd(star(.2, 0, -.24, .5), .02), .4, .56, .03)
def wardrobe(hp):
    panel(P('#7a2ad0'), 0, -.1, 1.6, 1.7, -.6, 0, .24, .16)
    slab(gold('#ffc42a'), rnd([(-1.5, 1.3), (-.6, 1.5), (0, 1.86), (.6, 1.5), (1.5, 1.3), (1.5, 1.1), (-1.5, 1.1)], .12), 0, .4, .1)
    panel(P('#2a0a55'), 0, -.2, 1.36, 1.24, -.2, .1, .12, .06)
    for i in range(hp):
        x = -1.0 + .5 * i
        tube(gold(), [(x, .9, .3), (x, .6, .3)], .05)
        slab(P(['#ff3f7d', '#22b8ff', '#ffd21f', '#3ddc6a', '#ff8a2a'][i]), rnd([(x - .1, .7), (x + .1, .7), (x + .22, -1.1), (x - .22, -1.1)], .08), .2, .5, .08)
    bar(gold('#ffc42a'), .92, .07, -1.3, 1.3, .2, .4, .05, .04)
    for q in (-1, 1): panel(P('#9a4bff'), q * 1.5, -.2, .12, 1.3, 0, .5, .06, .06)
def glove():
    w = P('#fff4fb')
    blob(w, [(0, -.2, 0, .44), (-.34, .1, 0, .2), (-.14, .3, 0, .2), (.08, .34, 0, .2), (.3, .22, 0, .2), (-.36, .34, 0, .17), (-.16, .6, 0, .18), (.1, .66, 0, .18), (.34, .5, 0, .17), (.46, -.1, 0, .2), (.64, .12, 0, .17)], .03, 8)
    panel(P('#ff3f7d'), 0, -.66, .44, .16, -.3, .44, .08, .08)
    ball(gold(), (0, -.66, .46), .1)
def lamp(on):
    cyl(P('#243056'), (0, -.5, 0), .6, .5, .08, rot=(90, 0, 0)); torus(gold('#ffc42a'), (0, -.26, 0), .56, .1, rot=(90, 0, 0))
    ball(glow('#fff2a0', 1) if on else P('#8aa0d8', .1, 1), (0, .22, 0), .58, (1, 1.1, .9))
    ball(glow('#ffffff', .9), (-.2, .46, .46), .12)
def capsule():
    panel(P('#e8a04a', .5, .2), 0, 0, .78, .74, -.4, .4, .12, .12)
    panel(P('#1464ff'), 0, 0, .15, .78, -.3, .5, .04, .05); panel(P('#1464ff'), 0, 0, .82, .15, -.3, .5, .04, .05)
    bow(P('#22b8ff'), 0, .1, .5, .6)
def lift():
    panel(P('#39456e'), 0, 0, .92, .92, -.5, .1, .16, .12)
    for q in (-1, 1): panel(gold('#ffc42a'), q * .78, 0, .1, .9, -.1, .3, .05, .05)
    for y in (-.62, .62): slab(gold('#ffc42a'), rnd([(-.4, y - .16), (0, y + .18), (.4, y - .16), (0, y - .02)], .05), .1, .3, .05)
    cyl(P('#1c2450'), (0, 0, .1), .56, .2, .05)

# ---- Power-ups: no tiles, big bold shapes ------------------------------------
def rocket2(v):
    R = math.pi / 2 if v else 0
    root = [o for o in bpy.data.objects]
    lathe([P('#fffaf0'), P('#ff3158')], rnd([(0, -.46), (.4, -.46), (.4, .46), (0, .46)], .06, closed=False), bands=10)
    for q in (-1, 1):
        lathe(P('#f01238'), [(a, q * b) for a, b in rnd([(0, .98), (.12, .9), (.56, .46), (.5, .34), (0, .34)], .08, closed=False)])
        torus(gold('#ffc21a'), (0, q * .38, 0), .42, .09, rot=(90, 0, 0))
    torus(gold('#ffc21a'), (0, 0, 0), .42, .1, rot=(90, 0, 0))
    cyl(gold('#ffc21a'), (0, 0, .42), .26, .14, .05)
    ball(P('#2ad0ff', .08, 1, emit=.25), (0, 0, .5), .18)
    if not v:
        for o in bpy.data.objects:
            if o not in root and o.type in ('MESH', 'CURVE'):
                o.matrix_world = __import__('mathutils').Matrix.Rotation(math.pi / 2, 4, 'Z') @ o.matrix_world
def ninja():
    for i in range(4):
        a = math.pi / 2 * i + math.pi / 4 * 0
        for sgn, m in ((1, P('#9fb8ff', .18, 1)), (-1, P('#3a56d8', .18, 1))):
            b = a + sgn * math.pi / 4
            t = (.98 * math.cos(a), .98 * math.sin(a), 0)
            c = (.5 * math.cos(b), .5 * math.sin(b), 0)
            obj([t, c, (0, 0, .42), (t[0], t[1], -.2), (c[0], c[1], -.2), (0, 0, -.2)], [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], m, bevel=.03)
    torus(gold('#ffc21a'), (0, 0, .36), .34, .1)
    ball(P('#ff2a55', .08, 1, emit=.25), (0, 0, .36), .28)
def grenade():
    ball(P('#2a2f55', .12, 1), (-.04, -.14, 0), .8)
    torus(P('#f01238'), (-.04, -.14, 0), .78, .12, rot=(78, 0, 0))
    slab(gold('#ffd21f'), rnd(star(.34, -.04, -.22, .5), .05), .66, .9, .06)
    cyl(gold('#ffc21a'), (.4, .5, .2), .24, .3, .05, rot=(90, 0, -42))
    tube(P('#e8c08a', .6, .1), bezier((.46, .56, .2), (.6, .72, .25), (.72, .6, .25), (.76, .8, .3)), .08)
    for c, r, e, z in (('#ff5a00', .26, .5, .3), ('#ffc400', .18, .8, .4), ('#fffbd0', .1, 1.3, .5)): slab(glow(c, e), rnd(star(r, .74, .78, .52, 8, .3), .02), z, z + .08, .02)
def magicball():
    cols = ['#ff9a08', '#ff1f48', '#b02af0', '#1e7bff', '#12c45a']
    LAT, LON, R = 48, 100, .84
    for k, col in enumerate(cols):
        V, F = [], []
        w = LON // 5 + 1
        for i in range(LAT + 1):
            th = math.pi * i / LAT
            for j in range(w):
                ph = TAU * (k * (LON // 5) + j) / LON + th * 1.3
                V.append((R * math.sin(th) * math.cos(ph), R * math.sin(th) * math.sin(ph), R * math.cos(th)))
        for i in range(LAT):
            for j in range(w - 1): F.append([i * w + j, i * w + j + 1, (i + 1) * w + j + 1, (i + 1) * w + j])
        obj(V, F, P(col, .12, 1, emit=.12), smooth=True)
    slab(gold('#ffe07a'), rnd(star(.34, 0, 0, .45), .04), R - .06, R + .1, .05)
def sunring():
    for i in range(12):
        a = TAU * i / 12
        cyl(gold('#ffc21a'), (.84 * math.cos(a), .84 * math.sin(a), 0), .16, .3, .02, rot=(0, 90, math.degrees(a)), r2=.02, n=24)
    torus(gold('#ffc21a'), (0, 0, 0), .78, .12)

# ---- The list ---------------------------------------------------------------
def S(fn, *a, rim='#2a1a33', px=4, fit=None, dx=0, dy=0): return (fn, a, rim, px, fit, dx, dy)
PIX = {}                                 # name: (cells wide, cells tall, layers)
def one(name, *layers, w=1, h=1): PIX[name] = (w, h, layers)
for k in (1, 2, 3): one(f'squib-{k}', S(squib, k, rim='#3a0424', px=5, fit=.9))
one('cobweb', S(cobweb, rim='#4a3a7a', px=4), S(spider, rim='#1c0a4a', px=4))
one('dust', S(dustback, rim='#7a64a8', px=2))
for k in (1, 2): one(f'straw-{k}', S(straw, k, rim='#6a3a04', px=3, fit=.97))
for k in (1, 2, 3, 4, 5):
    one(f'gallery-{k}', S(gallery, k, rim='#3a0410', px=6), w=3, h=3)
    one(f'wardrobe-{k}', S(wardrobe, k, rim='#1c0444', px=6), w=2, h=2)
one('painttube', S(painttube, rim='#2a0a4a', px=5, fit=.92)); one('glove', S(glove, rim='#6a1a4a', px=5, fit=.9))
one('lamp', S(lamp, False, rim='#0c1434', px=5, fit=.92)); one('capsule', S(capsule, rim='#3a1a04', px=5, fit=.9)); one('lift', S(lift, rim='#0c1434', px=5))
K = '#3a0418'
one('spot-h', S(rocket2, False, rim=K, px=6, fit=.97)); one('spot-v', S(rocket2, True, rim=K, px=6, fit=.97))
one('under', S(ninja, rim='#0c1444', px=6, fit=.96)); one('under-bare', S(ninja, rim='#0c1444', px=6, fit=.96))
one('show', S(grenade, rim='#0a0a20', px=6, fit=.96))
one('prism', S(magicball, rim='#2a0a4a', px=6, fit=.9)); one('prism-super', S(sunring, rim='#4a2400', px=5, fit=.98), S(magicball, rim='#2a0a4a', px=5, fit=.72))

for name, (w, h, layers) in PIX.items():
    if only and name not in only: continue
    pic = None
    for fn, a, rim, px, fit, dx, dy in layers:
        reset(w, h)
        fn(*a)
        finish_shot('part', w, h, 0, fit, rim, px)
        b = load(os.path.join(out, 'part.png'))
        pic = b if pic is None else shadowed(pic, b, '#1a0a2a', .4)
    save(pic, f'{DEST}/{name}.png')
