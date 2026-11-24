# The set pieces (levels/sets.js). Run like twists.py:
#   blender -b -P tools/art/sets.py -- <output folder> [name ...]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(compile(open(os.path.join(HERE, 'twists.py'), encoding='utf-8').read().split('\n# ---- The list')[0], 'twists.py', 'exec'))

def bar(m, y, h, x0, x1, z0, z1, r, b): panel(m, (x0 + x1) / 2, y, (x1 - x0) / 2, h, z0, z1, r, b)

# ---- Dry ice bar: a cap, a middle square, an end ------------------------------
def ice_body(x0, x1):
    bar(P('#35bdf2', .12, 1), 0, .8, x0, x1, -.5, .3, .2, .14)
    bar(P('#9fe9ff', .1, 1), .42, .2, x0 + .12, x1 - .12, .2, .42, .12, .08)
    bar(P('#e6fbff', .1, 1), -.5, .08, x0 + .2, x1 - .2, .25, .36, .05, .03)
def ice_mid(): ice_body(-2, 2)
def ice_end(): ice_body(-2, .9)
def ice_one(): ice_body(-.9, .9)
def ice_cap():
    ice_body(-.2, 2)
    panel(P('#e0246e'), -.32, 0, .56, .88, -.4, .6, .2, .12)
    panel(gold(), -.32, 0, .2, .42, .4, .74, .1, .06)

# ---- Rose vine: pot, flowers, leaves, stump end -------------------------------
def vine_stem(x0, x1): tube(P('#7a4a22', .5, .2), [(x0, 0, -.2), ((x0 + x1) / 2, .06, -.2), (x1, 0, -.2)], .16)
def vine_leaves(x0=-1, x1=1):
    g = [P('#0c8f3c'), P('#2fc452'), P('#5fe04a')]
    n = max(2, round((x1 - x0) * 3.5))
    for i in range(n):
        x = x0 + (x1 - x0) * (i + .5) / n
        for j, y in enumerate((-.42, .4, 0)):
            leaf(g[(i + j) % 3], P('#076a2a'), x + (.1 if j else -.1), y, .05 * j, .36, (i * 2.1 + j * 1.7) % 6.28)
def rose(x, y, s, c):
    for k in range(6):
        a = TAU * k / 6
        ball(P(c, .3, .5), (x + s * .5 * math.cos(a), y + s * .5 * math.sin(a), .45), s * .42, (1, 1, .6))
    ball(P('#ffd43a'), (x, y, .62), s * .3)
def vine_flowers():
    for i, (x, y) in enumerate(((-.62, .36), (0, -.34), (.62, .3), (-.5, -.5), (.1, .52), (.64, -.5))):
        rose(x, y, .34, ['#ff3f7d', '#fff0f6', '#ff7ab0'][i % 3])
def vine_pot():
    panel(P('#c8662a', .4, .3), -.2, -.06, .6, .68, -.4, .4, .16, .12)
    panel(P('#e8843c', .4, .3), -.2, .6, .74, .2, -.3, .6, .12, .08)
    panel(gold(), -.2, -.14, .3, .3, .3, .5, .12, .06)

# ---- Fuse box, tool bag, spike, barrel -----------------------------------------
def fuse(open_):
    panel(P('#3a2aa8'), 0, 0, .9, .9, -.4, .2, .18, .1)
    panel(P('#6a4bff') if not open_ else P('#14123a'), 0, 0, .7, .7, -.2, .34, .14, .08)
    if not open_:
        slab(gold('#ffcf2a'), rnd([(.2, .58), (-.36, -.08), (-.04, -.08), (-.2, -.58), (.36, .08), (.04, .08)], .03), .3, .56, .05)
    else:
        for c, r, e, z in (('#2aa8ff', .5, .6, .3), ('#9fe4ff', .34, 1, .4), ('#ffffff', .18, 1.4, .5)):
            slab(glow(c, e), rnd(star(r, 0, 0, .4, 7, .2), .03), z, z + .1, .02)
    for x in (-.76, .76):
        for y in (-.76, .76): ball(steel(), (x, y, .24), .09)
def toolbag(hp):
    b, d = P('#b5541e', .5, .3), P('#7a3410', .5, .3)
    panel(b, 0, -.2, .86, .62, -.4, .4, .24, .16)
    panel(d, 0, .34, .8, .2, -.3, .5, .12, .08)
    tube(d, bezier((-.4, .5, .2), (-.36, 1.02, .2), (.36, 1.02, .2), (.4, .5, .2)), .1)
    for x in (-.46, .46): panel(gold(), x, 0, .14, .34, .3, .56, .06, .05)
    if hp == 1:
        panel(P('#2a0e04', .7, .1), 0, .3, .66, .22, .4, .56, .1, .04)
        for x in (-.36, 0, .36): slab(steel('#dfe8f4'), [(x - .16, .2), (x + .16, .2), (x, .86)], .5, .74, .04)
def spike():
    slab(steel('#eef4ff'), rnd(star(.8, 0, 0, .38, 4), .03), -.2, .3, .16)
    ball(steel('#9fb0c8'), (0, 0, .2), .26)
