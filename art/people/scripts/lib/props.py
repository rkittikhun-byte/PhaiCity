# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Things people hold or stand beside. spec['props'] = [{'type': ..., 'hand': 'R'|'L'|'both'|'none', 'at': (x, y,
z), 'rot': (x, y, z) degrees, 'scale': k, ...}].

A prop in one hand is parented to that arm, so posing the arm in Blender carries it; 'both' and 'none' props are
parented to the root. Each builder draws round its grip point (the origin), its 'up' along +Z and 'front' along -Y.
"""

import math

from mathutils import Euler, Matrix, Vector

from .mesh import Part, R, S, T

PROPS = {}


def prop(fn):
    PROPS[fn.__name__] = fn
    return fn


def build_all(spec, body, coll, root, arms, hands, torso):
    for i, e in enumerate(spec.get('props', [])):
        if isinstance(e, str):
            e = {'type': e}
        part = Part('prop_' + e['type'])
        PROPS[e['type']](part, e, body)
        if part.empty:
            continue
        hand = e.get('hand', 'both')
        if hand in ('R', 'L'):
            side = -1 if hand == 'R' else 1
            anchor = hands[side]
            parent = arms[side]
        elif hand == 'both':
            anchor = (hands[-1] + hands[1]) / 2
            parent = torso
        elif hand == 'body':
            anchor = Vector((0, 0, 0))
            parent = torso
        else:
            anchor = Vector((0, 0, 0))
            parent = root
        at = anchor + Vector(e.get('at', (0, 0, 0)))
        obj = part.make(coll, pivot=(0, 0, 0), parent=None)
        obj.name = 'prop_' + e['type']
        k = e.get('scale', 1.0)
        rot = e.get('rot', (0, 0, 0))
        world = Matrix.Translation(at) @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4() @ \
            Matrix.Diagonal((k, k, k, 1))
        obj.parent = parent
        if parent is root:
            obj.matrix_parent_inverse = Matrix.Identity(4)
        else:
            from .body import parent_basis
            obj.matrix_parent_inverse = parent_basis(parent).inverted()
        obj.matrix_basis = world


# everyday things ----------------------------------------------------------------------------------------------------

@prop
def alms_bowl(part, e, body):
    """Monk's alms bowl (บาตร), held in both hands at the belly."""
    part.lathe([(0.06, -0.08), (0.12, -0.05), (0.13, 0.0), (0.115, 0.05), (0.09, 0.065)], 'bowl', seg=14,
               cap_bottom=True)
    part.lathe([(0.09, 0.065), (0.07, 0.066)], 'iron', seg=14)


@prop
def sickle(part, e, body):
    """Rice sickle (เคียว): a short wooden handle and a thin crescent blade curling forward."""
    part.cyl(0.017, 0.02, 0.14, 'wood', T(0, 0, 0), seg=6)
    c = Vector((0, -0.085, 0.08))
    pts = [Vector((0, 0, 0.06))]
    for i in range(9):
        a = math.radians(-10 + i * 24)
        pts.append(c + Vector((0, 0.085 * math.cos(a), 0.095 * math.sin(a))))
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        r = 0.011 - i * 0.0009
        part.rod(tuple(a), tuple(b), r, 'metal', seg=4, r_end=max(r - 0.0009, 0.003), smooth=False)


@prop
def rice_seedlings(part, e, body):
    """A bundle of rice seedlings (กล้า) tied in the middle, held against the chest."""
    for i in range(14):
        a = 2 * math.pi * i / 14
        rr = 0.03 + 0.015 * (i % 2)
        part.cyl(0.012, 0.004, 0.32, 'leaf' if i % 3 else 'leaf_dark',
                 T(math.cos(a) * rr, math.sin(a) * rr, 0.1) @ R(math.cos(a) * 12, math.sin(a) * -12, 0), seg=4)
    part.cyl(0.05, 0.05, 0.03, 'straw', T(0, 0, -0.02), seg=10)
    for i in range(8):
        a = 2 * math.pi * i / 8
        part.cyl(0.006, 0.006, 0.1, 'straw_dark', T(math.cos(a) * 0.03, math.sin(a) * 0.03, -0.09), seg=3)


