# The photo studio: camera, lights, materials and shape helpers shared by every
# picture in the game. Run with Blender, not with ordinary Python:
#   blender -b -P tools/art/gems.py -- <output folder> [name ...]
# One cell of the board is a 2 x 2 square centred on (0, 0). The camera looks
# down from +Z with the top of the picture at +Y; light comes from the top left.
import bpy, bmesh, math, os, sys
from mathutils import Vector


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    return (a[0] if a else '.'), set(a[1:])


def hexrgb(h):
    h = h.lstrip('#')
    v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in v)


# w, h: how many cells wide and tall the picture is.
def reset(w=1, h=1, px=256, samples=96):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    try:
        p = bpy.context.preferences.addons['cycles'].preferences
        for t in ('OPTIX', 'CUDA'):
            try:
                p.compute_device_type = t
                break
            except TypeError:
                pass
        p.get_devices()
        for d in p.devices:
            d.use = d.type != 'CPU'
        s.cycles.device = 'GPU'
    except Exception as e:
        print('GPU not used:', e)
    s.cycles.max_bounces = 16
    s.cycles.transmission_bounces = 16
    s.render.film_transparent = True
    s.render.resolution_x = px * w
    s.render.resolution_y = px * h
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    s.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2 * max(w, h)
    cam.location = (0, 0, 10)
    s.camera = cam
    wd = bpy.data.worlds.new('w')
    s.world = wd
    try:
        wd.use_nodes = True
    except Exception:
        pass
    bg = wd.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (.75, .82, 1, 1)
    bg.inputs[1].default_value = .55
    area((-3.2, 3.4, 5), 3.2, 420)
    area((3.5, 1, 4), 2, 90)
    area((0, -4, 3), 3, 70)
    return s


def area(loc, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new('a', 'AREA')
    l.energy = power
    l.size = size
    l.color = color
    o = bpy.data.objects.new('a', l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


def mat(color, rough=.35, metal=0, coat=0, trans=0, ior=1.45, emit=0, alpha=1):
    m = bpy.data.materials.new('m')
    try:
        m.use_nodes = True
    except Exception:
        pass
    i = m.node_tree.nodes['Principled BSDF'].inputs
    c = hexrgb(color) if isinstance(color, str) else color
    i['Base Color'].default_value = (*c, 1)
    i['Roughness'].default_value = rough
    i['Metallic'].default_value = metal
    i['IOR'].default_value = ior
    i['Coat Weight'].default_value = coat
    i['Transmission Weight'].default_value = trans
    i['Emission Color'].default_value = (*c, 1)
    i['Emission Strength'].default_value = emit
    i['Alpha'].default_value = alpha
    return m


def finish(o, bevel=0, smooth=False, seg=3):
    if bevel:
        b = o.modifiers.new('b', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(25)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def obj(verts, faces, material, bevel=0, smooth=False, seg=2):
    me = bpy.data.meshes.new('o')
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('o', me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(material)
    return finish(o, bevel, smooth, seg)


def _last(m, bevel, smooth, rot):
    o = bpy.context.object
    o.data.materials.append(m)
    if rot:
        o.rotation_euler = [math.radians(a) for a in rot]
    return finish(o, bevel, smooth)


def cube(m, loc, dim, bevel=.06, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    bpy.context.object.scale = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _last(m, bevel, False, rot)


def cyl(m, loc, r, depth, bevel=.03, rot=None, n=64, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, vertices=n)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, vertices=n)
    return _last(m, bevel, False, rot)


def ball(m, loc, r, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=64, ring_count=32)
    bpy.context.object.scale = scale
    return _last(m, 0, True, None)


def torus(m, loc, R, r, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, major_segments=64, minor_segments=20)
    return _last(m, 0, True, rot)


# A flat outline (a list of x, y) given thickness from z0 to z1.
def slab(m, pts, z0, z1, bevel=.05):
    n = len(pts)
    v = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    f = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    f += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return obj(v, f, m, bevel=bevel)


def shoot(path):
    s = bpy.context.scene
    s.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
