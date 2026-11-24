# The five gems and the power-ups. See rig.py for how to run this.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rig import *

out, only = args()
TAU = math.tau


def want(name):
    return not only or name in only


def ngon(n, r, rot=0, sx=1, sy=1):
    return [(r * sx * math.cos(rot + TAU * i / n), r * sy * math.sin(rot + TAU * i / n)) for i in range(n)]


def cut_rect(w, h, c):
    return [(-w + c, -h), (w - c, -h), (w, -h + c), (w, h - c), (w - c, h), (-w + c, h), (-w, h - c), (-w, -h + c)]


# Surroundings of bright and dark patches: what makes a cut stone flash.
def sparkle_world():
    w = bpy.context.scene.world.node_tree
    tc = w.nodes.new('ShaderNodeTexCoord')
    vo = w.nodes.new('ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = 3.2
    ra = w.nodes.new('ShaderNodeValToRGB')
    ra.color_ramp.interpolation = 'CONSTANT'
    ra.color_ramp.elements[0].color = (.12, .12, .16, 1)
    ra.color_ramp.elements[1].position = .42
    ra.color_ramp.elements[1].color = (1, 1, 1, 1)
    e = ra.color_ramp.elements.new(.7)
    e.color = (3.2, 3.2, 3.2, 1)
    sep = vo.outputs['Color']
    w.links.new(tc.outputs['Generated'], vo.inputs['Vector'])
    w.links.new(sep, ra.inputs['Fac'])
    w.links.new(ra.outputs['Color'], w.nodes['Background'].inputs[0])
    w.nodes['Background'].inputs[1].default_value = 1.0


# A cut stone. poly = its outline; table = size of the flat top; crown = height.
def gem(name, poly, color, deep, table=.58, crown=.42, step=False):
    if not want(name):
        return
    reset(samples=160)
    sparkle_world()
    m = mat(color, rough=.0, trans=1, ior=1.9, emit=.2)
    n = len(poly)
    V, F = [], []

    def ring(s, z, pts=poly):
        k = len(V)
        V.extend((x * s, y * s, z) for x, y in pts)
        return k
    a = ring(1, 0)
    if step:  # emerald cut: straight steps
        b = ring(.8, crown * .65)
        c = ring(table, crown)
        for p, q in ((a, b), (b, c)):
            for i in range(n):
                j = (i + 1) % n
                F.append([p + i, p + j, q + j, q + i])
    else:  # brilliant cut: triangles between the edge and the flat top
        mid = [((p[0] + poly[(i + 1) % n][0]) / 2, (p[1] + poly[(i + 1) % n][1]) / 2) for i, p in enumerate(poly)]
        b = ring(.86, crown * .68, mid)
        c = ring(table, crown)
        for i in range(n):
            j = (i + 1) % n
            F += [[a + i, a + j, b + i], [c + i, b + i, c + j], [a + j, c + j, b + i], [a + i, b + i, c + i]]
    F.append([c + i for i in range(n)])
    g = ring(1, -.12)
    t = len(V)
    V.append((0, 0, -.75))
    for i in range(n):
        j = (i + 1) % n
        F += [[g + i, g + j, a + j, a + i], [g + j, g + i, t]]
    obj(V, F, m, bevel=.022)
    # A rounded setting keeps the shape crisp against any cell.
    N = len(poly)
    rim = mat(deep, rough=.5)
    V2 = [(x * k, y * k, z) for k, z in ((.97, -.2), (1.09, -.2), (1.09, .04), (.97, .06)) for x, y in poly]
    F2 = []
    for r in range(4):
        for i in range(N):
            j, q = (i + 1) % N, (r + 1) % 4
            F2.append([r * N + i, r * N + j, q * N + j, q * N + i])
    obj(V2, F2, rim, bevel=.02)
    shoot(f'{out}/{name}.png')


gem('gem0', [(x, y - .1) for x, y in [(-.2, .9), (.2, .9), (.9, -.36), (.7, -.68), (-.7, -.68), (-.9, -.36)]], '#ff9a08', '#8a4300', table=.5)
gem('gem1', cut_rect(.8, .8, .26), '#f0183c', '#6b0418', table=.6)
gem('gem2', ngon(12, .86, TAU / 24), '#1464ff', '#05226e', table=.6)
gem('gem3', cut_rect(.66, .88, .27), '#06b34c', '#034a22', table=.5, step=True)
gem('gem4', [(0, .91), (.66, .18), (.6, -.06), (0, -.91), (-.6, -.06), (-.66, .18)], '#9a3cff', '#3a0a78', table=.48)


# ---- Power-ups -------------------------------------------------------------
GOLD = dict(color='#ffb300', rough=.22, metal=.9)


# The tile every power-up sits on, so power-ups stand out from gems.
def tile():
    slab(mat('#c77700', rough=.3, metal=.8), cut_rect(.96, .96, .22), -.5, -.32, bevel=.06)
    slab(mat('#fff0b8', rough=.35, coat=.6, emit=.1), cut_rect(.84, .84, .18), -.4, -.27, bevel=.05)


def missile(rot):
    red, white, dark = mat('#e8132b', rough=.18, coat=1), mat('#ffffff', rough=.2, coat=1), mat('#7d0a18', rough=.35, coat=.5)
    c, s = math.cos(rot), math.sin(rot)
    deg = math.degrees(rot)

    def at(x, y=0, z=.12):
        return (x * c - y * s, x * s + y * c, z)
    cyl(white, at(0), .25, .9, rot=(0, 90, deg))
    for d in (-1, 1):
        cyl(dark, at(d * .33), .27, .1, rot=(0, 90, deg))
        cyl(red, at(d * .64), .5, .56, rot=(0, 90 * d, deg), r2=.015, bevel=.05)
    cyl(mat(**GOLD), at(0), .3, .2, rot=(0, 90, deg))
    ball(mat('#ff2440', rough=.08, coat=1, emit=.3), at(0, 0, .42), .12)


if want('spot-h'):
    reset(samples=128); tile(); missile(0); shoot(f'{out}/spot-h.png')
if want('spot-v'):
    reset(samples=128); tile(); missile(math.pi / 2); shoot(f'{out}/spot-v.png')


def star_blades(h):
    light, darkm = mat('#e8f0ff', rough=.16, metal=.85), mat('#5f7396', rough=.2, metal=.85)
    for i in range(4):
        a = TAU * i / 4 + math.pi / 2
        tip = (.92 * math.cos(a), .92 * math.sin(a), .02)
        for sgn, m in ((1, light), (-1, darkm)):
            b = a + sgn * TAU / 8
            v = (.37 * math.cos(b), .37 * math.sin(b), .02)
            base = [(tip[0], tip[1], -.08), (v[0], v[1], -.08), (0, 0, -.08)]
            obj([tip, v, (0, 0, h)] + base, [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]], m, bevel=.012)
    cyl(mat('#8d0c1c', rough=.3), (0, 0, h), .21, .12)
    ball(mat('#ff2440', rough=.08, coat=1, emit=.25), (0, 0, h + .06), .15)