def barrel():
    for i in range(6):
        x = -.62 + .248 * i
        panel(P(['#a8622c', '#bd7436', '#8a4c1e'][i % 3], .45, .3), x, 0, .14, 2.72 - .1 * abs(i - 2.5), -.4, .5 - .1 * abs(i - 2.5), .06, .06)
    for y in (-2.5, -1.2, 1.2, 2.5): panel(gold('#ffb01c'), 0, y, .84, .2, -.3, .62, .08, .07)
    cyl(P('#fff4dc'), (0, 0, .6), .56, .1, .04)
    torus(gold(), (0, 0, .64), .56, .09)

# ---- Follow spot ---------------------------------------------------------------
def spotlamp(k):                          # k: 4 locked, 3..1 charging
    panel(P('#2a3350'), 0, -1.5, 1.2, .3, -.5, 0, .14, .1)
    tube(steel('#5c6a88'), [(-1.3, -1.4, 0), (-1.35, .2, 0)], .16)
    tube(steel('#5c6a88'), [(1.3, -1.4, 0), (1.35, .2, 0)], .16)
    cyl(P('#39456e'), (0, .25, 0), 1.45, .7, .16, n=96)
    cyl(gold('#ffb31a'), (0, .25, .3), 1.22, .3, .08, n=96)
    if k == 4:
        cyl(P('#7a1030'), (0, .25, .4), 1.06, .2, .05, n=96)
        for a in (0, 60, 120): panel(P('#a8183e'), 0, .25, 1.0, .12, .4, .6, .04, .03).rotation_euler[2] = math.radians(a) * 0
        for x in (-.5, 0, .5): panel(steel('#cfd8e8'), x, .25, .1, .8 - .4 * abs(x), .45, .7, .05, .03)
    else:
        cyl(glow(['', '#fff7c0', '#ffd75a', '#b08a3a'][k], [0, 1.1, .7, .25][k]), (0, .25, .4), 1.06, .2, .05, n=96)
        for i in range(3):
            a = math.radians(90 + 120 * i)
            ball(glow('#ffffff', 1) if i < 4 - k else P('#4a3a1a'), (.62 * math.cos(a), .25 + .62 * math.sin(a), .55), .2)

# ---- Dressing room and gifts ----------------------------------------------------
def dressing(hp):
    panel(P('#a01848'), 0, -.1, 1.7, 1.76, -.6, 0, .24, .12)
    panel(P('#ff5a9a'), 0, -.2, 1.34, 1.56, -.3, .16, .14, .08)
    panel(P('#e03a80'), 0, -.2, 1.08, 1.3, 0, .24, .1, .05)
    slab(gold('#ffd04a'), rnd(star(.72, 0, .18, .5), .06), .2, .46, .07)
    ball(gold(), (.86, -.5, .3), .15)
    lit = 4 - hp
    for i in range(7):
        a = math.radians(180 - 30 * i)
        x, y = 1.5 * math.cos(a), .3 + 1.42 * math.sin(a)
        ball(glow('#fff2a0', 1.1) if i < 2 * lit + 1 else P('#8a6a70'), (x, y, .2), .19)
    if hp == 1: panel(P('#ffe9a0', emit=.6), -1.0, -.2, .1, 1.2, .2, .4, .04, .03)
def fan(hp):
    panel(P('#2aa8ff'), 0, -.2, .74, .6, -.5, .4, .12, .1)
    panel(P('#5cc4ff'), 0, .36, .84, .2, -.5, .5, .1, .08)
    panel(gold('#ffd04a'), 0, -.12, .16, .66, -.4, .56, .04, .04)
    if hp == 2: bow(gold('#ffd04a'), 0, .7, .2, .5)
    else: slab(glow('#fff2a0', .7), rnd(star(.46, 0, .62, .5), .04), .5, .7, .04)

# ---- Greasepaint, prop case, streamer cannon, rocket -----------------------------
def greasejar(hp):
    lathe(P('#ff6a3a', .15, 1), rnd([(0, -.8), (.66, -.8), (.76, -.2), (.6, .36), (0, .36)], .12, closed=False))
    panel(P('#fff4dc'), 0, -.28, .5, .26, .5, .86, .1, .04)
    slab(P('#ff2f6a'), rnd(star(.26, 0, -.28, .5), .03), .8, .96, .03)
    if hp == 2:
        lathe(P('#7a3ad0'), rnd([(0, .3), (.7, .3), (.7, .62), (.3, .78), (0, .8)], .08, closed=False))
        ball(gold(), (0, .86, 0), .16)
    else:
        for x, l in ((-.4, .5), (0, .3), (.42, .6)): tube(P('#ffa040', .1, 1), [(x, .4, .6), (x, .4 - l, .78)], .15)
        ball(P('#ffa040', .1, 1), (0, .42, .1), .62, (1, .4, 1))
