# More set pieces (batch 4 in config/obstacles.js). Run like sets.py:
#   blender -b -P tools/art/sets2.py -- <output folder> [name ...]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(compile(open(os.path.join(HERE, 'sets.py'), encoding='utf-8').read().split('\n# ---- The list')[0], 'sets.py', 'exec'))

def lamps(n, lit, y, x0, x1, r=.16, z=.5, on='#fff2a0', off='#3a2a3a'):
    for i in range(n):
        x = x0 + (x1 - x0) * (i / (n - 1) if n > 1 else .5)
        ball(glow(on, 1.1) if i < lit else P(off), (x, y, z), r)

# ---- Dimmer box, zap, chandelier -----------------------------------------------
def dimmer(hp):
    panel(P('#0a5a8a'), 0, 0, 1.7, 1.7, -.6, 0, .26, .14)
    panel(P('#16a4d8'), 0, 0, 1.4, 1.4, -.3, .2, .2, .1)
    for i, x in enumerate((-.96, -.32, .32, .96)):
        panel(P('#06283f'), x, -.25, .16, .84, .1, .28, .08, .04)
        up = i < 4 - hp
        panel(glow('#fff2a0', .8) if up else P('#ff5a3c'), x, .34 if up else -.76, .26, .2, .25, .56, .08, .06)
        ball(glow('#ffe27a', 1.1) if up else P('#06283f'), (x, .98, .3), .17)
def zap():
    slab(glow('#ffc61a', .5), rnd([(.2, .9), (-.5, -.1), (-.06, -.1), (-.24, -.9), (.5, .16), (.06, .16)], .03), -.1, .2, .06)
def chandelier():
    g = gold('#ffc42a')
    tube(g, [(0, 1.8, 0), (0, .4, 0)], .1)
    lathe(g, rnd([(0, 1.3), (.3, 1.2), (.16, .9), (.5, .5), (.26, .1), (.4, -.2), (0, -.3)], .08, closed=False))
    for q in (-1, 1):
        for r, y in ((1.4, .25), (.8, -.05)):
            tube(g, bezier((0, .2, .1), (q * r * .5, -.9, .1), (q * r, -.7, .1), (q * r, y, .1)), .1)
            cyl(g, (q * r, y, .1), .24, .2, .05)
            panel(P('#fff6e0'), q * r, y + .3, .12, .26, 0, .3, .06, .04)
            for c, s, e in (('#ff9a18', .24, .5), ('#fff3a0', .14, 1.1)): ball(glow(c, e), (q * r, y + .72, .2), s, (.7, 1.3, .6))
    for x, y, s in ((-1.4, -.4, .2), (-.8, -.75, .24), (0, -.8, .36), (.8, -.75, .24), (1.4, -.4, .2), (-.4, -1.15, .22), (.4, -1.15, .22), (0, -1.55, .26)):
        slab(P('#8ff0ff', .08, 1, emit=.25), [(x, y + s * 1.2), (x + s * .7, y), (x, y - s * 1.2), (x - s * .7, y)], .1, .5, .08)

# ---- Flame pot, fireball --------------------------------------------------------
def flamepot(hp):
    lathe([P('#5a2a8f'), P('#7a3ac0')], rnd([(0, -.84), (.5, -.84), (.82, -.2), (.7, .3), (0, .3)], .12, closed=False), bands=8)
    panel(gold(), 0, .24, .76, .13, .1, .5, .1, .07)
    if hp == 4:
        panel(steel('#c8d2e4'), 0, .42, .72, .2, 0, .6, .1, .07)
        ball(steel('#eef4ff'), (0, .72, .3), .16)
    else:
        k = 4 - hp
        for c, r, e, z in (('#ff3a18', .5, .5, 0), ('#ff9a18', .36, .7, .2), ('#fff3a0', .2, 1.1, .4)):
            slab(glow(c, e), rnd([(0, .5 + r * (.4 + .25 * k)), (r, .42), (r * .7, .1), (-r * .7, .1), (-r, .42)], .12), z, z + .14, .05)
        lamps(3, k, -.3, -.4, .4, .12, .8, off='#2a0e4a')
def fireball():
    for c, r, e, z in (('#ff3a18', .8, .4, 0), ('#ff9a18', .56, .7, .2), ('#fff3a0', .32, 1.1, .4)):
        slab(glow(c, e), rnd(star(r, 0, 0, .66, 9), .05), z, z + .14, .06)