if want('under'):
    reset(samples=128); tile(); star_blades(.34); shoot(f'{out}/under.png')
if want('under-bare'):   # flying, without its tile
    reset(samples=128); star_blades(.34); shoot(f'{out}/under-bare.png')

if want('show'):
    reset(samples=128); tile()
    ball(mat('#1c2033', rough=.16, coat=1), (-.06, -.12, .2), .6)
    cyl(mat(**GOLD), (.32, .33, .4), .19, .26, rot=(0, 35, 45))
    for k in range(7):
        t = k / 6
        ball(mat('#b98a4a', rough=.8), (.4 + .24 * t, .42 + .16 * math.sin(t * 2.4), .55), .07)
    ball(mat('#ffef7a', emit=6), (.7, .55, .6), .12)
    for i in range(8):
        a = TAU * i / 8
        cyl(mat('#ff8a00', emit=2.5), (.7 + .17 * math.cos(a), .55 + .17 * math.sin(a), .58), .045, .18, rot=(0, 90, math.degrees(a)), r2=.005, n=12)
    shoot(f'{out}/show.png')


def magic(R):
    cols = ['#ff9a08', '#f0183c', '#1464ff', '#06b34c', '#9a3cff']
    # a ball made of five swirled slices
    LAT, LON = 48, 100
    for k, col in enumerate(cols):
        V, F = [], []
        for i in range(LAT + 1):
            th = math.pi * i / LAT
            for j in range(LON // 5 + 1):
                ph = TAU * (k * (LON // 5) + j) / LON + th * 1.25
                V.append((R * math.sin(th) * math.cos(ph), R * math.sin(th) * math.sin(ph), R * math.cos(th) + .2))
        w = LON // 5 + 1
        for i in range(LAT):
            for j in range(w - 1):
                F.append([i * w + j, i * w + j + 1, (i + 1) * w + j + 1, (i + 1) * w + j])
        o = obj(V, F, mat(col, rough=.1, coat=1, emit=.18), smooth=True)
    ball(mat('#ffffff', rough=.05, emit=1.2), (0, 0, .2 + R), .12, (1, 1, .4))


if want('prism'):
    reset(samples=128); tile(); magic(.68); shoot(f'{out}/prism.png')
if want('prism-super'):
    reset(samples=128)
    g = mat(**GOLD)
    for i in range(12):
        a = TAU * i / 12
        cyl(g, (.8 * math.cos(a), .8 * math.sin(a), 0), .15, .34, rot=(0, 90, math.degrees(a)), r2=.01, n=24)
    torus(g, (0, 0, 0), .72, .13)
    magic(.7)
    shoot(f'{out}/prism-super.png')
