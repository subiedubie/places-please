# The five gems, version 4: chunky cut stones rendered in Blender.
#   blender -b -P tools/art/gems4.py -- <output folder> [gem0 ...]
# Each stone is a thick slab with a short straight side, a sloping crown of a
# few big facets and a flat table on top, every edge softly bevelled, in a
# glossy coated colour. Seen from a little below the top, so the side shows
# and it reads as a solid toy-like jewel rather than a flat drawing.
# Afterwards (run with ordinary Python): py -3.12 tools/art/gems4.py --post <folder>
import sys, os, math

TAU = math.tau

# Darkest -> palest per stone: [side and shade, body, table glow]
COLORS = {
    # Bold primaries (v28, 26 Nov. 2026; v4 was lighter, candy-like).
    'gem0': ('#8a4a00', '#ffc000', '#fff3a0'),   # topaz: yellow
    'gem1': ('#6e0008', '#d4001a', '#ff8a8a'),   # ruby: red
    'gem2': ('#00157a', '#0030d0', '#7fb0ff'),   # sapphire: blue
    'gem3': ('#00330c', '#00782a', '#8ff0a8'),   # emerald: green
    'gem4': ('#33007a', '#5c0cc4', '#d0a8ff'),   # amethyst: purple
}


def rounded(pts, r, seg=4):
    out, n = [], len(pts)
    for i, p in enumerate(pts):
        a, b = pts[i - 1], pts[(i + 1) % n]
        da = math.hypot(a[0] - p[0], a[1] - p[1])
        db = math.hypot(b[0] - p[0], b[1] - p[1])
        k = min(r, da * .45, db * .45)
        p1 = (p[0] + (a[0] - p[0]) / da * k, p[1] + (a[1] - p[1]) / da * k)
        p2 = (p[0] + (b[0] - p[0]) / db * k, p[1] + (b[1] - p[1]) / db * k)
        for j in range(seg + 1):
            t = j / seg
            out.append((p1[0] * (1 - t) ** 2 + 2 * p[0] * t * (1 - t) + p2[0] * t * t,
                        p1[1] * (1 - t) ** 2 + 2 * p[1] * t * (1 - t) + p2[1] * t * t))
    return out


def ngon(n, r, rot=0):
    return [(r * math.cos(rot + TAU * i / n), r * math.sin(rot + TAU * i / n)) for i in range(n)]


def heart():
    h = [(0, .5), (.3, .84), (.72, .8), (.92, .42), (.82, -.06), (.44, -.52), (0, -.88)]
    return h + [(-x, y) for x, y in h[-2:0:-1]]


# name: (outline corners, corner rounding, table size, centre of the table)
SHAPES = {
    'gem0': ([(0, .9), (.9, -.66), (-.9, -.66)], .22, .52, (0, -.12)),
    'gem1': (heart(), .08, .55, (0, .02)),
    'gem2': (ngon(12, .88, TAU / 24), .02, .58, (0, 0)),
    'gem3': ([(-.5, -.86), (.5, -.86), (.78, -.58), (.78, .58), (.5, .86), (-.5, .86), (-.78, .58), (-.78, -.58)], .08, .56, (0, 0)),
    'gem4': ([(0, .92), (.74, .2), (.56, -.26), (0, -.92), (-.56, -.26), (-.74, .2)], .1, .5, (0, .06)),
}


