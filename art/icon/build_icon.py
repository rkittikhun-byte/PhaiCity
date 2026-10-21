# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""PhaiCity's icon, a bamboo city (ไผ่ = bamboo), built and rendered in Blender.

    blender -b --factory-startup --python-exit-code 1 -P art/icon/build_icon.py -- [options]

Options: --candidate grove|towers|frame (grove, the chosen one, when left out); --out <png> (art/icon/icon_1024.png);
--blend <path> also saves the scene; --size <px> (1024); --outline <m> the ink line's thickness (thicker for the
small sizes, which scripts/icon/export.mjs takes from a second render).

The studio and the colours are the era buildings' (art/buildings/scripts/lib: scene.py's warm sun and lavender sky,
palette.py's flat colours and ink outline), on a transparent background. Candidates:

    grove   a diorama plot (grass on laterite, as in the concept sheets) with a Thai stilt house under a clump of bamboo
    towers  bamboo stems of graded heights standing like a town's buildings, their nodes the storeys
    frame   one big clay roof between two bamboo stems that arch over it, with no plot
"""

import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'art', 'buildings', 'scripts'))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import kit, palette, scene  # noqa: E402
from lib.mesh import Part, T, align_z  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'candidate': 'grove', 'out': os.path.join(HERE, 'icon_1024.png'), 'blend': None, 'size': 1024,
            'outline': None, 'small': False}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip('-')
        if key == 'small':
            opts['small'] = True
            i += 1
            continue
        if key not in opts:
            raise SystemExit('Unknown option %s' % argv[i])
        opts[key] = argv[i + 1]
        i += 2
    opts['size'] = int(opts['size'])
    if opts['outline'] is not None:
        opts['outline'] = float(opts['outline'])
    return opts


# parts -----------------------------------------------------------------------------------------------------------------

def plot(p, half=5.0, depth=2.6):
    """The diorama's square of land: a grass top on a laterite body, with a dark plank base."""
    kit.block(p, -half, -half, -0.45, half, half, 0.0, 'grass', bevel=0.12)
    kit.block(p, -half + 0.02, -half + 0.02, -depth + 0.35, half - 0.02, half - 0.02, -0.45, 'laterite')
    kit.block(p, -half - 0.15, -half - 0.15, -depth, half + 0.15, half + 0.15, -depth + 0.35, 'teak_dark', bevel=0.06)


