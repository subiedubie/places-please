# The board twists: ivy, mouse, bomb gem, mimic gem, turntables, treasure.
# Run it like badges.py (see rig.py):
#   blender -b -P tools/art/twists.py -- <output folder> [name ...]
# Like badges.py, a picture is a pile of separate photos, bottom to top, each
# with its own dark rim. Positions are rig units: a cell is 2 x 2 round (0, 0).
import os
HERE = os.path.dirname(os.path.abspath(__file__))
# Take every helper from badges.py (and through it props.py), but no pictures.
exec(compile(open(os.path.join(HERE, 'badges.py'), encoding='utf-8').read().split('\n# ---- The list')[0], 'badges.py', 'exec'))

# ---- Helpers ----------------------------------------------------------------
# Glossy paint that changes colour along a direction: stops are (0..1, colour).
def ramp(stops, x0, x1, axis='X', rough=.3):
    m = P('#ffffff', rough, .4)
    t = m.node_tree
    tc, sep, mr, cr = (t.nodes.new('ShaderNode' + k) for k in ('TexCoord', 'SeparateXYZ', 'MapRange', 'ValToRGB'))
    mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = x0, x1
    el = cr.color_ramp.elements
    while len(el) < len(stops): el.new(1)
    for e, (p, c) in zip(el, stops):
        e.position = p
        e.color = (*hexrgb(c), 1)
    t.links.new(tc.outputs['Object'], sep.inputs[0])
    t.links.new(sep.outputs[axis], mr.inputs['Value'])
    t.links.new(mr.outputs[0], cr.inputs[0])
    t.links.new(cr.outputs[0], t.nodes['Principled BSDF'].inputs['Base Color'])
    return m

