# The chests, medals and crown of the side-game sheets and the shop.
#   blender -b -P tools/art/fancy.py -- <output folder> [name ...]
import os
HERE2 = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE2, 'badges.py'), encoding='utf-8').read()
A = src[:src.rindex('# ---- The list')]
__file__ = os.path.join(HERE2, 'badges.py')
exec(compile(A, os.path.join(HERE2, 'badges.py'), 'exec'))

def openchest():
    b, l, k, g = P('#b0561c', .35, .5), P('#e08236', .35, .5), P('#5a2408'), gold('#ffbe1f')
    slab(l, rnd([(-.98, .3), (.98, .3), (.9, .94), (.66, 1.12), (-.66, 1.12), (-.9, .94)], .16), -.5, -.1, .1)
    slab(k, rnd([(-.84, .3), (.84, .3), (.76, .84), (-.76, .84)], .1), -.2, -.04, .03)
    slab(glow('#fff2a0', 1), rnd([(-.8, .05), (.8, .05), (.62, .6), (-.62, .6)], .1), -.1, 0, .02)
    c = gold('#ffc82a')
    random.seed(5)
    for i in range(16): cyl(c, (random.uniform(-.66, .66), random.uniform(.1, .42), random.uniform(0, .3)), .19, .06, .02, rot=(random.uniform(-50, 50), random.uniform(-50, 50), 0))
    for x, q in ((-.4, '#f0183c'), (.1, '#1e8bff'), (.5, '#17c060')): slab(P(q, .1, 1), ngon(6, .17, x=x, y=.46), .2, .44, .06)
    panel(b, 0, -.42, .98, .5, -.5, .5, .08, .07)
    panel(g, 0, .08, 1.0, .09, -.4, .56, .04, .04)
    for q in (-1, 1): panel(g, q * .64, -.42, .1, .5, 0, .56, .05, .04)
    slab(g, rnd(star(.28, 0, -.42, .52), .04), .4, .62, .05)

def ribbon(c, d):
    slab(P(d), [(-.2, .9), (.5, .9), (.1, -.1), (-.4, .1)], -.3, -.1, .03)
    slab(P(c), [(.2, .9), (-.5, .9), (-.1, -.1), (.4, .1)], -.12, .04, .03)
def coinmedal(a, b, c):
    cyl(gold(b), (0, -.24, 0), .72, .24, .05)
    cyl(gold(a), (0, -.24, .06), .68, .26, .06)
    cyl(gold(c), (0, -.24, .1), .5, .26, .04)
    for i in range(14):
        t = TAU * i / 14
        ball(gold(a), (.6 * math.cos(t), -.24 + .6 * math.sin(t), .2), .06)

G, B = '#5a2a00', '#1b1230'
PLAIN = {}
PLAIN['chest'] = (L(chest, rim='#3a1404', fit=.9, lean=16, px=5), L(chip, rim=G, fit=.26, dy=-4, lean=0, px=4))
PLAIN['chest-open'] = (L(openchest, rim='#3a1404', fit=.92, lean=14, px=5),)
PLAIN['medal-1'] = (L(ribbon, '#f0283c', '#a00a24', rim='#4a0414', fit=.5, dy=21, lean=0), L(coinmedal, '#ffcf3a', '#e08a00', '#ffb81c', rim=G, fit=.64, dy=-16, lean=0, px=5))
PLAIN['medal-2'] = (L(ribbon, '#2f7bff', '#0a3ca0', rim='#06184a', fit=.5, dy=21, lean=0), L(coinmedal, '#e8eef8', '#8e9cb4', '#c3cede', rim='#2c3650', fit=.64, dy=-16, lean=0, px=5))
PLAIN['medal-3'] = (L(ribbon, '#17b85c', '#067034', rim='#033a1c', fit=.5, dy=21, lean=0), L(coinmedal, '#f0a468', '#a0521c', '#d9803c', rim='#4a1c04', fit=.64, dy=-16, lean=0, px=5))
PLAIN['crown'] = (L(crown, rim=G, fit=.9, lean=8, px=5),)
for name, layers in PLAIN.items():
    if only and name not in only: continue
    a = photo(*layers[0])
    for l in layers[1:]: a = shadowed(a, photo(*l), '#1a0a3a')
    save(a, f'{DEST}/{name}.png')