# ---- Laser ------------------------------------------------------------------------
def laser(hp):
    panel(P('#1c1f45'), 0, 0, .78, 2.7, -.5, .1, .24, .14)
    panel(P('#343a80'), 0, 0, .58, 2.46, -.3, .24, .18, .1)
    n = 5 - hp
    for i in range(5):
        if i == 2: continue
        torus(glow('#ff3adf', .9) if (i if i < 2 else i - 1) < n else P('#12142e'), (0, -2.0 + i * 1.0, .3), .34, .1)
    cyl(gold('#ffc42a'), (0, 0, .4), .64, .3, .08)
    ball(glow('#ff3adf', .5 + .25 * n), (0, 0, .5), .46)
    ball(glow('#ffffff', 1), (-.14, .16, .86), .12)

# ---- Thunder machine ----------------------------------------------------------------
def thunder(hp):
    panel(P('#5a2a12'), 0, -.2, 1.64, 1.4, -.6, 0, .24, .14)
    panel(P('#8a4a22'), 0, -.2, 1.4, 1.16, -.3, .14, .18, .1)
    blob(P('#e8ecff', .5, .3), [(-1.0, .9, .3, .5), (-.4, 1.2, .3, .6), (.4, 1.16, .3, .62), (1.0, .9, .3, .5), (0, .86, .35, .6)], .06)
    slab(glow('#ffd21f', .5 + .12 * (5 - hp)), rnd([(.3, .86), (-.62, -.3), (-.08, -.3), (-.36, -1.3), (.66, .04), (.1, .04)], .05), .7, .96, .1)
    lamps(5, 5 - hp, -1.4, -1.1, 1.1, .16, .4)

# ---- Flower cart ---------------------------------------------------------------------
def flowercart(hp):
    panel(P('#18a0a0'), 0, -.3, .8, .36, -.4, .3, .12, .1)
    panel(P('#fff4dc'), 0, -.02, .86, .12, -.3, .42, .06, .05)
    for x in (-.48, .48):
        cyl(P('#8a4c1e'), (x, -.72, .3), .24, .16, .04); ball(gold(), (x, -.72, .42), .08)
    pts = ((-.56, .26), (.0, .4), (.56, .26), (-.28, .62), (.3, .64))
    for i, (x, y) in enumerate(pts[:2 + (4 - hp)]): rose(x, y, .3 + .03 * (3 - hp), ['#ff5f9a', '#ffd23a', '#c86bff'][i % 3])
    for x in (-.8, .8): leaf(P('#2fc452'), P('#0a7a30'), x, .16, 0, .26, -x)

# ---- Masks -------------------------------------------------------------------------------
def mask(y=0):
    m = P('#fff6e6', .25, 1)
    slab(m, rnd([(-.8, .5), (-.3, .62), (.3, .62), (.8, .5), (.76, -.1), (.42, -.7), (0, -.86), (-.42, -.7), (-.76, -.1)], .14), -.2, .3, .14)
    k = P('#4a0f5a')
    for q in (-1, 1): slab(k, rnd([(q * .14, .16), (q * .34, .34), (q * .6, .2), (q * .4, .08)], .06), .24, .42, .04)
    tube(k, bezier((-.42, -.26, .4), (-.2, -.6, .42), (.2, -.6, .42), (.42, -.26, .4)), .08)
    ball(P('#ff5a7a', .4, .3), (-.52, -.1, .3), .14, (1, 1, .4)); ball(P('#ff5a7a', .4, .3), (.52, -.1, .3), .14, (1, 1, .4))
    slab(gold('#ffc42a'), rnd(star(.24, 0, .52, .5), .03), .25, .46, .04)
def rack(x0, x1):
    bar(P('#c01f4a'), 0, .86, x0, x1, -.5, -.1, .16, .1)
    bar(gold('#ffc42a'), .78, .1, x0, x1, -.2, .1, .06, .05)
    bar(gold('#ffc42a'), -.78, .1, x0, x1, -.2, .1, .06, .05)
def rack_mid(): rack(-2, 2)
def rack_cap(): rack(-.94, 2)
def rack_end(): rack(-2, .94)
def rack_one(): rack(-.94, .94)

