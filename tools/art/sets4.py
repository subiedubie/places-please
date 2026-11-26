# Batch 6: the Hat Box, a pink block that takes three hits and has another
# block underneath it. Run like sets.py:
#   blender -b -P tools/art/sets4.py -- <output folder> [name ...]
import os
HERE = os.path.dirname(os.path.abspath(__file__))
exec(compile(open(os.path.join(HERE, 'sets2.py'), encoding='utf-8').read().split('\n# ---- The list')[0], 'sets2.py', 'exec'))

# A round pink hat box seen from the front and a little above: the box, its
# lid, a gold band, polka dots and a big bow. hp 3 = new; 2 = the lid knocked
# askew; 1 = the bow gone and the lid half off.
def hatbox(hp):
    pink = P('#ff4fa8', .35, .05)
    deep = P('#c0157a', .4)
    # the box: a short wide drum
    lathe([pink, deep], rnd([(0, -.78), (.8, -.78), (.8, .2), (0, .2)], .08, closed=False), bands=10)
    # polka dots on the front
    for x, y in ((-.45, -.45), (0, -.2), (.45, -.45), (-.25, -.62), (.25, -.62)):
        cyl(P('#ffe0f0', .3, emit=.1), (x, y, .78), .09, .05, .01, n=24)
    # the lid, tipped more as it is hit
    tip = {3: 0, 2: 10, 1: 22}[hp]
    lift = {3: 0, 2: .06, 1: .16}[hp]
    lid = cyl(P('#ff7ac0', .3, .05), (0, .3 + lift, 0), .88, .22, .04, rot=(90, 0, tip), n=64)
    torus(gold('#ffd21f'), (0, .22 + lift, 0), .86, .045, rot=(90, 0, tip))
    if hp >= 2:
        # the bow on top
        for s in (-1, 1):
            slab(P('#7a2ad0', .35), rnd([(0, .5), (.42 * s, .78), (.5 * s, .48), (.36 * s, .3)], .06), .4, .52, .03)
        ball(P('#9a4bff', .3), (0, .52 + lift, .45), .1)
    else:
        # a torn ribbon end hanging off
        tube(P('#7a2ad0', .35), bezier((.4, .25, .7), (.6, .1, .8), (.7, -.2, .8), (.75, -.4, .82)), .05)

# ---- The list ---------------------------------------------------------------
def S(fn, *a, rim='#2a1a33', px=4, fit=None, dx=0, dy=0): return (fn, a, rim, px, fit, dx, dy)
PIX = {}
def one(name, *layers, w=1, h=1): PIX[name] = (w, h, layers)
for k in (1, 2, 3): one(f'pinkbox-{k}', S(hatbox, k, rim='#5a0434', px=5, fit=.9))

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