def build(name, rig):
    import bpy, bmesh
    corners, r, table, c = SHAPES[name]
    # Facet corners come from the shape's own corners (a few big facets);
    # the rounded outline is used only to soften them.
    ring = rounded(corners, r, 2) if r > .05 else corners
    n = len(ring)
    dark, body, pale = COLORS[name]
    m = rig.mat(body, rough=.06, coat=1)
    i = m.node_tree.nodes['Principled BSDF'].inputs
    i['Coat Roughness'].default_value = .02
    i['Emission Color'].default_value = (*rig.hexrgb(body), 1)
    i['Emission Strength'].default_value = 0
    i['Specular IOR Level'].default_value = .9
    tab = [(c[0] + (x - c[0]) * table, c[1] + (y - c[1]) * table) for x, y in ring]
    mid = [(c[0] + (x - c[0]) * .86, c[1] + (y - c[1]) * .86) for x, y in ring]
    z0, z1, z2, z3 = -.3, .0, .3, .42
    v = [(x, y, z0) for x, y in [(c[0] + (x - c[0]) * .8, c[1] + (y - c[1]) * .8) for x, y in ring]]  # bottom
    v += [(x, y, z1) for x, y in ring]          # girdle, low
    v += [(x, y, z2 - .12) for x, y in mid]     # crown break
    v += [(x, y, z3) for x, y in tab]           # table
    f = [list(range(n - 1, -1, -1))]
    for k in range(3):
        a, b = k * n, (k + 1) * n
        f += [[a + j, a + (j + 1) % n, b + (j + 1) % n, b + j] for j in range(n)]
    # The table: a very low pyramid of big triangles, in a deeper tone, so it
    # glows dark and light by turns instead of mirroring one flat white.
    v.append((c[0], c[1], z3 + .035))
    top = 4 * n
    f += [[3 * n + j, 3 * n + (j + 1) % n, top] for j in range(n)]
    o = rig.obj(v, f, m, bevel=.035, smooth=False, seg=3)
    o.modifiers['b'].angle_limit = math.radians(12)
    deep = tuple(a * .55 + b * .45 for a, b in zip(rig.hexrgb(body), rig.hexrgb(dark)))
    m2 = rig.mat(deep, rough=.3, coat=.6)
    i2 = m2.node_tree.nodes['Principled BSDF'].inputs
    i2['Coat Roughness'].default_value = .02
    i2['Emission Strength'].default_value = .35
    o.data.materials.append(m2)
    for p in o.data.polygons[-n:]:
        p.material_index = 1
    # Lean it back a little so the near side shows.
    o.rotation_euler = (math.radians(-16), 0, 0)
    o.location = (0, .05, 0)
    return o


def render(out, only):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import rig, bpy
    for name in SHAPES:
        if only and name not in only:
            continue
        s = rig.reset(1, 1, px=512, samples=160)
        # A studio of soft boxes: a big one top left, a rim from behind
        # right, a low fill; and a sky that is bright above, dark below, so
        # the crown facets show strong light and dark.
        w = s.world.node_tree
        bg = w.nodes['Background']
        tc = w.nodes.new('ShaderNodeTexCoord')
        sep = w.nodes.new('ShaderNodeSeparateXYZ')
        ramp = w.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = .45
        ramp.color_ramp.elements[0].color = (.04, .03, .08, 1)
        ramp.color_ramp.elements[1].position = .6
        ramp.color_ramp.elements[1].color = (2.4, 2.4, 2.6, 1)
        e = ramp.color_ramp.elements.new(.8)
        e.color = (1.6, 1.6, 1.8, 1)
        e = ramp.color_ramp.elements.new(.93)
        e.color = (.05, .04, .1, 1)
        w.links.new(tc.outputs['Generated'], sep.inputs[0])
        w.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
        w.links.new(ramp.outputs['Color'], bg.inputs[0])
        bg.inputs[1].default_value = .9
        rig.area((-2.6, 3.0, 4.5), 2.2, 400)
        rig.area((3.2, 2.6, -.5), 1.4, 260)
        build(name, rig)
        rig.shoot(os.path.join(out, name + '_raw.png'))


def post(out):
    # Outline in the stone's darkest tone, richer colour, a small shadow,
    # then down to the board's 256 px.
    import numpy as np
    from PIL import Image, ImageFilter
    for name, (dark, body, pale) in COLORS.items():
        p = os.path.join(out, name + '_raw.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        a = np.asarray(im, float)
        rgb, al = a[..., :3], a[..., 3:] / 255
        g = rgb @ np.array([.3, .59, .11])
        rgb = g[..., None] + (rgb - g[..., None]) * 1.3
        rgb = np.clip(rgb, 0, 255)
        dk = np.array([int(dark[i:i + 2], 16) for i in (1, 3, 5)], float) * .55
        big = np.asarray(Image.fromarray((al[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(1.5)), float)[..., None] / 255
        tot = np.maximum(al, big)
        rgb = (rgb * al + dk * (tot - al)) / np.maximum(tot, 1e-4)
        out_im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), tot * 255]).astype(np.uint8), 'RGBA')
        sh = Image.new('RGBA', out_im.size, (20, 10, 60, 0))
        sh.putalpha(Image.fromarray((np.roll(tot[..., 0], 18, 0) * 110).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10)))
        res = Image.alpha_composite(sh, out_im)
        # a little room round the edge so the outline is not cut off
        canvas = Image.new('RGBA', res.size)
        small = res.resize((int(res.width * .94), int(res.height * .94)), Image.Resampling.LANCZOS)
        canvas.paste(small, ((res.width - small.width) // 2, (res.height - small.height) // 2))
        canvas.resize((256, 256), Image.Resampling.LANCZOS).save(os.path.join(out, name + '.png'))


if __name__ == '__main__':
    if '--post' in sys.argv:
        post(sys.argv[sys.argv.index('--post') + 1])
    else:
        a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
        render(a[0] if a else '.', set(a[1:]))