def propcase(hp):
    panel(P('#2a3a5c'), 0, 0, .86, .8, -.5, .3, .16, .12)
    panel(P('#3f5688'), 0, 0, .64, .58, -.3, .4, .1, .06)
    for x in (-.74, .74):
        for y in (-.68, .68): panel(steel('#d6e0f0'), x, y, .18, .18, -.2, .5, .06, .05)
    panel(gold(), 0, .06, .24, .18, .3, .56, .06, .04)
    if hp == 1: crack(P('#0c1226'), [(-.5, .56), (-.2, .2), (-.36, -.1), (.1, -.5)], .5, .1)
def cannon(hp):
    c, d = ('#18b8a8', '#0a7a78') if hp == 2 else ('#a04bff', '#6a22c0')
    tube(P(c), [(-.62, -.42, 0), (.5, .46, 0)], .4)              # a stubby brass-ringed cannon
    ball(P(d), (-.62, -.42, 0), .42)
    for t in (.15, .6): tube(gold('#ffc42a'), [(-.62 + 1.12 * t, -.42 + .88 * t, 0), (-.54 + 1.12 * t, -.36 + .88 * t, 0)], .46)
    tube(gold('#ffc42a'), [(.46, .43, 0), (.62, .55, 0)], .48)
    ball(P('#1a0a2a'), (.66, .58, .12), .34)
    cyl(P('#8a4c1e'), (-.1, -.5, .5), .44, .2, .06)
    torus(gold('#ffc42a'), (-.1, -.5, .6), .4, .08)
    ball(gold('#ffe07a'), (-.1, -.5, .64), .13)
    if hp == 1:
        for x, y, k in ((.5, .86, '#3ddc4a'), (.86, .86, '#ffe02e'), (.88, .5, '#22b8ff')): ball(glow(k, .3), (x, y, .5), .13)
        slab(glow('#fff2a0', .9), rnd(star(.3, .66, .6, .45, 6), .03), .5, .7, .03)
def rocket():
    lathe([P('#ff3f6d'), P('#fff4dc')], rnd([(0, -.4), (.26, -.4), (.26, .4), (0, .86)], .06, closed=False), bands=8)
    for x in (-.3, .3): slab(P('#22b8ff'), rnd([(x * .7, .0), (x * 1.6, -.5), (x * .7, -.4)], .03), -.1, .1, .04)
    for c, r, e in (('#ff7a18', .3, .6), ('#ffe27a', .18, 1)): ball(glow(c, e), (0, -.6, .1), r, (.7, 1.3, .6))

# ---- The list ---------------------------------------------------------------
def S(fn, *a, rim='#2a1a33', px=4, fit=None, dx=0, dy=0): return (fn, a, rim, px, fit, dx, dy)
PIX = {}                                 # name: (cells wide, cells tall, layers)
def one(name, *layers, w=1, h=1): PIX[name] = (w, h, layers)
ICE = '#0a4a7a'
one('ice-cap', S(ice_cap, rim=ICE)); one('ice-mid', S(ice_mid, rim=ICE)); one('ice-end', S(ice_end, rim=ICE))
one('ice-one', S(ice_one, rim=ICE), S(lambda: panel(P('#e0246e'), -.6, 0, .3, .86, -.4, .6, .14, .1), rim=ICE))
G = '#04431c'
one('vine-2', S(vine_stem, -2, 2, rim='#3a2008'), S(vine_leaves, rim=G, px=3), S(vine_flowers, rim='#6a0440', px=3))
one('vine-1', S(vine_stem, -2, 2, rim='#3a2008'), S(vine_leaves, rim=G, px=3))
one('vine-pot2', S(vine_stem, 0, 2, rim='#3a2008'), S(vine_leaves, .2, 1, rim=G, px=3), S(vine_pot, rim='#4a1c08'), S(rose, -.2, .1, .42, '#ff3f7d', rim='#6a0440', px=3))
one('vine-pot1', S(vine_stem, 0, 2, rim='#3a2008'), S(vine_pot, rim='#4a1c08'), S(vine_leaves, -.5, .2, rim=G, px=3, fit=.34))
one('fusebox-2', S(fuse, False, rim='#120a4a')); one('fusebox-1', S(fuse, True, rim='#120a4a'))
for k in (1, 2):
    one(f'rigbag-{k}', S(toolbag, k, rim='#3a1404', px=5)); one(f'giftbox-{k}', S(fan, k, rim='#06305a', px=5))
    one(f'greasepot-{k}', S(greasejar, k, rim='#4a0e24', px=5)); one(f'propcase-{k}', S(propcase, k, rim='#0a1226', px=5))
    one(f'cannon-{k}', S(cannon, k, rim='#04263a', px=5))
one('spike', S(spike, rim='#2a3a5a', px=5)); one('rocket', S(rocket, rim='#4a0418', px=5))
one('barrel', S(barrel, rim='#3a1a04', px=5), h=3)
for k in (1, 2, 3, 4):
    one(f'followspot-{k}', S(spotlamp, k, rim='#101830', px=6), w=2, h=2)
    one(f'dressing-{k}', S(dressing, k, rim='#4a0424', px=6), w=2, h=2)
for k in (1, 2):
    one(f'truss{k}', S(truss, k, 2, rim='#1c2436'), w=k); one(f'truss{k}-1', S(truss, k, 1, rim='#1c2436'), w=k)

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