# ---- Grand safe ----------------------------------------------------------------------------
def grandsafe(hp):
    panel(P('#1c6a4a'), 0, 0, 1.74, 1.74, -.6, 0, .3, .18)
    panel(P('#2aa070'), 0, 0, 1.42, 1.42, -.3, .2, .22, .12)
    cyl(gold('#ffc42a'), (0, 0, .3), .92, .3, .1, n=96)
    cyl(P('#14503a'), (0, 0, .46), .7, .2, .05, n=96)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        tube(gold('#ffe07a'), [(0, 0, .66), (.62 * math.cos(a), .62 * math.sin(a), .66)], .11)
        ball(gold('#ffe07a'), (.62 * math.cos(a), .62 * math.sin(a), .66), .17)
    ball(gold('#ffc42a'), (0, 0, .7), .22)
    for x in (-1.4, 1.4):
        for y in (-1.4, 1.4): ball(steel(), (x, y, .24), .15)
    if hp < 3: crack(P('#04251a'), [(-1.4, 1.0), (-.9, .6), (-1.1, .1), (-.8, -.3)], .34, .12)
    if hp < 2: crack(P('#04251a'), [(1.5, -.4), (1.0, -.5), (1.1, -1.0), (.5, -1.3)], .34, .12)

# ---- Paste pot, scrap ---------------------------------------------------------------------------
def pastepot(hp):
    lathe([P('#2a8fe0')], rnd([(0, -.82), (.62, -.82), (.7, .3), (0, .3)], .1, closed=False))
    panel(P('#fff4dc'), 0, -.28, .46, .28, .46, .8, .08, .04)
    lathe(P('#fffdf4', .2, 1), rnd([(0, .24), (.66, .24), (.6, .46), (0, .52)], .1, closed=False))
    tube(P('#c87a2a'), [(.1, .4, .4), (.56, 1.0, .4)], .1)
    if hp == 1:
        for x, l in ((-.42, .5), (.0, .34), (.4, .62)): tube(P('#fffdf4', .2, 1), [(x, .34, .62), (x, .34 - l, .82)], .14)
def scrap():
    slab(P('#fff4dc', .5, .2), rnd([(-.6, .5), (.5, .62), (.62, -.46), (-.5, -.6)], .08), -.1, .12, .05)
    slab(P('#ff3f7d'), rnd(star(.36, 0, 0, .5), .03), .1, .24, .04)

# ---- Trophies --------------------------------------------------------------------------------------
def cup(s=1, y=0):
    g = gold('#ffc42a')
    lathe(g, [(a * s, b * s + y) for a, b in rnd([(0, .82), (.62, .82), (.54, .1), (.14, -.2), (.14, -.44), (.46, -.56), (.46, -.82), (0, -.82)], .06, closed=False)])
    for q in (-1, 1): tube(g, [(q * s * a, y + s * b, 0) for a, b in ((.54, .66), (.92, .62), (.9, .16), (.44, .1))], .09 * s)
    slab(glow('#fff7c0', .5), rnd(star(.3 * s, 0, y + .4 * s, .5), .02), .5 * s, .74 * s, .04)
def trophycase(hp):
    panel(P('#7a3a14'), 0, 0, 1.72, 1.72, -.6, 0, .26, .16)
    panel(P('#2a0f3a'), 0, .1, 1.4, 1.3, -.3, .1, .16, .06)
    cup(1.15, .1)
    panel(P('#a85a24'), 0, -1.5, 1.62, .24, -.2, .4, .1, .08)
    lamps(5, 5 - hp, -1.5, -1.1, 1.1, .15, .5)
    for q in (-1, 1): panel(P('#a85a24'), q * 1.5, 0, .14, 1.6, -.2, .4, .08, .06)
    panel(P('#a85a24'), 0, 1.5, 1.62, .16, -.2, .4, .08, .06)
    if hp < 3: crack(P('#d8f4ff', emit=.5), [(-1.2, 1.2), (-.8, .5), (-1.1, .1)], .6, .08)
    if hp < 2: crack(P('#d8f4ff', emit=.5), [(1.2, .9), (.7, .4), (1.0, -.4), (.5, -.9)], .6, .08)