# Melt a pile of balls (x, y, z, radius) into one soft body.
def blob(m, balls, voxel=.03, soft=6):
    bm = bmesh.new()
    for x, y, z, r in balls:
        g = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
        bmesh.ops.translate(bm, verts=g['verts'], vec=(x, y, z))
    me = bpy.data.meshes.new('b')
    bm.to_mesh(me)
    o = bpy.data.objects.new('b', me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(m)
    r = o.modifiers.new('r', 'REMESH')
    r.mode, r.voxel_size, r.use_smooth_shade = 'VOXEL', voxel, True
    s = o.modifiers.new('s', 'SMOOTH')
    s.iterations = soft
    return o

def chain(pts, n=10):                    # fill in balls between the given ones
    res = []
    for a, b in zip(pts, pts[1:]):
        res += [tuple(p + (q - p) * i / n for p, q in zip(a, b)) for i in range(n)]
    return res + [pts[-1]]

# A frame round the cell cut in slanted pieces of the given materials.
# R: half size of its middle line, w: half width, p: 2 = circle, more = squarer.
def ring(mats, n, R, w, p, slant, z0=-.1, z1=.12):
    S = 8
    def at(t, f):                        # t: 0..1 round the frame, f: -1 inside .. 1 outside
        a = TAU * t + slant * f
        c, s = math.cos(a), math.sin(a)
        q = (R + w * f) * (abs(c) ** p + abs(s) ** p) ** (-1 / p)
        return (q * c, q * s)
    for i in range(n):
        t = [(i + j / S) / n for j in range(S + 1)]
        slab(mats[i % len(mats)], [at(u, 1) for u in t] + [at(t[-1], 1 - j / 4) for j in range(1, 8)] + [at(u, -1) for u in t[::-1]] + [at(t[0], -1 + j / 4) for j in range(1, 8)], z0, z1, .015)

# ---- Ivy --------------------------------------------------------------------
def leaf(m, vein, x, y, z, s, rot):
    sh = [(0, -.62), (.34, -.78), (.62, -.5), (.56, -.16), (.8, .02), (.6, .3), (.34, .34), (0, .95)]
    sh = rnd(sh + [(-a, b) for a, b in sh[-2:0:-1]], .2)
    slab(m, move(sh, x, y, s, rot), z - .07, z + .1, .07)
    def v(a, b): return (*move([(a, b)], x, y, s, rot)[0], z + .1)
    tube(vein, [v(0, -.55), v(0, .6)], .035)
    for q in (-1, 1): tube(vein, [v(0, -.3), v(q * .42, .02)], .028)

def ivy_back():
    vine = P('#0d8a3c')
    for q, p in ((1, 1), (-1, -1)):         # creeping curls at the corners
        pts = []
        for i in range(31):
            t = i / 30
            a, r = math.radians(225 - 400 * t), .2 - .12 * t
            pts.append((q * (.74 + r * math.cos(a)), p * (.74 + r * math.sin(a)), 0))
        tube(vine, pts, .055)
    g = [P('#0c8f3c'), P('#129e46')]
    for i in range(8):
        a = TAU * i / 8
        r = (.56, .6, .5, .8, .54, .58, .48, .8)[i]
        leaf(g[i % 2], P('#076a2a'), r * math.cos(a), r * math.sin(a), 0, .44, a - math.pi / 2 + (.5, -.3, -.4, .35, .45, -.25, .3, .3)[i])

def ivy_front():
    g = [P('#5fe04a'), P('#2fc452'), P('#8bec4e')]
    for i, (x, y, s, r) in enumerate(((-.36, .42, .46, .45), (.46, .34, .42, -1.1), (-.5, -.22, .42, 1.85), (.4, -.4, .46, -2.6), (-.16, -.58, .38, 2.9))):
        leaf(g[i % 3], P('#159a3c'), x, y, .15 + .05 * i, s, r)

def ivy_bud():
    p, d = P('#ff5fb0'), P('#e0218a')
    for r in (-.6, .6): slab(P('#1ea848'), move(rnd([(0, -.5), (.28, -.1), (.1, .4), (-.1, .4), (-.28, -.1)], .12), 0, -.2, .9, r), -.1, .1, .05)
    for x, m in ((-.2, d), (.2, d), (0, p)):
        slab(m, rnd([(x * 1.3, .6), (x + .34, .1), (x * .5 + .2, -.4), (x * .5 - .2, -.4), (x - .34, .1)], .18), .1 if x else .2, .3 if x else .45, .1)
    ball(glow('#ffffff', .4), (-.1, .2, .46), .07, (1, 1.6, .4))

# ---- Mouse ------------------------------------------------------------------
def mouse_ears():
    g, p = P('#8d96ab', .4, .3), P('#ff9dbb', .4, .3)
    tube(p, bezier((.3, -.82, -.3), (.95, -.98, -.3), (.95, -.55, -.3), (.76, -.36, -.3)), .06)
    for q in (-1, 1):
        ball(g, (q * .54, .5, 0), .4, (1, 1, .35))
        ball(p, (q * .54, .5, .1), .27, (1, 1, .3))

def mouse_body():
    g = P('#8d96ab', .4, .3)
    ball(g, (0, -.66, 0), .38, (1.2, .7, .7))
    for q in (-1, 1): ball(P('#ff9dbb'), (q * .36, -.84, .25), .12, (1.2, .7, 1))

def mouse_head():
    g, l, k, w = P('#a9b2c6', .4, .3), P('#f1f4fb', .4, .3, emit=.05), P('#14162a', .15, 1), glow('#ffffff', .8)
    blob(g, [(0, .1, 0, .56), (-.22, -.1, .1, .42), (.22, -.1, .1, .42), (0, .36, 0, .34)])
    ball(l, (-.17, -.25, .42), .24, (1, .85, .8)); ball(l, (.17, -.25, .42), .24, (1, .85, .8))
    ball(l, (0, -.36, .36), .2, (1, .8, .8))
    for q in (-1, 1):
        ball(l, (q * .26, .16, .4), .22, (.9, 1.2, .7))
        ball(k, (q * .24, .14, .52), .15, (.9, 1.2, .5))
        ball(w, (q * .24 - .05, .22, .6), .055)
        for d in (0, 1): tube(P('#4a5066'), [(q * .4, -.24 - .07 * d, .5), (q * .84, -.16 - .2 * d, .5)], .022)
    ball(P('#ff4f86', .15, 1), (0, -.14, .68), .12, (1.25, .85, .8))
    tube(k, bezier((-.18, -.3, .64), (-.04, -.42, .64), (.18, -.42, .64), (.3, -.23, .64)), .035)
    panel(w, .03, -.44, .085, .08, .5, .66, .03, .02)
    tube(P('#5c647c'), arc(.27, .4, .16, 35, 140, .52), .032)      # a cheeky raised eyebrow
    tube(P('#5c647c'), arc(-.28, .28, .18, 50, 135, .52), .032)

def bowtie():
    r = P('#f0182f')
    for d in (-1, 1): slab(r, rnd([(0, .02), (d * .5, .3), (d * .54, -.28), (0, -.06)], .12), -.1, .16, .08)
    ball(P('#b80a20'), (0, 0, .12), .16)

# ---- Bomb -------------------------------------------------------------------
def bomb(x, y, r):                       # the face stays plain: the game writes a number there
    ball(P('#20253a', .55, 0), (x, y, 0), r, (1, 1, .8))
    tube(glow('#aab8e8', .6), arc(x, y, r * .8, 118, 160, r * .62), r * .065)

def neck(x, y, r, a=50):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    cyl(steel('#7f8aa6'), (x + c * r * .98, y + s * r * .98, -.02), r * .27, r * .3, .03, rot=(90, 0, a - 90))

def fuse_rope(pts, r): tube(P('#f2d9a0', .6, .1), pts, r)

def spark_at(x, y, s):
    for c, k, e, z in (('#ff4a00', 1, .3, 0), ('#ffc400', .7, .5, .08), ('#fffbd0', .36, 1, .16)):
        slab(glow(c, e), rnd(star(s * k, x, y, .52, 8, .3), .02), z - .05, z + .06, .02)

def hazard(): ring([P('#f0142c', .35, .5), P('#1a1a26', .35, .5)], 24, .905, .05, 7, .05)

# ---- Chameleon --------------------------------------------------------------
SKIN = [(0, '#ff4fa8'), (.2, '#a04bff'), (.38, '#2a8cff'), (.56, '#12cfb4'), (.74, '#3ed63e'), (.9, '#c6e81e'), (1, '#ffd21e')]
def cham_head(x=0, y=0, s=1):
    q = lambda a, b, c, r: (x + s * a, y + s * b, s * c, s * r)
    skin = ramp([(0, '#12cfb4'), (.35, '#3ed63e'), (.75, '#c6e81e'), (1, '#ffd21e')], x - .45 * s, x + .7 * s)
    blob(skin, chain([q(0, 0, 0, .42), q(.42, -.16, .04, .27)], 5) + chain([q(-.06, .1, 0, .36), q(-.34, .56, -.05, .1)], 8) + chain([q(-.3, -.1, 0, .3), q(0, -.22, 0, .28)], 4), .028 * s + .004)
    for i in range(4):                   # the crest
        ball(P('#ff8a1c'), (x + s * (-.3 + .17 * i), y + s * (.62 - .07 * i - .03 * i * i), .05 * s), s * .085)
    tube(P('#0a5a2c'), [(x + s * a, y + s * b, s * .4) for a, b, _ in bezier((.66, -.2, 0), (.4, -.34, 0), (.14, -.36, 0), (-.04, -.2, 0))], .04 * s)
    ball(P('#ff9a2a'), (x + s * .06, y + s * .12, .3 * s), .27 * s)
    ball(P('#ffffff', .2, 1, emit=.15), (x + s * .1, y + s * .13, .42 * s), .2 * s)
    ball(P('#14162a', .15, 1), (x + s * .14, y + s * .13, .55 * s), .125 * s, (1, 1, .6))
    ball(glow('#ffffff', .9), (x + s * .1, y + s * .19, .63 * s), .045 * s)
    ball(P('#ff8fae', .5, .2), (x + s * .28, y - s * .14, .27 * s), .08 * s, (1.2, .8, .5))

def cham_body():
    skin = ramp(SKIN, -.85, .5)
    tail = []
    for i in range(70):
        t = i / 69
        a, r = math.radians(-70 - 490 * t), .36 * (1 - t) + .06
        tail.append((-.42 + r * math.cos(a), .24 + r * math.sin(a), 0, .1 - .045 * t))
    blob(skin, chain([(-.45, -.22, 0, .2), (-.2, -.3, 0, .36), (.12, -.2, 0, .36), (.32, .05, 0, .3)], 5) + tail, .025, 4)
    for i, (px, py) in enumerate(((-.34, -.24), (-.12, -.14), (-.18, -.42), (.06, -.36))):
        ball(P(['#ffd21e', '#ff8a1c'][i % 2]), (px, py, .3), .075, (1, 1, .5))

def cham_legs():
    tube(P('#a8632a', .5, .2), [(-.9, -.82, -.1), (-.3, -.76, -.1), (.4, -.8, -.1), (.9, -.73, -.1)], .12)
    for px, c in ((-.36, '#3f7bff'), (.2, '#22c878')):
        blob(P(c), chain([(px, -.45, .1, .16), (px + .06, -.7, .2, .13)], 5) + [(px + .08, -.74, .24, .15)])

RAIN = ['#ff3b5c', '#ff9a1c', '#ffe02e', '#3ddc4a', '#22b8ff', '#8a4bff', '#ff5fd0']
def rainbow(): ring([P(c, .3, .5, emit=.08) for c in RAIN], 21, .875, .085, 4.5, .16)

def cham_hand():                         # three chubby toes
    for x in (-.17, 0, .17): ball(P('#22c878'), (x, -abs(x) * -.3, 0), .13, (.9, 1.3, .8))

# ---- Turntables -------------------------------------------------------------
def table_base(n):
    panel(P('#b98350', .5, .2), 0, 0, n * .985, n * .985, -.3, -.12, .16, .03)
    panel(P('#d8ad7c', .55, .15), 0, 0, n * .985 - .09, n * .985 - .09, -.25, -.08, .12, .03)
    for x in (-1, 1):
        for y in (-1, 1): ball(gold(), (x * (n - .24), y * (n - .24), -.05), .1, (1, 1, .6))

def table_top(n):
    R = n * .955
    cyl(P('#8a5626'), (0, 0, -.06), R, .2, .03, n=128)
    planks = [P(c, .55, .12) for c in ('#ead3a6', '#e2c798')]
    w = n / 4                            # floor boards, clipped to the disc
    for i in range(-4, 4):
        x0, x1 = max(-R + .07, i * w + .012), min(R - .07, (i + 1) * w - .012)
        xs = [x0 + (x1 - x0) * j / 10 for j in range(11)]
        top = [(x, math.sqrt((R - .06) ** 2 - x * x)) for x in xs]
        slab(planks[i % 2], [(x, -y) for x, y in top] + top[::-1], 0, .06, .012)
    bpy.ops.mesh.primitive_torus_add(major_radius=R - .04, minor_radius=.085, location=(0, 0, .06), major_segments=160, minor_segments=20)
    bpy.context.object.data.materials.append(gold('#ffb31a'))
    finish(bpy.context.object, 0, True)

def table_arrows(n):
    m = P('#c07a2a', .45, .3)
    R, w, hd, N = n * .955 - .36, .13, .27, 24
    def at(a, r): return (r * math.cos(a), r * math.sin(a))
    for q in range(4):
        mid = math.pi / 2 * q + (0 if n == 2 else math.pi / 4)
        a0, a1 = mid + .5, mid - .3      # clockwise
        an = [a0 + (a1 - a0) * i / N for i in range(N + 1)]
        slab(m, [at(a, R + w) for a in an] + [at(a1, R + hd), at(a1 - .5 / R, R), at(a1, R - hd)] + [at(a, R - w) for a in an[::-1]], .05, .13, .03)

def table_hub():
    cyl(gold('#ffb31a'), (0, 0, .1), .84, .24, .06, n=96)
    cyl(P('#7a1f5c'), (0, 0, .2), .7, .16, .04, n=96)
    ball(P('#a8327e'), (0, 0, .26), .66, (1, 1, .2))
    slab(gold('#ffd04a'), rnd(star(.46, 0, 0, .5), .05), .3, .5, .07)

def table_pin():
    cyl(gold('#ffb31a'), (0, 0, .1), .2, .16, .04)
    ball(gold('#ffd04a'), (0, 0, .16), .13, (1, 1, .5))

# ---- Treasure ---------------------------------------------------------------
def case():
    panel(gold('#e89a10'), 0, 0, 1.9, 1.9, -.5, .1, .3, .08)
    panel(P('#8a4a12', .35, .5), 0, 0, 1.82, 1.82, -.4, .14, .24, .05)
    panel(gold('#ffc22e'), 0, 0, 1.66, 1.66, -.4, .22, .2, .07)
    panel(P('#7a0418', .6, .1), 0, 0, 1.54, 1.54, -.4, .23, .16, .02)
    v, g = P('#d8102e', .5, .2), gold()
    for i in range(-2, 3):               # tufted velvet cushions
        for j in range(-2, 3): ball(v, (i * .6, j * .6, .12), .42, (1, 1, .6))
    for i in range(-2, 2):
        for j in range(-2, 2): ball(g, (i * .6 + .3, j * .6 + .3, .34), .06, (1, 1, .6))
    for x in (-1, 1):
        for y in (-1, 1): ball(gold('#ffe07a'), (x * 1.68, y * 1.68, .2), .16, (1, 1, .6))

def statue():
    g, l, d = gold('#ffbe1f'), gold('#ffd85a'), gold('#e08a00')
    lathe(g, rnd([(0, -.75), (.2, -.75), (.14, -1.0), (.2, -1.14), (0, -1.14)], .06, closed=False))
    lathe(d, rnd([(0, -1.1), (.42, -1.1), (.5, -1.26), (0, -1.26)], .05, closed=False))
    lathe(g, rnd([(0, -1.24), (.6, -1.24), (.68, -1.46), (0, -1.46)], .06, closed=False))
    for q in (-1, 1):                    # laurel branches either side
        tube(d, [(q * x, y, 0) for x, y, _ in arc(0, .05, 1.16, -72, 48)], .06)
        for i in range(6):
            a = math.radians(-62 + 22 * i)
            for s in (1, -1):
                r = 1.16 + .13 * s
                o = ball(l if s > 0 else g, (q * r * math.cos(a), .05 + r * math.sin(a), .1 + .05 * s), .26, (.42, 1, .5))
                o.rotation_euler[2] = q * (a - .6 * s)

def mask():
    l, k = gold('#ffe27a'), P('#7a2408', .5, .2)
    S, Y = 1.12, .28
    def pt(a, b, z=.36): return (S * a, Y + S * b, z)
    def flat(p): return [pt(a, b)[:2] for a, b, _ in p]
    slab(gold('#e89a10'), facepts(S * 1.09, 0, Y), -.2, .2, .08)
    slab(gold('#ffc22a'), facepts(S, 0, Y), -.1, .34, .14)
    for q in (-1, 1):                    # smiling eyes, brows, cheeks
        slab(k, flat(arc(q * .34, .1, .26, 10, 170) + arc(q * .34, .02, .22, 150, 30)), .2, .38, .02)
        tube(l, [pt(a, b) for a, b, _ in arc(q * .34, .24, .3, 40, 140)], .07)
        ball(l, pt(q * .52, -.18, .3), .17 * S, (1, 1, .5))
    ball(l, pt(0, .06, .3), .12 * S, (.8, 1.5, .8))
    slab(k, flat(arc(0, -.2, .46, 180, 360)), .2, .38, .02)
    slab(P('#fff0b8', .3, .5), flat(arc(0, -.21, .41, 180, 360, sy=.35)), .3, .42, .02)
    for c, x, y in (('#1ec8ff', -.45, .72), ('#ff2f52', 0, .78), ('#35e06a', .45, .72)):
        slab(P(c, .1, 1), ngon(6, .13, .5, x=S * x, y=Y + S * y), .3, .46, .05)
        torus(l, (S * x, Y + S * y, .34), .16, .04)

def glints():
    for x, y, s in ((-1.25, 1.2, .3), (1.22, 1.3, .22), (1.28, -1.1, .32), (-1.2, -1.25, .24)): slab(glow('#fff6c8', .6), rnd(star(s, x, y, .3, 4), .02), .5, .6, .02)

# ---- The list ---------------------------------------------------------------
# A layer is a function, its arguments, and how to photograph it. fit None means
# "stay exactly where you were built"; otherwise fit, dx, dy work as in badges.py.
def S(fn, *a, rim='#2a1a33', px=4, fit=None, dx=0, dy=0): return (fn, a, rim, px, fit, dx, dy)
PIX = {}                                 # name: (cells across, layers bottom to top)
PIX['ivy'] = (1, (S(ivy_back, rim='#04431c'), S(ivy_front, rim='#04431c', px=3), S(ivy_bud, rim='#6a0440', fit=.25, dx=3, dy=3)))
PIX['mouse'] = (1, (S(mouse_ears, rim='#2a2c44', px=5), S(mouse_body, rim='#2a2c44', px=5), S(mouse_head, rim='#2a2c44', px=5), S(bowtie, rim='#5a0414', fit=.3, dy=-32)))
B1, B2 = (.5, -.5, .43), (-.2, -.26, .64)
PIX['fuse'] = (1, (S(hazard, rim='#3a0410', px=1.5),
    S(fuse_rope, bezier((.74, -.2, 0), (1.12, .08, 0), (.5, .16, 0), (.8, .46, 0)), .055, rim='#4a2a10', px=3),
    S(spark_at, .78, .52, .19, rim='#7a1400', px=2), S(neck, *B1, rim='#05060f', px=3), S(bomb, *B1, rim='#05060f', px=3)))
PIX['propbomb'] = (1, (S(fuse_rope, bezier((.2, .24, 0), (.48, .95, 0), (.78, .75, 0), (.7, .3, 0)), .085, rim='#4a2a10'),
    S(spark_at, .69, .22, .25, rim='#7a1400'), S(neck, *B2, rim='#05060f', px=5), S(bomb, *B2, rim='#05060f', px=5)))
PIX['mimic'] = (1, (S(rainbow, rim='#3a1a5a', px=2), S(cham_hand, rim='#04261c', fit=.12, dx=-36, dy=8, px=3), S(cham_hand, rim='#04261c', fit=.12, dx=2, dy=37, px=3), S(cham_head, rim='#04261c', fit=.36, dx=-26, dy=28, px=4)))
PIX['chameleon'] = (1, (S(cham_body, rim='#2a1a5a', px=5), S(cham_legs, rim='#2a1a3a', px=5), S(cham_head, .36, .22, .8, rim='#06402c', px=5)))
PIX['turntable2'] = (2, (S(table_base, 2, rim=None), S(table_top, 2, rim='#6a3c10', px=3), S(table_arrows, 2, rim='#8a5010', px=2), S(table_pin, rim='#6a3c10', px=3)))
PIX['turntable3'] = (3, (S(table_base, 3, rim=None), S(table_top, 3, rim='#6a3c10', px=3), S(table_arrows, 3, rim='#8a5010', px=2), S(table_hub, rim='#5a2a08')))
PIX['treasure'] = (2, (S(case, rim='#3a1404', px=6), S(statue, rim='#6a2c00', px=5), S(mask, rim='#6a2c00', px=5), S(glints, rim='#b06a00', px=2)))

for name, (n, layers) in PIX.items():
    if only and name not in only: continue
    pic = None
    for fn, a, rim, px, fit, dx, dy in layers:
        reset(n, n)
        fn(*a)
        finish_shot('part', n, n, 0, fit, rim, px)
        b = shift(load(os.path.join(out, 'part.png')), round(dx * 2.56 * n), round(dy * 2.56 * n))
        pic = b if pic is None else shadowed(pic, b, '#1a0a2a', .4)
    save(pic, f'{DEST}/{name}.png')