def leaf(p, base, direction, length, width, mat):
    """A bamboo leaf: a narrow blade from base along direction, a little thick so it has an outline."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    b = Vector(base)
    mid = b + d * length * 0.38
    kit.slab(p, b, mid + side * width / 2, b + d * length, mid - side * width / 2, 0.05, mat)


def tuft(p, at, out, count, length, width, droop=0.55, spin=0.0, mats=('leaf', 'leaf_dark', 'leaf_light')):
    """A fan of leaves at the end of a twig, spreading round its direction and drooping."""
    out = Vector(out).normalized()
    across = out.cross(Vector((0, 0, 1)))
    if across.length < 1e-3:
        across = Vector((1, 0, 0))
    across.normalize()
    for i in range(count):
        a = math.radians(spin + (i - (count - 1) / 2) * (150.0 / max(1, count - 1)))
        d = out * math.cos(a) + across * math.sin(a)
        d.z -= droop + 0.25 * abs(math.sin(a))
        leaf(p, at, d, length, width, mats[i % len(mats)])


def stem(p, base, top, r, nodes, mat='gold', node_mat='bamboo_dark', cut=False):
    """A bamboo culm from base to top with a darker ring at each node; cut shows the hollow at the top."""
    base, top = Vector(base), Vector(top)
    axis = top - base
    p.rod(base, top, r, mat, seg=14)
    rot = align_z(axis)
    for k in range(1, nodes + 1):
        at = base + axis * (k / (nodes + 1))
        p.cyl(r * 1.12, r * 1.12, 0.16, node_mat, T(*at) @ rot, seg=14)
    if cut:
        p.cyl(r * 1.06, r * 1.06, 0.12, node_mat, T(*top) @ rot, seg=14)
        p.cyl(r * 0.72, r * 0.72, 0.14, 'teak_dark', T(*(top + axis.normalized() * 0.02)) @ rot, seg=14)
    return base, top


def twig_tufts(p, base, top, at_fracs, r, leaf_len, rng_spin=0.0, count=5, twig=1.1, width=0.2):
    """Twigs with leaf fans at some nodes of a culm, alternating sides."""
    base, top = Vector(base), Vector(top)
    axis = top - base
    lean = Vector((axis.x, axis.y, 0))
    lean = lean.normalized() if lean.length > 1e-3 else Vector((1, 0, 0))
    perp = Vector((-lean.y, lean.x, 0))
    for k, f in enumerate(at_fracs):
        at = base + axis * f
        side = perp if k % 2 == 0 else -perp
        out = (side * 0.8 + lean * 0.6).normalized()
        end = at + out * twig + Vector((0, 0, 0.35))
        p.rod(at, end, r * 0.3, 'bamboo_dark', seg=6)
        tuft(p, end, out, count, leaf_len, leaf_len * width, spin=rng_spin + k * 13)
    # the crown
    tuft(p, top, lean, count + 1, leaf_len * 1.1, leaf_len * width, droop=0.35, spin=rng_spin)
    tuft(p, top, -lean, count, leaf_len, leaf_len * width, droop=0.6, spin=rng_spin + 20)


def stilt_house(p, x0, y0, x1, y1, floor=1.5, wall=2.2, rise=None, roof='clay_tile', over=0.55, steps=True,
                windows=True):
    """A Thai house on stilts: posts, a deck, plank walls, a door and a steep plain gable roof (no ornaments)."""
    for x in (x0 + 0.2, x1 - 0.2, (x0 + x1) / 2):
        for y in (y0 + 0.2, y1 - 0.2):
            kit.block(p, x - 0.13, y - 0.13, 0, x + 0.13, y + 0.13, floor, 'teak_dark')
    kit.block(p, x0 - 0.15, y0 - 0.15, floor, x1 + 0.15, y1 + 0.15, floor + 0.2, 'teak_light')
    top = floor + 0.2 + wall
    kit.block(p, x0, y0, floor + 0.2, x1, y1, top, 'teak')
    # a door and a window on the front, a window on the gable end
    w = x1 - x0
    if windows:
        kit.block(p, x0 + w * 0.18, y0 - 0.06, floor + 0.2, x0 + w * 0.18 + 0.9, y0, floor + 0.2 + 1.7, 'teak_dark')
        kit.block(p, x1 - w * 0.18 - 0.9, y0 - 0.06, floor + 0.9, x1 - w * 0.18, y0, floor + 1.7, 'window_dark')
        kit.block(p, x0 - 0.06, (y0 + y1) / 2 - 0.45, floor + 0.9, x0, (y0 + y1) / 2 + 0.45, floor + 1.7,
                  'window_dark')
    # roof: ridge along X, steep, the gable ends slightly flared outward at the eaves
    d = y1 - y0
    rise = rise if rise is not None else d * 0.95
    ym = (y0 + y1) / 2
    ridge = top + rise
    kit.prism_x(p, [(y0, top), (y1, top), (ym, ridge)], x0, x1, 'teak_light')
    xs, xe = x0 - over * 0.8, x1 + over * 0.8
    kit.slab(p, (xs, y0 - over, top - over * 0.75), (xe, y0 - over, top - over * 0.75), (xe, ym, ridge + 0.1),
             (xs, ym, ridge + 0.1), 0.22, roof)
    kit.slab(p, (xs, y1 + over, top - over * 0.75), (xe, y1 + over, top - over * 0.75), (xe, ym, ridge + 0.1),
             (xs, ym, ridge + 0.1), 0.22, roof)
    # a plank ridge cap
    kit.block(p, xs, ym - 0.14, ridge + 0.05, xe, ym + 0.14, ridge + 0.3, 'teak_dark')
    # steps up to the door
    sx = x0 + w * 0.18 + 0.45
    for k in range(4 if steps else 0):
        z = floor * (k + 1) / 5
        kit.block(p, sx - 0.5, y0 - 1.6 + k * 0.32, z - 0.1, sx + 0.5, y0 - 1.6 + k * 0.32 + 0.4, z + 0.05, 'teak_light')


def shrub(p, x, y, r):
    p.sphere(r, 'leaf_dark', T(x, y, r * 0.6), seg=10, rings=6, smooth=False)
    p.sphere(r * 0.7, 'leaf', T(x + r * 0.5, y - r * 0.3, r * 0.75), seg=10, rings=6, smooth=False)


# candidates ----------------------------------------------------------------------------------------------------------

def grove(coll, outline, small=False):
    """small: the 48 px and smaller sizes, with thicker culms, fewer and broader leaves and no little things."""
    land = Part('plot')
    plot(land, depth=1.9 if small else 2.6)
    if not small:
        # a path of laterite from the steps to the front edge, and two bushes
        kit.block(land, -3.0, -5.0, -0.02, -1.8, -3.0, 0.03, 'dirt')
        shrub(land, 3.9, -3.9, 0.55)
        shrub(land, -4.2, 3.7, 0.5)
    house = Part('house')
    stilt_house(house, -4.2, -3.0, 0.6, 0.4, steps=not small, windows=not small)
    clump_part = Part('bamboo')
    # A clump behind the house that fans out like a V across the picture (screen right is (0.78, -0.62) on the
    # ground), so the icon fills its square: the plot at the bottom, the leaves in the top corners.
    right = Vector((0.78, -0.62, 0))
    root = Vector((2.0, 2.2, 0))
    fan = [(-6.8, 9.4), (-3.4, 12.0), (0.2, 13.4), (3.6, 11.8), (7.0, 9.2)]
    r = 0.62 if small else 0.42
    for i, (spread, height) in enumerate(fan):
        base = root + right * (spread * 0.12) + Vector((0, 0, 0))
        top = root + right * spread + Vector((0.5 * (i % 2), 0.5 * ((i + 1) % 2), height))
        b, t = stem(clump_part, base, top, r, 4 if small else 6)
        if small:
            twig_tufts(clump_part, b, t, (0.72,), r, 3.0, rng_spin=i * 37, count=5, width=0.3)
        else:
            twig_tufts(clump_part, b, t, (0.55, 0.72, 0.86), r, 2.1, rng_spin=i * 37)
    for part in (land, house, clump_part):
        part.make(coll, outline=outline)


def towers(coll, outline):
    land = Part('plot')
    plot(land)
    bamboo = Part('bamboo')
    # graded like a town's skyline: tall at the back, low at the front; nodes are storeys
    stems = [  # x, y, height, radius
        (1.2, 2.6, 13.5, 0.95), (-1.4, 2.4, 11.0, 0.9), (3.4, 0.6, 10.0, 0.85), (-3.3, 0.3, 8.0, 0.85),
        (0.6, -0.2, 7.0, 0.8), (2.6, -2.6, 5.0, 0.75), (-1.6, -2.8, 4.0, 0.75),
    ]
    for i, (x, y, h, r) in enumerate(stems):
        n = max(2, int(h / 1.7))
        b, t = stem(bamboo, (x, y, 0), (x, y, h), r, n, cut=True)
        # lit windows between the nodes, facing the camera
        for k in range(n + 1):
            z = h * (k + 0.5) / (n + 1)
            if z < 1.2:
                continue
            bamboo.box((0.36, 0.08, 0.5), 'window_lit', T(x - r * 0.35, y - r * 0.95, z))
            bamboo.box((0.08, 0.36, 0.5), 'window_lit', T(x - r * 0.95, y - r * 0.35, z))
        if i < 4:
            out = Vector((1 if i % 2 else -1, -0.4, 0))
            at = Vector((x, y, h * 0.8)) + out.normalized() * r
            bamboo.rod(Vector((x, y, h * 0.75)), at + out.normalized() * 0.8 + Vector((0, 0, 0.3)), 0.12,
                       'bamboo_dark', seg=6)
            tuft(bamboo, at + out.normalized() * 0.8 + Vector((0, 0, 0.3)), out, 5, 2.0, 0.5, spin=i * 29)
    shrub(land, 4.0, -4.0, 0.5)
    shrub(land, -4.1, -3.9, 0.45)
    land.make(coll, outline=outline)
    bamboo.make(coll, outline=outline)


def frame(coll, outline):
    mound = Part('mound')
    mound.cyl(5.6, 6.0, 0.7, 'grass', T(0, 0, -0.35), seg=24, smooth=False)
    mound.cyl(6.0, 5.8, 1.4, 'laterite', T(0, 0, -1.4), seg=24, smooth=False)
    house = Part('house')
    stilt_house(house, -2.6, -2.2, 2.6, 1.4, floor=1.2, wall=2.4, rise=3.6, over=0.8)
    bamboo = Part('bamboo')
    for sx in (-1, 1):
        pts = [Vector((sx * 4.2, 1.6, 0)), Vector((sx * 4.6, 1.8, 5)), Vector((sx * 3.6, 2.0, 10)),
               Vector((sx * 1.2, 2.2, 13.2))]
        for a, b in zip(pts, pts[1:]):
            bamboo.rod(a, b, 0.42, 'thatch_light', seg=14)
            bamboo.cyl(0.48, 0.48, 0.18, 'bamboo_dark', T(*b) @ align_z(b - a), seg=14)
        tuft(bamboo, pts[2], Vector((sx, -0.3, 0)), 6, 2.4, 0.6, spin=sx * 10)
        tuft(bamboo, pts[3], Vector((sx * 0.3, -1, 0)), 7, 2.6, 0.62, droop=0.5, spin=sx * 15)
        tuft(bamboo, pts[1], Vector((sx, -0.2, 0)), 5, 2.0, 0.5, spin=sx * 5)
    for part in (mound, house, bamboo):
        part.make(coll, outline=outline)


CANDIDATES = {'grove': grove, 'towers': towers, 'frame': frame}


def main():
    opts = args()
    scene.reset()
    cam = scene.studio(res=(opts['size'], opts['size']))
    ground = bpy.data.objects.get('ground')
    if ground:
        bpy.data.objects.remove(ground)
    sc = bpy.context.scene
    sc.render.film_transparent = True
    sc.render.image_settings.color_mode = 'RGBA'
    try:
        sc.eevee.taa_render_samples = 64
    except AttributeError:
        pass
    coll = scene.collection('icon')
    outline = opts['outline'] if opts['outline'] is not None else (0.16 if opts['small'] else 0.09)
    if opts['small']:
        CANDIDATES[opts['candidate']](coll, outline, small=True)
    else:
        CANDIDATES[opts['candidate']](coll, outline)
    scene.frame(cam, list(coll.objects), margin=1.02)
    scene.render(os.path.abspath(opts['out']))
    if opts['blend']:
        scene.save(os.path.abspath(opts['blend']))
    print('ICON', opts['candidate'], opts['out'])


main()