# ---- Duck, bubbles, flying rig -------------------------------------------------------------------------
def duck():
    y = P('#ffd21f', .3, .8)
    ball(y, (0, -.36, 0), .7, (1.15, .72, .8))
    ball(y, (.0, .34, .2), .5)
    slab(y, rnd([(.5, -.2), (.98, .16), (.8, -.5)], .08), -.1, .2, .08)
    slab(y, rnd([(-.5, -.2), (-.98, .16), (-.8, -.5)], .08), -.1, .2, .08)
    ball(P('#ff7a18'), (0, .2, .72), .22, (1.3, .55, .9))
    for q in (-1, 1):
        ball(P('#14162a', .15, 1), (q * .2, .46, .62), .11); ball(glow('#ffffff', .9), (q * .2 - .03, .5, .72), .04)
    slab(P('#ff3f6d'), rnd([(-.3, .7), (0, 1.02), (.3, .7)], .08), .1, .3, .06)
def bubbles():
    for i, (x, y, r) in enumerate(((0, .62, .42), (.62, 0, .42), (-.62, .02, .42), (0, -.62, .42), (-.52, .5, .46), (.5, .52, .46), (-.5, -.5, .48), (.52, -.5, .46), (0, 0, .52))):
        ball(P(['#ffb4dc', '#c9b4ff', '#a8e4ff', '#ffc9ec', '#e4d0ff', '#ffb4dc', '#c9b4ff', '#a8e4ff', '#ffd4f0'][i], .08, 1), (x, y, .1 * (i == 8)), r)
        ball(glow('#ffffff', .8), (x - r * .36, y + r * .4, r * .9), r * .14)
def flyer():
    tube(gold('#ffc42a'), [(0, .3, 0), (0, 1.0, 0)], .08)
    ball(gold('#ffe07a'), (0, .94, .1), .14)
    for q in (-1, 1):
        for i in range(3): slab(P(['#ffffff', '#dff2ff', '#b8e0ff'][i], .4, .4), rnd([(q * .2, .4 - .22 * i), (q * (.98 - .12 * i), .66 - .36 * i), (q * (.8 - .1 * i), .2 - .3 * i), (q * .2, .06 - .16 * i)], .1), .04 * -i, .16, .06)
    panel(P('#e0246e'), 0, -.06, .36, .58, -.2, .4, .2, .14)
    slab(gold('#ffd04a'), rnd(star(.26, 0, .06, .5), .03), .36, .54, .04)
    for c, r, e in (('#ff7a18', .26, .6), ('#ffe27a', .15, 1.1)): ball(glow(c, e), (0, -.74, .1), r, (.8, 1.2, .6))

# ---- Belaying pin, counterweight --------------------------------------------------------------------------
def pin_(hp):
    panel(P('#5a3416'), 0, -.1, .9, .3, -.5, 0, .1, .08)
    lathe([P('#e8a04a'), P('#d8862c')], rnd([(0, .92), (.24, .84), (.3, .4), (.18, .1), (.16, -.8), (0, -.92)], .06, closed=False), bands=6)
    for y in ((-.2, 0, .2) if hp == 2 else (-.1,)): torus(P('#fff0c8', .7, .1), (0, y, .16), .3, .11)
    if hp == 1: tube(P('#fff0c8', .7, .1), bezier((.28, -.1, .3), (.7, -.2, .3), (.4, -.6, .3), (.7, -.8, .3)), .1)
def pin_fly(): lathe([P('#e8a04a'), P('#d8862c')], rnd([(0, .92), (.24, .84), (.3, .4), (.18, .1), (.16, -.8), (0, -.92)], .06, closed=False), bands=6)
def weight():
    for x in (-.5, .5): tube(steel('#9fb0c8'), [(x, -4.8, -.2), (x, 4.8, -.2)], .1)
    for i in range(6):
        y = -3.9 + i * 1.5
        panel(P('#3a4468'), 0, y, .82, .66, -.4, .4, .18, .14)
        panel(P('#56638f'), 0, y, .6, .44, 0, .5, .12, .08)
        if i != 3: slab(gold('#ffc42a'), rnd(star(.24, 0, y, .5), .03), .4, .6, .04)
    cyl(P('#fff4dc'), (0, .0, .5), .56, .2, .04); torus(gold(), (0, .0, .6), .56, .09)

# ---- Rocket rack, program stand ----------------------------------------------------------------------------
def rocketrack(hp):
    panel(P('#2a1a6a'), 0, 0, .8, 2.74, -.5, 0, .2, .14)
    for i in range(3):
        y = -1.8 + 1.8 * i
        panel(P('#4a34b8'), 0, y, .66, .76, -.2, .14, .16, .08)
        if i < hp:
            lathe([P('#ff3f6d'), P('#fff4dc')], [(a, b + y) for a, b in rnd([(0, -.5), (.28, -.5), (.28, .3), (0, .72)], .06, closed=False)], bands=8)
            for x in (-.3, .3): slab(P('#22b8ff'), rnd([(x * .7, y - .1), (x * 1.6, y - .6), (x * .7, y - .5)], .03), .2, .4, .04)
        else: panel(P('#120a3a'), 0, y, .4, .56, .1, .2, .14, .04)