@prop
def cast_net(part, e, body):
    """A cast net (แห) hanging from the hand, weighted at its rim."""
    part.lathe([(0.02, 0.05), (0.06, -0.05), (0.16, -0.32), (0.2, -0.45)], 'net', seg=12, smooth=False)
    part.lathe([(0.16, -0.32), (0.161, -0.3)], 'rope', seg=12)
    for i in range(10):
        a = 2 * math.pi * i / 10
        part.sphere(0.022, 'iron', T(math.cos(a) * 0.2, math.sin(a) * 0.2, -0.46), seg=6, rings=4)


@prop
def paddle(part, e, body):
    """A long boat paddle (พาย), held upright: grip at the origin, blade on the ground."""
    L = e.get('length', 1.25)
    part.cyl(0.02, 0.02, L, 'wood', T(0, 0, -L * 0.35), seg=6)
    part.box((0.11, 0.025, 0.32), 'wood', T(0, 0, -L * 0.85 - 0.08), bevel=0.01)
    part.box((0.08, 0.03, 0.05), 'wood_dark', T(0, 0, L * 0.65 - 0.35 * L + 0.0))


@prop
def pole(part, e, body):
    """A long bamboo or wooden pole held upright (ไม้ถ่อ)."""
    L = e.get('length', 1.9)
    part.cyl(0.022, 0.02, L, e.get('color', 'wood'), T(0, 0, L * 0.5 - e.get('grip', 0.85)), seg=6)


@prop
def rope_coil(part, e, body):
    for i in range(4):
        part.torus(0.1 - i * 0.008, 0.012, 'rope', T(i * 0.004, 0, -0.1) @ R(0, 90, 0) @ R(0, 0, i * 7), seg=14,
                   seg_minor=4)
    part.polyline([(0, 0, -0.02), (0.02, 0.03, -0.25), (0.0, 0.05, -0.32)], 0.011, 'rope', seg=4)


@prop
def wooden_box(part, e, body):
    """A small carved wooden box (หีบหมาก), held in both hands."""
    part.box((0.2, 0.13, 0.1), e.get('color', 'wood'), T(0, 0, 0), bevel=0.01)
    part.box((0.21, 0.14, 0.025), 'wood_dark', T(0, 0, 0.055), bevel=0.006)
    for x in (-0.05, 0.0, 0.05):
        part.box((0.012, 0.004, 0.06), 'wood_dark', T(x, -0.066, -0.005))


@prop
def produce(part, e, body):
    """A heap of greens, bananas and limes (fills baskets and boats)."""
    k = e.get('size', 1.0)
    for i in range(5):
        a = 2 * math.pi * i / 5
        part.cyl(0.035 * k, 0.0, 0.16 * k, 'leaf', T(math.cos(a) * 0.05 * k, math.sin(a) * 0.05 * k, 0.05 * k) @
                 R(math.cos(a) * 30, math.sin(a) * -30, 0), seg=4, smooth=False)
    for i in range(4):
        part.cyl(0.018 * k, 0.012 * k, 0.11 * k, 'banana', T(-0.04 * k + i * 0.022 * k, 0.03 * k, 0.03 * k) @
                 R(0, 70, 15 * i), seg=6)
    for x, y in ((0.05, -0.04), (0.08, 0.01), (0.02, -0.06)):
        part.sphere(0.03 * k, 'lime', T(x * k, y * k, 0.02 * k), seg=8, rings=5)