def program(x=0, y=0, s=1):
    panel(P('#fff4dc', .5, .2), x, y, .6 * s, .8 * s, -.1, .12, .06, .04)
    panel(P('#e0246e'), x, y + .38 * s, .48 * s, .24 * s, .1, .2, .03, .02)
    slab(gold('#ffc42a'), rnd(star(.34 * s, x, y - .2 * s, .5), .03), .1, .26, .04)
def programs(open_):
    panel(P('#1a6a8a'), 0, -.1, 1.7, 1.6, -.6, 0, .24, .14)
    if open_:
        panel(P('#0a2c40'), 0, -.2, 1.44, 1.3, -.2, .1, .14, .06)
        for i, x in enumerate((-.86, 0, .86)):
            for y in (-.86, .34): program(x, y, .56)
    else:
        for k in range(7): bar(P(['#3ab8d8', '#2a9ab8'][k % 2]), -1.2 + k * .38, .19, -1.44, 1.44, -.1, .24, .04, .04)
    for i in range(8):
        x = -1.5 + i * .428
        slab(P(['#ff3f6d', '#fff4dc'][i % 2]), rnd([(x - .22, 1.8), (x + .22, 1.8), (x + .22, 1.2), (x, 1.04), (x - .22, 1.2)], .05), .3, .5, .05)

# ---- The list ---------------------------------------------------------------
def S(fn, *a, rim='#2a1a33', px=4, fit=None, dx=0, dy=0): return (fn, a, rim, px, fit, dx, dy)
PIX = {}                                 # name: (cells wide, cells tall, layers)
def one(name, *layers, w=1, h=1): PIX[name] = (w, h, layers)
for k in (1, 2, 3, 4):
    one(f'dimmer-{k}', S(dimmer, k, rim='#04263f', px=6), w=2, h=2)
    one(f'flamepot-{k}', S(flamepot, k, rim='#24083f', px=5))
for k in (1, 2, 3, 4, 5):
    one(f'laser-{k}', S(laser, k, rim='#0a0c24', px=5), h=3)
    one(f'thunder-{k}', S(thunder, k, rim='#2a1004', px=6), w=2, h=2)
    one(f'trophycase-{k}', S(trophycase, k, rim='#2a1004', px=6), w=2, h=2)
for k in (1, 2, 3):
    one(f'flowercart-{k}', S(flowercart, k, rim='#063838', px=5))
    one(f'grandsafe-{k}', S(grandsafe, k, rim='#04251a', px=6), w=2, h=2)
    one(f'rocketrack-{k}', S(rocketrack, k, rim='#100838', px=5), h=3)
for k in (1, 2):
    one(f'pastepot-{k}', S(pastepot, k, rim='#06304f', px=5)); one(f'pin-{k}', S(pin_, k, rim='#2a1404', px=5))
one('zap', S(zap, rim='#7a4a00', px=5)); one('fireball', S(fireball, rim='#6a0c00', px=5)); one('scrap', S(scrap, rim='#4a0424', px=5)); one('pin', S(pin_fly, rim='#2a1404', px=5))
one('chandelier', S(chandelier, rim='#4a2400', px=6), w=2, h=2)
one('mask', S(mask, rim='#3a0a4a', px=5))
for n, f in (('cap', rack_cap), ('mid', rack_mid), ('end', rack_end), ('one', rack_one)): one('rack-' + n, S(f, rim='#4a0418'), S(mask, rim='#3a0a4a', px=4, fit=.62))
one('trophy', S(cup, rim='#4a2400', px=5, fit=.9)); one('duck', S(duck, rim='#6a3000', px=5)); one('bubbles', S(bubbles, rim='#7a4a9a', px=3)); one('flyer', S(flyer, rim='#2a0a3a', px=5, fit=.94))
one('weight', S(weight, rim='#10162c', px=5), h=5)
one('program', S(program, rim='#4a0424', px=5))
one('programs-open', S(programs, True, rim='#04202f', px=6), w=2, h=2); one('programs-closed', S(programs, False, rim='#04202f', px=6), w=2, h=2)

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