def _basket(part, m, r=0.13, h=0.11, fill=True):
    part.lathe([(r * 0.7, 0.0), (r, h * 0.7), (r * 1.05, h)], 'straw', m, seg=12, cap_bottom=True)
    part.lathe([(r * 1.05, h), (r * 1.07, h + 0.015)], 'straw_dark', m, seg=12)
    part.lathe([(r * 0.86, h * 0.35), (r * 0.88, h * 0.4)], 'straw_dark', m, seg=12)
    if fill:
        produce(part, {}, None) if False else None
        k = r / 0.13
        for i in range(5):
            a = 2 * math.pi * i / 5
            part.cyl(0.035 * k, 0.0, 0.16 * k, 'leaf', m @ T(math.cos(a) * 0.05 * k, math.sin(a) * 0.05 * k, h + 0.04 * k) @
                     R(math.cos(a) * 30, math.sin(a) * -30, 0), seg=4, smooth=False)
        for i in range(4):
            part.cyl(0.018 * k, 0.012 * k, 0.11 * k, 'banana', m @ T(-0.04 * k + i * 0.022 * k, 0.03 * k, h + 0.03 * k) @
                     R(0, 70, 15 * i), seg=6)
        for x, y in ((0.05, -0.04), (0.08, 0.01), (0.02, -0.06)):
            part.sphere(0.03 * k, 'lime', m @ T(x * k, y * k, h + 0.02 * k), seg=8, rings=5)


@prop
def yoke(part, e, body):
    """Carrying pole (ไม้คาน) across the right shoulder with a basket hanging at each end. Origin on the shoulder;
    the pole runs along X."""
    L = e.get('length', 1.15)
    part.cyl(0.018, 0.018, L, 'wood', R(0, 90, 0), seg=6)
    for side in (-1, 1):
        x = side * L * 0.44
        top = Vector((x, 0, 0))
        bz = -0.62
        for a in range(3):
            ang = 2 * math.pi * a / 3 + 0.5
            part.rod(top, (x + math.cos(ang) * 0.12, math.sin(ang) * 0.12, bz + 0.1), 0.006, 'rope', seg=3)
        _basket(part, T(x, 0, bz), r=0.14, h=0.12)


def hull(part, L, W, H, mat='wood', rail='wood_dark', m=None, stations=11, sheer=0.12):
    """A small wooden boat hull along X: a U section that narrows to a point at both ends, its rails rising."""
    import bmesh
    from mathutils import Matrix
    m = m or Matrix.Identity(4)
    tmp = bmesh.new()
    rows = []
    rails = ([], [])
    for i in range(stations):
        t = i / (stations - 1)
        x = L * (t - 0.5)
        w = W * 0.5 * max(math.sin(math.pi * t), 0.0) ** 0.55
        h = H + sheer * (2 * t - 1) ** 4
        keel = 0.015 + 0.05 * (2 * t - 1) ** 4
        sec = [(-w, h), (-w * 0.9, h * 0.45 + keel * 0.5), (-w * 0.5, keel), (w * 0.5, keel),
               (w * 0.9, h * 0.45 + keel * 0.5), (w, h)]
        rows.append([tmp.verts.new((x, y, z)) for y, z in sec])
        rails[0].append((x, -w, h))
        rails[1].append((x, w, h))
    for a, b in zip(rows, rows[1:]):
        for j in range(len(a) - 1):
            quad = [a[j], a[j + 1], b[j + 1], b[j]]
            if len({tuple(round(c, 6) for c in v.co) for v in quad}) >= 3:
                try:
                    tmp.faces.new(quad)
                except ValueError:
                    pass
    part.merge(tmp, mat, m, smooth=False)
    for pts in rails:
        part.polyline([tuple(m @ Vector(p)) for p in pts], 0.018, rail, seg=5)


@prop
def boat(part, e, body):
    """A small wooden market boat (เรือแจว / เรือพาย) loaded with produce, beside the person."""
    L, W, H = e.get('length', 1.3), 0.42, 0.2
    hull(part, L, W, H)
    for x in (-0.32, 0.32):
        part.box((0.05, W * 0.85, 0.022), 'wood_dark', T(x * L / 1.3, 0, H * 0.8))
    if e.get('load', True):
        for x, s in ((-0.28, 1.0), (0.02, 0.9), (0.3, 0.8)):
            _basket(part, T(x * L / 1.3, 0, 0.03), r=0.11 * s, h=0.08)


# More props by theme, registered through @prop.
from . import props_town, props_work, props_region  # noqa: E402,F401
